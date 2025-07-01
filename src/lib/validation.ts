import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// ==============================================
// 🔒 SECURITY INPUT VALIDATION SCHEMAS
// ==============================================

// Password validation schema
export const passwordSchema = z.object({
  action: z.enum(['set', 'change', 'add'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be set, change, or add',
  }),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^\w\s]/, 'Password must contain at least one special character'),
  currentPassword: z.string().max(128).optional(),
  twoFactorCode: z
    .string()
    .regex(/^\d{6}$/, 'Two-factor code must be exactly 6 digits')
    .optional(),
  use2FA: z.boolean().optional(),
});

// 2FA validation schemas
export const twoFactorSetupSchema = z.object({
  secret: z
    .string()
    .min(16, 'Secret must be at least 16 characters')
    .max(256, 'Secret too long')
    .regex(/^[A-Z2-7]+$/, 'Invalid secret format'),
});

export const twoFactorCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

// ✅ NEW: 2FA verify-login schema
export const twoFactorLoginSchema = z.object({
  code: z
    .string()
    .regex(
      /^[A-Z0-9]{6,10}$/,
      'Code must be 6-10 alphanumeric characters (TOTP or backup code)'
    ),
});

// ✅ NEW: Notification action schema
export const notificationActionSchema = z
  .object({
    action: z.enum(['mark_read', 'mark_all_read', 'delete'], {
      required_error: 'Action is required',
      invalid_type_error: 'Invalid notification action',
    }),
    notificationId: z
      .string()
      .uuid('Invalid notification ID format')
      .optional(),
  })
  .refine(
    data => {
      // If action is mark_read or delete, notificationId is required
      if (
        (data.action === 'mark_read' || data.action === 'delete') &&
        !data.notificationId
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Notification ID is required for this action',
      path: ['notificationId'],
    }
  );

// ✅ NEW: Revoke access schema
export const revokeAccessSchema = z.object({
  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(500, 'Reason must not exceed 500 characters')
    .transform(str => str.trim()),
});

// ✅ NEW: Subscription activation schema
export const subscriptionActivationSchema = z.object({
  paymentId: z
    .string()
    .min(1, 'Payment ID is required')
    .max(255, 'Payment ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid payment ID format'),
  paymentData: z
    .object({
      amount: z
        .number()
        .positive('Amount must be positive')
        .max(999999.99, 'Amount too large'),
      currency: z
        .string()
        .length(3, 'Currency must be 3 characters')
        .regex(/^[A-Z]{3}$/, 'Invalid currency format'),
      paymentMethod: z.enum(['stripe', 'paypal', 'manual'], {
        invalid_type_error: 'Invalid payment method',
      }),
    })
    .optional(),
});

// ✅ NEW: Auto-renewal toggle schema
export const autoRenewalSchema = z.object({
  autoRenew: z.boolean({
    required_error: 'AutoRenew setting is required',
    invalid_type_error: 'AutoRenew must be true or false',
  }),
});

// ✅ NEW: Subscription cancellation schema
export const subscriptionCancelSchema = z.object({
  password: z
    .string()
    .min(1, 'Password confirmation is required for cancellation')
    .max(128, 'Password too long'),
  confirmCancel: z
    .boolean({
      required_error: 'Cancellation confirmation is required',
    })
    .refine(val => val === true, {
      message: 'You must confirm the cancellation',
    }),
  reason: z.string().max(1000, 'Cancellation reason too long').optional(),
});

// Admin operations validation
export const adminActionSchema = z.object({
  action: z.enum(['grant', 'revoke'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be grant or revoke',
  }),
  targetUserId: z.string().uuid('Invalid user ID format').optional(),
  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(500, 'Reason must not exceed 500 characters')
    .optional(),
});

// Product subscription validation
export const productSubscriptionSchema = z.object({
  allowedProductIds: z
    .array(
      z
        .string()
        .regex(/^prod_[a-zA-Z0-9]+$/, 'Invalid Stripe product ID format')
    )
    .min(1, 'At least one product ID is required')
    .max(10, 'Too many product IDs'),
});

// File upload validation (for metadata)
export const fileUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid file name characters'),
  fileSize: z
    .number()
    .positive('File size must be positive')
    .max(10 * 1024 * 1024, 'File too large (max 10MB)'), // 10MB limit
  fileType: z.enum(
    ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    {
      invalid_type_error: 'Unsupported file type',
    }
  ),
});

// Subscription management validation
export const subscriptionActionSchema = z.object({
  action: z.enum(['cancel', 'toggle-autorenew'], {
    required_error: 'Action is required',
  }),
  password: z
    .string()
    .min(1, 'Password is required for sensitive operations')
    .max(128, 'Password too long')
    .optional(),
  confirmCancel: z.boolean().optional(),
  autoRenew: z.boolean().optional(),
});

// Generic text input sanitization
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

// Generic email validation
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(320, 'Email too long') // RFC 5321 limit
  .transform(email => email.toLowerCase().trim());

// ✅ SECURITY: Server creation validation schema
export const serverCreationSchema = z.object({
  name: z
    .string()
    .min(1, 'Server name is required')
    .max(50, 'Server name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Server name contains invalid characters')
    .transform(str => str.trim()),
  imageUrl: z
    .string()
    .url('Invalid image URL')
    .max(500, 'Image URL too long')
    .optional()
    .or(z.literal('')),
});

// ✅ SECURITY: Server update validation schema
export const serverUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Server name is required')
    .max(50, 'Server name must be less than 50 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Server name contains invalid characters')
    .transform(str => str.trim()),
  imageUrl: z
    .string()
    .url('Invalid image URL')
    .max(500, 'Image URL too long')
    .optional()
    .or(z.literal('')),
});

// ✅ SECURITY: Channel creation/update validation schema
export const channelSchema = z.object({
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(30, 'Channel name must be less than 30 characters')
    .regex(
      /^[a-z0-9\-_]+$/,
      'Channel name must be lowercase with hyphens/underscores only'
    )
    .transform(str => str.toLowerCase().trim())
    .refine(name => name !== 'general', 'Channel name cannot be "general"'),
  type: z.enum(['TEXT', 'AUDIO', 'VIDEO'], {
    errorMap: () => ({ message: 'Invalid channel type' }),
  }),
});

// ✅ SECURITY: Member role update validation schema
export const memberRoleSchema = z.object({
  role: z.enum(['GUEST', 'MODERATOR', 'ADMIN'], {
    errorMap: () => ({ message: 'Invalid member role' }),
  }),
});

// ✅ SECURITY: CUID validation for params (database uses CUID, not UUID)
export const cuidSchema = z
  .string()
  .regex(/^c[a-z0-9]{24}$/, 'Invalid ID format');

// ✅ SECURITY: Server ID validation for query params
export const serverIdSchema = z.object({
  serverId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid server ID format'),
});

// ✅ SECURITY: Member ID validation for query params
export const memberIdSchema = z.object({
  memberId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid member ID format'),
  serverId: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid server ID format'),
});

// ✅ SECURITY: Channel ID validation for query params
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

// ==============================================
// 🔍 SECURITY VALIDATION HELPERS
// ==============================================

// Check for SQL injection patterns
export const detectSQLInjection = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(--|\/\*|\*\/|;|'|")/,
    /(\bOR\b|\bAND\b).*(\=|\<|\>)/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
};

// Check for XSS patterns
export const detectXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object[^>]*>.*?<\/object>/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};

// Advanced input sanitization
export const secureTextInput = (
  input: string
): { clean: string; threats: string[] } => {
  const threats: string[] = [];
  let clean = input;

  if (detectSQLInjection(input)) {
    threats.push('SQL_INJECTION');
  }

  if (detectXSS(input)) {
    threats.push('XSS_ATTEMPT');
  }

  // Remove dangerous patterns
  clean = clean
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>\"'&]/g, '')
    .trim();

  return { clean, threats };
};

// Validate file upload security
export const validateFileUpload = (file: {
  name: string;
  size: number;
  type: string;
}) => {
  const threats: string[] = [];

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
  const fileExtension = file.name.toLowerCase().split('.').pop();

  if (!fileExtension || !allowedExtensions.includes(`.${fileExtension}`)) {
    threats.push('INVALID_FILE_EXTENSION');
  }

  // Check MIME type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
  ];
  if (!allowedMimeTypes.includes(file.type)) {
    threats.push('INVALID_MIME_TYPE');
  }

  // Check for dangerous file names
  const dangerousPatterns = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.com$/i,
    /\.pif$/i,
    /\.scr$/i,
    /\.js$/i,
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i,
  ];

  if (dangerousPatterns.some(pattern => pattern.test(file.name))) {
    threats.push('DANGEROUS_FILE_TYPE');
  }

  return { threats, safe: threats.length === 0 };
};

// ==============================================
// 🛡️ ENHANCED FILE UPLOAD SECURITY
// ==============================================

// Advanced file upload validation with comprehensive security checks
export const validateFileUploadAdvanced = (file: {
  name: string;
  size: number;
  type: string;
  content?: Buffer | Uint8Array;
}) => {
  const threats: string[] = [];
  const warnings: string[] = [];

  // ✅ SECURITY: File extension validation
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'];
  const fileExtension = file.name.toLowerCase().split('.').pop();

  if (!fileExtension || !allowedExtensions.includes(`.${fileExtension}`)) {
    threats.push('INVALID_FILE_EXTENSION');
  }

  // ✅ SECURITY: MIME type validation with strict checking
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
  ];

  if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
    threats.push('INVALID_MIME_TYPE');
  }

  // ✅ SECURITY: MIME type and extension consistency check
  const mimeExtensionMap: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/jpg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'application/pdf': ['.pdf'],
  };

  const expectedExtensions = mimeExtensionMap[file.type.toLowerCase()];
  if (expectedExtensions && !expectedExtensions.includes(`.${fileExtension}`)) {
    threats.push('MIME_EXTENSION_MISMATCH');
  }

  // ✅ SECURITY: File size validation with strict limits
  const maxSizes: Record<string, number> = {
    'image/jpeg': 5 * 1024 * 1024, // 5MB for JPEG
    'image/jpg': 5 * 1024 * 1024, // 5MB for JPG
    'image/png': 8 * 1024 * 1024, // 8MB for PNG (can be larger)
    'image/gif': 10 * 1024 * 1024, // 10MB for GIF (animations)
    'application/pdf': 15 * 1024 * 1024, // 15MB for PDF
  };

  const maxAllowedSize = maxSizes[file.type.toLowerCase()] || 2 * 1024 * 1024; // 2MB default

  if (file.size > maxAllowedSize) {
    threats.push('FILE_TOO_LARGE');
  }

  if (file.size === 0) {
    threats.push('EMPTY_FILE');
  }

  // ✅ SECURITY: Dangerous file name patterns
  const dangerousPatterns = [
    // Executable files
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.com$/i,
    /\.pif$/i,
    /\.scr$/i,
    // Script files
    /\.js$/i,
    /\.vbs$/i,
    /\.ps1$/i,
    /\.sh$/i,
    // Web files that could contain code
    /\.php$/i,
    /\.asp$/i,
    /\.aspx$/i,
    /\.jsp$/i,
    /\.pl$/i,
    /\.py$/i,
    // Archive files (could contain malware)
    /\.zip$/i,
    /\.rar$/i,
    /\.7z$/i,
    /\.tar$/i,
    /\.gz$/i,
    // Other potentially dangerous files
    /\.dll$/i,
    /\.sys$/i,
    /\.reg$/i,
    /\.msi$/i,
  ];

  if (dangerousPatterns.some(pattern => pattern.test(file.name))) {
    threats.push('DANGEROUS_FILE_TYPE');
  }

  // ✅ SECURITY: Suspicious file name patterns
  const suspiciousPatterns = [
    /virus/i,
    /malware/i,
    /trojan/i,
    /backdoor/i,
    /keylog/i,
    /\.exe\./i, // Double extensions
    /\s+\.(exe|bat|cmd)$/i, // Space before dangerous extension
    /[^\x20-\x7E]/, // Non-printable characters
    /\x00/, // Null bytes
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.name))) {
    threats.push('SUSPICIOUS_FILE_NAME');
  }

  // ✅ SECURITY: File name length validation
  if (file.name.length > 255) {
    threats.push('FILE_NAME_TOO_LONG');
  }

  if (file.name.length < 1) {
    threats.push('EMPTY_FILE_NAME');
  }

  // ✅ SECURITY: Reserved file names (Windows)
  const reservedNames = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ];

  const baseName = file.name.split('.')[0].toUpperCase();
  if (reservedNames.includes(baseName)) {
    threats.push('RESERVED_FILE_NAME');
  }

  // ✅ SECURITY: Content-based validation (if content is provided)
  if (file.content) {
    const contentThreats = analyzeFileContent(file.content, file.type);
    threats.push(...contentThreats);
  }

  return {
    threats,
    warnings,
    safe: threats.length === 0,
    maxAllowedSize,
    actualSize: file.size,
  };
};

// ✅ SECURITY: File content analysis for virus/malware patterns
export const analyzeFileContent = (
  content: Buffer | Uint8Array,
  mimeType: string
): string[] => {
  const threats: string[] = [];
  const contentBuffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(content);

  // Convert to string for pattern matching (first 2KB for performance)
  const contentString = contentBuffer.slice(0, 2048).toString('binary');
  const contentHex = contentBuffer.slice(0, 1024).toString('hex');

  // ✅ SECURITY: Magic number validation
  const magicNumbers: Record<string, string[]> = {
    'image/jpeg': ['ffd8ff'],
    'image/png': ['89504e47'],
    'image/gif': ['474946383761', '474946383961'], // GIF87a, GIF89a
    'application/pdf': ['255044462d'],
  };

  const expectedMagic = magicNumbers[mimeType.toLowerCase()];
  if (expectedMagic) {
    const fileHeader = contentHex.slice(0, 12).toLowerCase();
    const isValidMagic = expectedMagic.some(magic =>
      fileHeader.startsWith(magic)
    );

    if (!isValidMagic) {
      threats.push('INVALID_FILE_SIGNATURE');
    }
  }

  // ✅ SECURITY: Suspicious content patterns
  const malwarePatterns = [
    // Common malware signatures (simplified for demo)
    /MZ\x90\x00/, // PE executable header
    /<script[\s\S]*?>[\s\S]*?<\/script>/i, // Embedded scripts
    /eval\s*\(/i, // JavaScript eval
    /document\.write/i, // Document.write
    /shell_exec/i, // PHP shell execution
    /system\s*\(/i, // System calls
    /exec\s*\(/i, // Exec calls
    /__import__/i, // Python imports
    /FromBase64String/i, // Base64 decoding (potential payload)
    /cmd\.exe/i, // Command prompt references
    /powershell/i, // PowerShell references
  ];

  if (malwarePatterns.some(pattern => pattern.test(contentString))) {
    threats.push('SUSPICIOUS_CONTENT_DETECTED');
  }

  // ✅ SECURITY: Polyglot file detection (files that are valid in multiple formats)
  if (mimeType.startsWith('image/')) {
    // Check for embedded scripts in images
    if (/<script|javascript:|on\w+\s*=/i.test(contentString)) {
      threats.push('POLYGLOT_FILE_DETECTED');
    }

    // Check for unusual metadata
    if (/<%|<\?php|\x00\x00\x00\x00JFIF/i.test(contentString)) {
      threats.push('SUSPICIOUS_IMAGE_METADATA');
    }
  }

  // ✅ SECURITY: Check for ZIP bomb patterns in PDF
  if (mimeType === 'application/pdf') {
    // Look for suspicious PDF structures
    if (/\/JavaScript|\/JS|\/OpenAction/i.test(contentString)) {
      threats.push('PDF_WITH_JAVASCRIPT');
    }

    if (/\/EmbeddedFile|\/FileAttachment/i.test(contentString)) {
      threats.push('PDF_WITH_EMBEDDED_FILES');
    }
  }

  return threats;
};

// ✅ SECURITY: Simulated virus scanning (replace with real antivirus API in production)
export const simulateVirusScan = async (file: {
  name: string;
  size: number;
  type: string;
  content?: Buffer | Uint8Array;
}): Promise<{
  clean: boolean;
  threats: string[];
  scanTime: number;
  confidence: number;
}> => {
  const startTime = Date.now();
  const threats: string[] = [];

  // Simulate scanning delay (0.5-2 seconds)
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

  // ✅ SECURITY: Simulated threat detection based on file characteristics
  const fileName = file.name.toLowerCase();
  const suspiciousKeywords = [
    'virus',
    'malware',
    'trojan',
    'backdoor',
    'keylog',
    'rootkit',
    'ransomware',
    'spyware',
    'adware',
    'worm',
    'botnet',
  ];

  // Check for suspicious file names
  if (suspiciousKeywords.some(keyword => fileName.includes(keyword))) {
    threats.push('SUSPICIOUS_FILENAME_DETECTED');
  }

  // Simulate hash-based detection (in real implementation, use actual antivirus APIs)
  const fileHash = generateFileHash(file.name + file.size + file.type);
  const knownMalwareHashes = [
    '5d41402abc4b2a76b9719d911017c592', // Example hash
    'aab4c61ddcc5e8a2dabede0f3b482cd9',
    'e99a18c428cb38d5f260853678922e03',
  ];

  if (knownMalwareHashes.includes(fileHash)) {
    threats.push('KNOWN_MALWARE_HASH');
  }

  // ✅ SECURITY: Content-based threat detection
  if (file.content) {
    const contentThreats = analyzeFileContent(file.content, file.type);
    threats.push(...contentThreats);
  }

  const scanTime = Date.now() - startTime;
  const confidence = Math.random() * 0.2 + 0.8; // 80-100% confidence

  return {
    clean: threats.length === 0,
    threats,
    scanTime,
    confidence,
  };
};

// ✅ SECURITY: Generate simple hash for demonstration (use proper hashing in production)
const generateFileHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

// ✅ SECURITY: File upload rate limiting validation
export const validateUploadRate = (
  userId: string,
  fileCount: number = 1
): {
  allowed: boolean;
  reason?: string;
  resetTime?: Date;
} => {
  // This would typically use a database or Redis in production
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  // Simulated rate limits
  const limits = {
    filesPerHour: 20,
    filesPerDay: 100,
    totalSizePerDay: 100 * 1024 * 1024, // 100MB per day
  };

  // In production, check actual upload history from database
  // For now, return allowed with warnings for demo
  if (fileCount > 10) {
    return {
      allowed: false,
      reason: 'Too many files in single upload',
      resetTime: new Date(now + hourMs),
    };
  }

  return { allowed: true };
};

export default {
  passwordSchema,
  twoFactorSetupSchema,
  twoFactorCodeSchema,
  twoFactorLoginSchema,
  notificationActionSchema,
  revokeAccessSchema,
  subscriptionActivationSchema,
  autoRenewalSchema,
  subscriptionCancelSchema,
  adminActionSchema,
  productSubscriptionSchema,
  fileUploadSchema,
  subscriptionActionSchema,
  emailSchema,
  cuidSchema,
  serverIdSchema,
  memberIdSchema,
  channelIdSchema,
  validateInput,
  sanitizeTextInput,
  secureTextInput,
  validateFileUpload,
  validateFileUploadAdvanced,
  analyzeFileContent,
  simulateVirusScan,
  validateUploadRate,
  detectSQLInjection,
  detectXSS,
};
