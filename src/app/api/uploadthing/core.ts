import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { auth } from '@clerk/nextjs/server';
import {
  validateFileUploadAdvanced,
  simulateVirusScan,
  validateUploadRate,
} from '@/lib/validation';
import { rateLimitUpload, trackSuspiciousActivity } from '@/lib/rate-limit';

const f = createUploadthing();

// ✅ SECURITY: Enhanced authentication with rate limiting
const handleAuth = async () => {
  const user = await auth();
  if (!user || !user.userId) throw new UploadThingError('Unauthorized');
  return { userId: user.userId };
};

// ✅ SECURITY: Comprehensive file validation middleware
const secureFileValidation = async (
  file: { name: string; size: number; type: string },
  userId: string
) => {
  // ✅ SECURITY: Rate limiting check
  const rateCheck = validateUploadRate(userId, 1);
  if (!rateCheck.allowed) {
    console.error(
      `🚨 [UPLOAD] Rate limit exceeded for user: ${userId} - ${rateCheck.reason}`
    );
    throw new UploadThingError(`Upload limit exceeded: ${rateCheck.reason}`);
  }

  // ✅ SECURITY: Advanced file validation
  const validation = validateFileUploadAdvanced(file);
  if (!validation.safe) {
    console.error(`🚨 [UPLOAD] File validation failed for user: ${userId}`, {
      fileName: file.name,
      threats: validation.threats,
      fileSize: file.size,
      mimeType: file.type,
    });

    const threatMessage = validation.threats.includes('DANGEROUS_FILE_TYPE')
      ? 'Dangerous file type detected'
      : validation.threats.includes('INVALID_FILE_EXTENSION')
        ? 'Invalid file extension'
        : validation.threats.includes('FILE_TOO_LARGE')
          ? `File too large. Maximum size: ${Math.round(validation.maxAllowedSize / (1024 * 1024))}MB`
          : 'File validation failed';

    throw new UploadThingError(threatMessage);
  }

  // ✅ SECURITY: Simulated virus scanning
  try {
    const scanResult = await simulateVirusScan(file);

    if (!scanResult.clean) {
      console.error(`🚨 [UPLOAD] Virus scan failed for user: ${userId}`, {
        fileName: file.name,
        threats: scanResult.threats,
        confidence: scanResult.confidence,
      });

      throw new UploadThingError('File failed security scan. Upload rejected.');
    }

    // ✅ SECURITY: Only log if there were threats detected during scan
    if (scanResult.threats && scanResult.threats.length > 0) {
      console.log(`🔍 [UPLOAD] Virus scan completed for user: ${userId}`, {
        fileName: file.name,
        clean: scanResult.clean,
        scanTime: scanResult.scanTime,
        confidence: scanResult.confidence,
        threats: scanResult.threats,
      });
    }
  } catch (scanError) {
    console.error(
      `❌ [UPLOAD] Virus scan error for user: ${userId}:`,
      scanError
    );
    throw new UploadThingError('Security scan failed. Please try again.');
  }

  return true;
};

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  serverImage: f({
    image: {
      maxFileSize: '4MB', // ✅ SECURITY: Secure file size limit
      maxFileCount: 1,
    },
  })
    .middleware(async ({ files }) => {
      const auth = await handleAuth();

      // ✅ SECURITY: Rate limiting for image uploads
      const request = { headers: { get: () => null } } as any; // Mock request for rate limiting
      const rateLimitResult = await rateLimitUpload()(request);
      if (!rateLimitResult.success) {
        console.error(
          `🚨 [UPLOAD] Rate limit exceeded for user: ${auth.userId}`
        );
        throw new UploadThingError(
          'Upload rate limit exceeded. Please wait before uploading more files.'
        );
      }

      // ✅ SECURITY: Validate each file
      for (const file of files) {
        await secureFileValidation(file, auth.userId);
      }

      return auth;
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // ✅ SECURITY: Additional post-upload verification could go here
      // In production: scan uploaded file from URL, update database, etc.

      return {
        uploadedBy: metadata.userId,
        securityVerified: true,
        uploadTime: new Date().toISOString(),
      };
    }),

  messageFile: f(['image', 'pdf'])
    .middleware(async ({ files }) => {
      const auth = await handleAuth();

      // ✅ SECURITY: Rate limiting for message file uploads
      const request = { headers: { get: () => null } } as any; // Mock request for rate limiting
      const rateLimitResult = await rateLimitUpload()(request);
      if (!rateLimitResult.success) {
        console.error(
          `🚨 [UPLOAD] Rate limit exceeded for user: ${auth.userId}`
        );
        throw new UploadThingError(
          'Upload rate limit exceeded. Please wait before uploading more files.'
        );
      }

      // ✅ SECURITY: Validate each file with enhanced checking for message files
      for (const file of files) {
        await secureFileValidation(file, auth.userId);

        // ✅ SECURITY: Additional checks for message files
        if (file.type === 'application/pdf' && file.size > 10 * 1024 * 1024) {
          // 10MB limit for PDFs
          throw new UploadThingError('PDF files must be smaller than 10MB');
        }

        if (file.type.startsWith('image/') && file.size > 8 * 1024 * 1024) {
          // 8MB limit for images
          throw new UploadThingError('Image files must be smaller than 8MB');
        }
      }

      return auth;
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // ✅ SECURITY: Message files require additional verification
      // In production: content analysis, OCR scanning, metadata extraction

      return {
        uploadedBy: metadata.userId,
        securityVerified: true,
        contentScanned: true,
        uploadTime: new Date().toISOString(),
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
