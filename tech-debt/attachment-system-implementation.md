# Attachment System Implementation

## Overview

This document outlines the implementation of the new attachment system that supports multiple files per message with CDN/S3 integration, replacing the single `fileUrl` field with a comprehensive `Attachment` model.

## Schema Changes

### Before (Single File)
```prisma
model Message {
  // ... other fields
  fileUrl   String?  // Single file only
}
```

### After (Multiple Attachments)
```prisma
model Message {
  // ... other fields
  attachments Attachment[] // Multiple attachments per message
}

model Attachment {
  id          String   @id @default(cuid())
  messageId   String
  filename    String   // Original filename
  url         String   // CDN/S3 URL
  cdnUrl      String?  // Optimized CDN URL (for images with transformations)
  thumbnailUrl String? // Thumbnail URL for images/videos
  fileType    String   // MIME type (image/png, video/mp4, etc.)
  fileSize    Int      // File size in bytes
  width       Int?     // Image/video width
  height      Int?     // Image/video height
  duration    Int?     // Video/audio duration in seconds
  uploadKey   String?  // S3 key or storage identifier
  metadata    Json?    // Additional metadata (alt text, description, etc.)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  message     Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
}
```

## CDN/S3 Integration Patterns

### AWS S3 + CloudFront
```typescript
// Upload to S3 and generate CloudFront URLs
const uploadToS3 = async (file: File, messageId: string) => {
  const key = `messages/${messageId}/${Date.now()}-${file.name}`;
  
  // Upload original file
  await s3.upload({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file,
    ContentType: file.type
  }).promise();
  
  // Generate URLs
  const s3Url = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  const cdnUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
  
  // Generate thumbnail for images
  let thumbnailUrl = null;
  if (file.type.startsWith('image/')) {
    const thumbnailKey = `thumbnails/${messageId}/${Date.now()}-thumb-${file.name}`;
    await generateThumbnail(file, thumbnailKey);
    thumbnailUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${thumbnailKey}`;
  }
  
  return {
    url: s3Url,
    cdnUrl,
    thumbnailUrl,
    uploadKey: key
  };
};
```

### Cloudinary Integration
```typescript
// Upload with automatic optimizations
const uploadToCloudinary = async (file: File) => {
  const result = await cloudinary.uploader.upload(file.buffer, {
    resource_type: "auto", // Automatically detect file type
    folder: "tradersutopia/messages",
    transformation: [
      { quality: "auto", fetch_format: "auto" } // Auto optimization
    ]
  });
  
  return {
    url: result.secure_url,
    cdnUrl: result.secure_url,
    thumbnailUrl: cloudinary.url(result.public_id, {
      width: 300,
      height: 300,
      crop: "fill",
      quality: "auto",
      format: "auto"
    }),
    uploadKey: result.public_id,
    width: result.width,
    height: result.height
  };
};
```

### UploadThing Integration (Current)
```typescript
// Enhanced UploadThing with metadata
const uploadWithUploadThing = async (files: File[]) => {
  const uploadedFiles = await uploadFiles("messageAttachment", {
    files,
    onUploadComplete: (res) => {
      console.log("Upload completed", res);
    }
  });
  
  return uploadedFiles.map(file => ({
    url: file.url,
    cdnUrl: file.url, // UploadThing provides CDN by default
    thumbnailUrl: file.url + "?w=300&h=300", // URL transformations
    filename: file.name,
    fileSize: file.size,
    fileType: file.type,
    uploadKey: file.key
  }));
};
```

## API Implementation

### Message Creation with Attachments
```typescript
// POST /api/messages
export async function POST(req: Request) {
  const { userId } = auth();
  const user = await prisma.user.findUnique({ where: { userId } });
  
  if (!user?.isAdmin) {
    return new NextResponse('Only admins can send messages', { status: 403 });
  }
  
  const formData = await req.formData();
  const content = formData.get('content') as string;
  const channelId = formData.get('channelId') as string;
  const files = formData.getAll('files') as File[];
  
  // Find member
  const member = await prisma.member.findFirst({
    where: {
      userId: user.id,
      server: { channels: { some: { id: channelId } } }
    }
  });
  
  if (!member) {
    return new NextResponse('Member not found', { status: 404 });
  }
  
  // Create message first
  const message = await prisma.message.create({
    data: {
      content,
      channelId,
      memberId: member.id,
    }
  });
  
  // Upload and create attachments
  if (files.length > 0) {
    const attachmentPromises = files.map(async (file) => {
      // Upload to your chosen service (S3, Cloudinary, UploadThing)
      const uploadResult = await uploadFile(file, message.id);
      
      // Get file dimensions for images/videos
      const dimensions = await getFileDimensions(file);
      
      return prisma.attachment.create({
        data: {
          messageId: message.id,
          filename: file.name,
          url: uploadResult.url,
          cdnUrl: uploadResult.cdnUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          fileType: file.type,
          fileSize: file.size,
          width: dimensions?.width,
          height: dimensions?.height,
          duration: dimensions?.duration,
          uploadKey: uploadResult.uploadKey,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString()
          }
        }
      });
    });
    
    await Promise.all(attachmentPromises);
  }
  
  // Return message with attachments
  const messageWithAttachments = await prisma.message.findUnique({
    where: { id: message.id },
    include: {
      attachments: true,
      member: { include: { user: true } },
      channel: true
    }
  });
  
  return NextResponse.json(messageWithAttachments);
}
```

### Fetching Messages with Attachments
```typescript
// GET /api/channels/[channelId]/messages
export async function GET(req: Request) {
  const { channelId } = req.params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  const messages = await prisma.message.findMany({
    where: { 
      channelId,
      deleted: false 
    },
    include: {
      attachments: {
        orderBy: { createdAt: 'asc' }
      },
      member: {
        include: { 
          user: { select: { id: true, name: true, imageUrl: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0
  });
  
  return NextResponse.json(messages);
}
```

## Frontend Integration

### Upload Component
```tsx
// components/chat/attachment-upload.tsx
import { useState } from 'react';
import { Upload, X, Image, File, Video } from 'lucide-react';

interface AttachmentUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizePerFile?: number; // in bytes
}

export const AttachmentUpload = ({ 
  onFilesChange, 
  maxFiles = 5, 
  maxSizePerFile = 10 * 1024 * 1024 // 10MB
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
    
    // Generate previews
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

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        multiple
        className="hidden"
        id="file-upload"
        onChange={handleFileSelect}
        accept="image/*,video/*,.pdf,.doc,.docx"
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
            <div key={index} className="relative border rounded-lg p-2">
              {file.type.startsWith('image/') && previews[index] ? (
                <img 
                  src={previews[index]} 
                  alt={file.name}
                  className="w-full h-24 object-cover rounded"
                />
              ) : (
                <div className="flex items-center space-x-2 h-24">
                  {getFileIcon(file.type)}
                  <span className="text-sm truncate">{file.name}</span>
                </div>
              )}
              
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
              >
                <X className="w-3 h-3" />
              </button>
              
              <div className="text-xs text-gray-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(1)}MB
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Message Display Component
```tsx
// components/chat/message-attachments.tsx
import { Attachment } from '@prisma/client';
import { Download, ExternalLink } from 'lucide-react';

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export const MessageAttachments = ({ attachments }: MessageAttachmentsProps) => {
  if (!attachments?.length) return null;

  const renderAttachment = (attachment: Attachment) => {
    const { fileType, url, cdnUrl, thumbnailUrl, filename, fileSize } = attachment;

    // Use CDN URL if available, fallback to regular URL
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
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg" />
          <button
            onClick={() => window.open(displayUrl, '_blank')}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 text-white p-1 rounded"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
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

    // Generic file
    return (
      <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50 max-w-sm">
        <File className="w-8 h-8 text-gray-600" />
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

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id}>
          {renderAttachment(attachment)}
        </div>
      ))}
    </div>
  );
};
```

## Migration Strategy

### 1. Database Migration
```prisma
-- Create attachments table
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

-- Create indexes
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");
CREATE INDEX "attachments_fileType_idx" ON "attachments"("fileType");
CREATE INDEX "attachments_createdAt_idx" ON "attachments"("createdAt");

-- Add foreign key
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" 
FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### 2. Data Migration Script
```typescript
// Migrate existing fileUrl to attachments
const migrateFileUrls = async () => {
  const messagesWithFiles = await prisma.message.findMany({
    where: { fileUrl: { not: null } }
  });

  for (const message of messagesWithFiles) {
    if (message.fileUrl) {
      // Extract filename from URL
      const filename = message.fileUrl.split('/').pop() || 'unknown';
      
      await prisma.attachment.create({
        data: {
          messageId: message.id,
          filename,
          url: message.fileUrl,
          fileType: getFileTypeFromUrl(message.fileUrl),
          fileSize: 0, // Unknown for old files
          createdAt: message.createdAt
        }
      });
    }
  }

  // Remove fileUrl column after migration
  // ALTER TABLE "messages" DROP COLUMN "fileUrl";
};
```

## Benefits of New System

### 🚀 **Performance**
- **CDN Integration**: Faster file delivery worldwide
- **Optimized Images**: Automatic compression and format conversion
- **Thumbnail Generation**: Quick previews without loading full files
- **Lazy Loading**: Load attachments on demand

### 📈 **Scalability** 
- **Multiple Files**: No limit to single attachment per message
- **Storage Flexibility**: Easy to switch between S3, Cloudinary, etc.
- **Metadata Rich**: Store dimensions, duration, file info
- **Future Proof**: Ready for advanced features like file processing

### 🎨 **User Experience**
- **Rich Previews**: Images, videos, documents with thumbnails
- **Progress Indicators**: Upload progress and status
- **File Management**: Easy to remove/replace attachments
- **Mobile Optimized**: Responsive image handling

### 🔧 **Developer Experience**
- **Type Safe**: Full TypeScript support with Prisma
- **Extensible**: Easy to add new file types and processing
- **Organized**: Clean separation of concerns
- **Maintainable**: Clear attachment lifecycle management

## Next Steps

1. **Choose CDN Provider**: S3+CloudFront, Cloudinary, or enhance UploadThing
2. **Implement Upload API**: Support multiple file uploads
3. **Create Frontend Components**: Upload and display components
4. **Add Image Processing**: Thumbnails, compression, transformations
5. **Performance Optimization**: Lazy loading, progressive images
6. **Security**: File type validation, virus scanning, access controls

This new attachment system provides a solid foundation for scalable file handling in your Discord-like app! 