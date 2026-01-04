import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

/**
 * Comprehensive input validation and sanitization middleware
 * Provides additional security beyond Zod schemas
 */

// List of dangerous patterns to block
const DANGEROUS_PATTERNS = [
  /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b|\bEXEC\b|\bEXECUTE\b)/i,
  /(<script|javascript:|vbscript:|onload=|onerror=|onclick=|onmouseover=)/i,
  /(\.\.|\/etc\/passwd|\/etc\/shadow|\/proc\/|\/home\/)/i,
  /(\bNULL\b|\bnull\b)/i,
  /(-{2,}|\/\*|\*\/)/, // SQL comments
];

// File upload security
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/csv',
  'application/json',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Sanitize string input
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape HTML entities
  sanitized = validator.escape(sanitized);

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>'"&]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length to prevent buffer overflow attacks
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + '...';
  }

  return sanitized;
}

/**
 * Check for dangerous patterns in input
 */
function containsDangerousPatterns(input: any): boolean {
  if (typeof input === 'string') {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
  }

  if (typeof input === 'object' && input !== null) {
    // Recursively check objects and arrays
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        if (containsDangerousPatterns(input[key])) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Validate file upload
 */
function validateFileUpload(req: Request): { valid: boolean; error?: string } {
  const files = req.files as any;

  if (!files) return { valid: true };

  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();

  for (const file of fileArray) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return { valid: false, error: `File type ${file.mimetype} is not allowed` };
    }

    // Check filename for dangerous patterns
    if (containsDangerousPatterns(file.originalname)) {
      return { valid: false, error: 'Invalid filename' };
    }
  }

  return { valid: true };
}

/**
 * Sanitize request body, query, and params
 */
function sanitizeRequest(req: Request): void {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    }
  }

  // Sanitize route parameters
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeString(req.params[key]);
      }
    }
  }

  // Sanitize body (only for non-file uploads to avoid corrupting binary data)
  if (req.body && req.headers['content-type'] !== 'multipart/form-data') {
    sanitizeObject(req.body);
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): void {
  if (typeof obj === 'string') {
    // Don't sanitize strings here - let Zod handle validation
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach(item => sanitizeObject(item));
    return;
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Only sanitize specific fields that commonly contain user input
          const sensitiveFields = ['name', 'description', 'comment', 'message', 'title', 'content', 'email', 'phone'];
          if (sensitiveFields.includes(key.toLowerCase())) {
            obj[key] = sanitizeString(obj[key]);
          }
        } else {
          sanitizeObject(obj[key]);
        }
      }
    }
  }
}

/**
 * Main input validation and sanitization middleware
 */
export function inputValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Skip input validation for the track-batch endpoint to avoid false positives
    if (req.url === '/api/recommendations/track-batch') {
      return next();
    }

    // Check for dangerous patterns in all input
    const allInput = { ...req.query, ...req.params, ...req.body };
    if (containsDangerousPatterns(allInput)) {
      res.status(400).json({
        error: 'invalid_input',
        message: 'Request contains potentially dangerous content'
      });
      return;
    }

    // Validate file uploads if present
    if (req.method === 'POST' && req.headers['content-type']?.includes('multipart/form-data')) {
      const fileValidation = validateFileUpload(req);
      if (!fileValidation.valid) {
        res.status(400).json({
          error: 'invalid_file',
          message: fileValidation.error
        });
        return;
      }
    }

    // Sanitize input
    sanitizeRequest(req);

    // Additional security checks
    const suspiciousPatterns = [
      /eval\(/i,
      /Function\(/i,
      /setTimeout\(/i,
      /setInterval\(/i,
      /document\./i,
      /window\./i,
      /localStorage\./i,
      /sessionStorage\./i,
    ];

    const checkString = JSON.stringify({ ...req.query, ...req.params, ...req.body });
    if (suspiciousPatterns.some(pattern => pattern.test(checkString))) {
      res.status(400).json({
        error: 'suspicious_input',
        message: 'Request contains suspicious JavaScript patterns'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Input validation middleware error:', error);
    res.status(500).json({
      error: 'validation_error',
      message: 'Input validation failed'
    });
  }
}
