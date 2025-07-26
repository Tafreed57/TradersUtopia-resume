# Ticket 3.3: Multiple File Attachment System Implementation
**Priority:** MEDIUM | **Effort:** 4 days | **Risk:** MEDIUM

## Description
Replace the single `fileUrl` field with a comprehensive multiple file attachment system supporting images, videos, documents with CDN integration and thumbnails.

## Current Problem
- Messages limited to single file attachment
- No thumbnail generation for images/videos
- No file metadata (size, type, dimensions)
- No CDN optimization for faster loading

## Implementation

### Database Schema Update
```sql
-- Add to migration
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cdnUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "uploadKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");
CREATE INDEX "attachments_fileType_idx" ON "attachments"("fileType");

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" 
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Attachment Service
```typescript
// src/services/attachment-service.ts
export class AttachmentService extends BaseService {
  private uploadService: UploadService;
  
  constructor(prisma: PrismaClient) {
    super(prisma);
    this.uploadService = new UploadService();
  }
  
  // Upload multiple files and create attachments
  async createAttachmentsForMessage(
    messageId: string, 
    files: File[]
  ): Promise<Attachment[]> {
    try {
      this.validateId(messageId, 'messageId');
      
      if (files.length > 5) {
        throw new ValidationError('Maximum 5 files per message');
      }
      
      const attachments: Attachment[] = [];
      
      for (const file of files) {
        // Validate file
        this.validateFile(file);
        
        // Upload to storage (UploadThing/S3/Cloudinary)
        const uploadResult = await this.uploadService.uploadFile(file, messageId);
        
        // Get file metadata
        const metadata = await this.extractFileMetadata(file);
        
        // Create attachment record
        const attachment = await this.prisma.attachment.create({
          data: {
            messageId,
            filename: file.name,
            url: uploadResult.url,
            cdnUrl: uploadResult.cdnUrl,
            thumbnailUrl: uploadResult.thumbnailUrl,
            fileType: file.type,
            fileSize: file.size,
            width: metadata.width,
            height: metadata.height,
            duration: metadata.duration,
            uploadKey: uploadResult.uploadKey,
            metadata: {
              originalName: file.name,
              uploadedAt: new Date().toISOString(),
              ...metadata
            },
          },
        });
        
        attachments.push(attachment);
      }
      
      return attachments;
    } catch (error) {
      this.handleError(error, 'create attachments for message', { messageId, fileCount: files.length });
    }
  }
  
  // Get attachments for message
  async findAttachmentsByMessage(messageId: string): Promise<Attachment[]> {
    try {
      this.validateId(messageId, 'messageId');
      
      return await this.prisma.attachment.findMany({
        where: { messageId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      this.handleError(error, 'find attachments by message', { messageId });
    }
  }
  
  // Delete attachment
  async deleteAttachment(attachmentId: string): Promise<void> {
    try {
      this.validateId(attachmentId, 'attachmentId');
      
      const attachment = await this.prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      
      if (attachment) {
        // Delete from storage
        await this.uploadService.deleteFile(attachment.uploadKey);
        
        // Delete from database
        await this.prisma.attachment.delete({
          where: { id: attachmentId },
        });
      }
    } catch (error) {
      this.handleError(error, 'delete attachment', { attachmentId });
    }
  }
  
  // Migrate existing fileUrl to attachments
  async migrateExistingFileUrls(): Promise<number> {
    try {
      const messagesWithFiles = await this.prisma.message.findMany({
        where: { fileUrl: { not: null } },
      });
      
      let migratedCount = 0;
      
      for (const message of messagesWithFiles) {
        if (message.fileUrl) {
          const filename = this.extractFilenameFromUrl(message.fileUrl);
          const fileType = this.guessFileTypeFromUrl(message.fileUrl);
          
          await this.prisma.attachment.create({
            data: {
              messageId: message.id,
              filename,
              url: message.fileUrl,
              fileType,
              fileSize: 0, // Unknown for legacy files
              createdAt: message.createdAt,
            },
          });
          
          migratedCount++;
        }
      }
      
      return migratedCount;
    } catch (error) {
      this.handleError(error, 'migrate existing file URLs');
    }
  }
  
  private validateFile(file: File): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'application/pdf',
      'text/plain'
    ];
    
    if (file.size > maxSize) {
      throw new ValidationError(`File ${file.name} is too large (max 10MB)`);
    }
    
    if (!allowedTypes.includes(file.type)) {
      throw new ValidationError(`File type ${file.type} is not allowed`);
    }
  }
  
  private async extractFileMetadata(file: File): Promise<FileMetadata> {
    const metadata: FileMetadata = {};
    
    if (file.type.startsWith('image/')) {
      // Extract image dimensions
      const dimensions = await this.getImageDimensions(file);
      metadata.width = dimensions.width;
      metadata.height = dimensions.height;
    } else if (file.type.startsWith('video/')) {
      // Extract video metadata
      const videoData = await this.getVideoMetadata(file);
      metadata.width = videoData.width;
      metadata.height = videoData.height;
      metadata.duration = videoData.duration;
    }
    
    return metadata;
  }
  
  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = URL.createObjectURL(file);
    });
  }
  
  private async getVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration)
        });
      };
      video.src = URL.createObjectURL(file);
    });
  }
}

interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
}
```

### Upload Service
```typescript
// src/services/upload-service.ts
export class UploadService {
  // Enhanced UploadThing integration
  async uploadFile(file: File, messageId: string): Promise<UploadResult> {
    try {
      const uploadedFiles = await uploadFiles('messageAttachment', {
        files: [file],
        onUploadComplete: (res) => {
          console.log('Upload completed', res);
        },
        onUploadError: (error) => {
          console.error('Upload error', error);
          throw error;
        },
      });
      
      const uploadedFile = uploadedFiles[0];
      
      // Generate thumbnail for images
      let thumbnailUrl = null;
      if (file.type.startsWith('image/')) {
        thumbnailUrl = `${uploadedFile.url}?w=300&h=300&fit=crop`;
      }
      
      return {
        url: uploadedFile.url,
        cdnUrl: uploadedFile.url, // UploadThing provides CDN by default
        thumbnailUrl,
        uploadKey: uploadedFile.key,
      };
    } catch (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
  
  async deleteFile(uploadKey: string): Promise<void> {
    try {
      // UploadThing deletion API
      await utapi.deleteFiles([uploadKey]);
    } catch (error) {
      console.error('Failed to delete file:', error);
      // Don't throw - file might already be deleted
    }
  }
}

interface UploadResult {
  url: string;
  cdnUrl: string;
  thumbnailUrl?: string;
  uploadKey: string;
}
```

### Frontend Components
```tsx
// src/components/chat/attachment-upload.tsx
export const AttachmentUpload = ({ 
  onFilesChange, 
  maxFiles = 5, 
  maxSizePerFile = 10 * 1024 * 1024 
}: AttachmentUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    // Validate files
    const validFiles = selectedFiles.filter(file => {
      if (file.size > maxSizePerFile) {
        toast.error(`${file.name} is too large (max ${maxSizePerFile / 1024 / 1024}MB)`);
        return false;
      }
      return true;
    }).slice(0, maxFiles);
    
    setFiles(validFiles);
    onFilesChange(validFiles);
    
    // Generate previews for images
    validFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => {
            const newPreviews = [...prev];
            newPreviews[index] = e.target?.result as string;
            return newPreviews;
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        multiple
        className="hidden"
        id="file-upload"
        onChange={handleFileSelect}
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
      />
      
      <label 
        htmlFor="file-upload"
        className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
      >
        <Upload className="w-6 h-6 mr-2" />
        <span>Upload files (max {maxFiles})</span>
      </label>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {files.map((file, index) => (
            <AttachmentPreview
              key={index}
              file={file}
              preview={previews[index]}
              onRemove={() => removeFile(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// src/components/chat/message-attachments.tsx
export const MessageAttachments = ({ attachments }: { attachments: Attachment[] }) => {
  if (!attachments?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => (
        <AttachmentDisplay key={attachment.id} attachment={attachment} />
      ))}
    </div>
  );
};

const AttachmentDisplay = ({ attachment }: { attachment: Attachment }) => {
  const { fileType, url, cdnUrl, thumbnailUrl, filename, fileSize } = attachment;
  const displayUrl = cdnUrl || url;

  if (fileType.startsWith('image/')) {
    return (
      <div className="relative group">
        <img
          src={thumbnailUrl || displayUrl}
          alt={filename}
          className="max-w-sm max-h-64 rounded-lg cursor-pointer"
          onClick={() => window.open(displayUrl, '_blank')}
        />
        <AttachmentOverlay url={displayUrl} filename={filename} />
      </div>
    );
  }

  if (fileType.startsWith('video/')) {
    return (
      <video
        controls
        className="max-w-sm max-h-64 rounded-lg"
        poster={thumbnailUrl}
      >
        <source src={displayUrl} type={fileType} />
      </video>
    );
  }

  // Generic file display
  return (
    <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50 max-w-sm">
      <FileIcon className="w-8 h-8 text-gray-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename}</p>
        <p className="text-xs text-gray-500">
          {(fileSize / 1024 / 1024).toFixed(1)}MB
        </p>
      </div>
      <button
        onClick={() => window.open(displayUrl, '_blank')}
        className="p-1 hover:bg-gray-200 rounded"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
};
```

## Acceptance Criteria
- [ ] Create Attachment model with comprehensive metadata
- [ ] Implement AttachmentService with upload, delete, and migration methods
- [ ] Support multiple file types (images, videos, documents)
- [ ] Generate thumbnails for images and video previews
- [ ] Create intuitive upload UI with drag-and-drop support
- [ ] Implement attachment display components for different file types
- [ ] Migrate existing fileUrl data to new attachment system
- [ ] Add file validation (size, type, count limits)
- [ ] Ensure CDN optimization for fast loading

## Files to Create/Modify
- `src/services/attachment-service.ts` (new)
- `src/services/upload-service.ts` (new)
- `src/components/chat/attachment-upload.tsx` (new)
- `src/components/chat/message-attachments.tsx` (new)
- `src/app/api/messages/route.ts` (update to handle attachments)
- `prisma/schema.prisma` (add Attachment model)
- `scripts/migrate-file-urls.ts` (migration script)

### Documentation Requirements
- [ ] Create file attachment system architecture diagram
- [ ] Document file upload workflow and security measures in `docs/features/file-attachments.md`
- [ ] Add CDN integration and optimization guide

### Testing Requirements
- [ ] **Unit Tests**: AttachmentService and UploadService methods
- [ ] **Integration Tests**: End-to-end file upload and attachment flow
- [ ] **Security Tests**: File type validation, size limits, malicious file detection
- [ ] **Performance Tests**: Multiple file upload performance and CDN delivery
- [ ] **UI Tests**: File upload component functionality and error handling

## Dependencies
- Ticket 3.1 (Database Schema Migration)
- Updated UploadThing configuration 