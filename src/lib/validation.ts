import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

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

export const subscriptionCancelSchema = z.object({
  password: z.string().optional(),
  confirmCancel: z.boolean().optional(),
  reason: z.string().max(500, 'Reason too long').optional(),
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
