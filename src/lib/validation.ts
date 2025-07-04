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

// Message validation schemas
export const messageSchema = z.object({
  content: z.string().min(1),
});

export const messageFileSchema = z.object({
  fileUrl: z.string().min(1),
  content: z.string(),
});

// Chat query schema
export const chatQuerySchema = z.object({
  cursor: z.string().optional(),
  channelId: z.string(),
});

// Direct message query schema
export const directMessageQuerySchema = z.object({
  cursor: z.string().optional(),
  conversationId: z.string(),
});

// Server management schemas
export const serverSchema = z.object({
  name: z.string().min(1, {
    message: 'Server name is required.',
  }),
  imageUrl: z.string().min(1, {
    message: 'Server image is required.',
  }),
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

// Member management schemas
export const memberIdSchema = z.object({
  memberId: z.string(),
});

export const memberRoleSchema = z.object({
  memberId: z.string(),
  role: z.enum(['GUEST', 'MODERATOR']),
});

// Profile schemas
export const profileSchema = z.object({
  name: z.string().min(1, 'Display name is required'),
  imageUrl: z.string().optional(),
});

export const userDetailsSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  username: z.string().min(1, 'Username is required'),
});

// Rate limiting schemas
export const rateLimitSchema = z.object({
  identifier: z.string(),
  limit: z.number().positive(),
  window: z.number().positive(),
});

// Notification schemas
export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  soundEnabled: z.boolean(),
});

export const notificationActionSchema = z.object({
  action: z.enum(['mark_read', 'mark_all_read', 'delete']),
  notificationId: z.string().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// Admin schemas
export const adminActionSchema = z.object({
  userId: z.string(),
  action: z.enum(['grant', 'revoke']),
});

export const userManagementSchema = z.object({
  userId: z.string(),
  action: z.enum([
    'delete',
    'toggleAdmin',
    'grantSubscription',
    'cancelSubscription',
  ]),
});

export const revokeAccessSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
});

// File upload schemas
export const fileUploadSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().max(4 * 1024 * 1024), // 4MB limit
  fileType: z.string(),
});

// Product subscription schema
export const productSubscriptionSchema = z.object({
  allowedProductIds: z
    .array(z.string())
    .min(1, 'At least one product ID is required'),
});

// Subscription schemas
export const subscriptionSchema = z.object({
  planId: z.string(),
  interval: z.enum(['month', 'year']),
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

export const couponSchema = z.object({
  code: z.string().min(1),
  percentOff: z.number().min(1).max(100),
  duration: z.enum(['once', 'repeating', 'forever']),
  durationInMonths: z.number().optional(),
});

// Legacy schemas for backward compatibility
export const cuidSchema = z
  .string()
  .regex(/^c[a-z0-9]{24}$/, 'Invalid ID format');

export const serverIdSchema = z.object({
  serverId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid server ID format'),
});

export const channelIdSchema = z.object({
  channelId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid channel ID format'),
  serverId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid server ID format'),
});

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

// Helper functions
export const validateInputSimple = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T => {
  return schema.parse(data);
};

export const sanitizeTextInput = (
  input: string,
  maxLength: number = 1000
): string => {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"'&]/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' '); // Normalize whitespace
};

// Security analysis interface
export interface SecurityAnalysisResult {
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

export interface FileValidationResult {
  safe: boolean;
  threats: string[];
  maxAllowedSize: number;
}

export interface VirusScanResult {
  clean: boolean;
  threats: string[];
  scanTime: number;
  confidence: number;
}

export interface RateLimit {
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
