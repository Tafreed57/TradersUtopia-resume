import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ==============================================
// 🔒 SECURITY INPUT VALIDATION SCHEMAS
// ==============================================

// Password change schema - Enhanced security validation
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().optional(), // Optional for first-time password setup
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    action: z.enum(['change', 'setup']).optional(), // Optional action field to distinguish between setup and change
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const serverCreationSchema = z.object({
  name: z.string().min(1, {
    message: 'Server name is required.',
  }),
  imageUrl: z.string().min(1, {
    message: 'Server image is required.',
  }),
});

export const serverUpdateSchema = z.object({
  name: z.string().min(1, {
    message: 'Server name is required.',
  }),
  imageUrl: z.string().min(1, {
    message: 'Server image is required.',
  }),
});

export const channelSchema = z.object({
  name: z.string().min(1, {
    message: 'Channel name is required.',
  }),
  type: z.enum(['TEXT']),
});

export const memberRoleSchema = z.object({
  memberId: z.string(),
  role: z.enum(['GUEST', 'MODERATOR']),
});

export const notificationActionSchema = z.object({
  action: z.enum(['mark_read', 'mark_all_read', 'delete', 'create']),
  notificationId: z.string().optional(),
  // Fields for creating notifications
  type: z
    .enum([
      'MESSAGE',
      'MENTION',
      'SERVER_UPDATE',
      'FRIEND_REQUEST',
      'SYSTEM',
      'PAYMENT',
      'SECURITY',
    ])
    .optional(),
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(1000).optional(),
  actionUrl: z
    .string()
    .optional()
    .refine(
      url =>
        !url ||
        (!url.includes('💬') &&
          !url.includes('%F0%9F%92%AC') &&
          url.startsWith('/')),
      { message: 'Action URL must be a valid path and cannot contain emojis' }
    ),
});

export const revokeAccessSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const subscriptionActivationSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  paymentData: z
    .object({
      amount: z.number().optional(),
      currency: z.string().optional(),
      paymentMethod: z.string().optional(),
    })
    .optional(),
});

export const subscriptionCancelSchema = z.object({
  password: z.string().optional(),
  confirmCancel: z.boolean().optional(),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const autoRenewalSchema = z.object({
  autoRenew: z.boolean(),
});

// Legacy schemas for backward compatibility
export const cuidSchema = z
  .string()
  .regex(/^c[a-z0-9]{24}$/, 'Invalid ID format');

// ==============================================
// 🛡️ VALIDATION MIDDLEWARE
// ==============================================

export function validateInput<T>(schema: z.ZodSchema<T>) {
  return async (
    request: NextRequest
  ): Promise<
    { success: true; data: T } | { success: false; error: NextResponse }
  > => {
    try {
      const body = await request.json();
      const validatedData = schema.parse(body);

      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return {
          success: false,
          error: NextResponse.json(
            {
              error: 'Validation failed',
              details: errors,
              message: 'Invalid input data provided',
            },
            { status: 400 }
          ),
        };
      }

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Invalid request format',
            message: 'Request body must be valid JSON',
          },
          { status: 400 }
        ),
      };
    }
  };
}

// Security analysis interface
interface SecurityAnalysisResult {
  clean: string;
  threats: string[];
  safe: boolean;
}

// Enhanced secure text input validation with threat analysis
export const secureTextInput = (
  input: string,
  maxLength: number = 1000
): SecurityAnalysisResult => {
  if (typeof input !== 'string') {
    return {
      clean: '',
      threats: ['INVALID_INPUT_TYPE'],
      safe: false,
    };
  }

  const threats: string[] = [];

  // Check for common XSS patterns
  if (/<script|javascript:|vbscript:|on\w+\s*=/i.test(input)) {
    threats.push('XSS_PATTERN');
  }

  // Check for SQL injection patterns
  if (/(union|select|insert|delete|drop|update|or\s+1=1|['"]|;)/i.test(input)) {
    threats.push('SQL_INJECTION');
  }

  // Check for path traversal
  if (/\.\.|\/\.\.|\\\.\./.test(input)) {
    threats.push('PATH_TRAVERSAL');
  }

  // Check for command injection
  if (/(\||&|;|`|\$\(|&&|\|\|)/.test(input)) {
    threats.push('COMMAND_INJECTION');
  }

  const cleaned = input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"'&]/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' '); // Normalize whitespace

  return {
    clean: cleaned,
    threats,
    safe: threats.length === 0,
  };
};

// ==============================================
// 🛡️ FILE UPLOAD SECURITY FUNCTIONS
// ==============================================

interface FileValidationResult {
  safe: boolean;
  threats: string[];
  maxAllowedSize: number;
}

interface VirusScanResult {
  clean: boolean;
  threats: string[];
  scanTime: number;
  confidence: number;
}

interface RateLimit {
  allowed: boolean;
  reason?: string;
}

// File upload validation function
export const validateFileUploadAdvanced = (file: {
  name: string;
  size: number;
  type: string;
}): FileValidationResult => {
  const threats: string[] = [];
  const maxSize = 10 * 1024 * 1024; // 10MB max

  // Check file size
  if (file.size > maxSize) {
    threats.push('FILE_TOO_LARGE');
  }

  // Check dangerous file types
  const dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
  ];
  const fileExtension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf('.'));

  if (dangerousExtensions.includes(fileExtension)) {
    threats.push('DANGEROUS_FILE_TYPE');
  }

  // Check MIME type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
  ];

  if (!allowedMimeTypes.includes(file.type)) {
    threats.push('INVALID_FILE_EXTENSION');
  }

  return {
    safe: threats.length === 0,
    threats,
    maxAllowedSize: maxSize,
  };
};

// Simulated virus scan function
export const simulateVirusScan = async (file: {
  name: string;
  size: number;
  type: string;
}): Promise<VirusScanResult> => {
  // Simulate scan time
  const scanTime = Math.random() * 1000 + 500; // 500-1500ms
  await new Promise(resolve => setTimeout(resolve, scanTime));

  // Check for suspicious patterns in filename
  const suspiciousPatterns = ['trojan', 'virus', 'malware', 'keylog'];
  const fileName = file.name.toLowerCase();
  const threats: string[] = [];

  for (const pattern of suspiciousPatterns) {
    if (fileName.includes(pattern)) {
      threats.push(`SUSPICIOUS_FILENAME_${pattern.toUpperCase()}`);
    }
  }

  // Simulate occasional false positives for very large files
  const confidence = threats.length > 0 ? 0.9 : 0.95;

  return {
    clean: threats.length === 0,
    threats,
    scanTime: Math.round(scanTime),
    confidence,
  };
};

// Upload rate limiting function
export const validateUploadRate = (
  userId: string,
  fileCount: number
): RateLimit => {
  // Simple in-memory rate limiting (in production, use Redis or database)
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxUploads = 10; // Max 10 uploads per minute

  // For now, always allow uploads (you can implement proper rate limiting here)
  return {
    allowed: true,
  };
};
