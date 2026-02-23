import { Request, Response, NextFunction } from 'express';

/**
 * Security middleware to protect against common web vulnerabilities
 */

// Dangerous patterns that should be blocked
const DANGEROUS_PATTERNS = [
  /\$\{[^}]*\}/g, // Template literals ${...}
  /\$\{[^}]*\$\{[^}]*\}/g, // Nested templates
  /\$\{[^}]*:[^}]*\}/g, // Template with colons (common in attacks)
  /\$\{[^}]*env[^}]*\}/gi, // Environment variable access
  /\$\{[^}]*lower[^}]*\}/gi, // String manipulation functions
  /\$\{[^}]*upper[^}]*\}/gi, // String manipulation functions
  /%24%7B[^}]*%7D/g, // URL-encoded template literals
  /javascript:/gi, // JavaScript protocol
  /data:/gi, // Data protocol
  /vbscript:/gi, // VBScript protocol
  /onload=/gi, // Event handlers
  /onerror=/gi, // Event handlers
  /onmouseover=/gi, // Event handlers
  /onclick=/gi, // Event handlers
  /<script/gi, // Script tags
  /<\/script>/gi, // Script tags
  /javascript:void/gi, // JavaScript void
  /expression\s*\(/gi, // CSS expressions
  /vbscript:/gi, // VBScript
  /data:text\/html/gi, // Data URLs
  /data:text\/javascript/gi, // JavaScript data URLs
  /alert\s*\(/gi, // JavaScript alerts (common in XSS tests)
  /confirm\s*\(/gi, // JavaScript confirms
  /prompt\s*\(/gi, // JavaScript prompts
  /eval\s*\(/gi, // JavaScript eval
  /Function\s*\(/gi, // JavaScript Function constructor
  /setTimeout\s*\(/gi, // JavaScript setTimeout
  /setInterval\s*\(/gi, // JavaScript setInterval
];

// ONVIF and IoT device patterns
const IOT_PATTERNS = [
  /onvif/gi,
  /device_service/gi,
  /camera/gi,
  /ipcamera/gi,
  /rtsp:\/\//gi,
  /rtmp:\/\//gi,
];

// Internal IP ranges that should be blocked for SSRF protection
const INTERNAL_IP_RANGES = [
  /^127\./, // localhost
  /^10\./, // private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
  /^192\.168\./, // private class C
  /^169\.254\./, // link-local
  /^0\./, // invalid
  /^224\./, // multicast
  /^239\./, // multicast
  /^255\./, // broadcast
];

/**
 * Check if an IP address is internal/private
 */
function isInternalIP(ip: string): boolean {
  return INTERNAL_IP_RANGES.some(range => range.test(ip));
}

/**
 * Check if a URL contains internal IP addresses
 */
function containsInternalIP(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return isInternalIP(urlObj.hostname);
  } catch {
    // If URL parsing fails, check for IP patterns in the string
    const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    const ips = url.match(ipPattern);
    return ips ? ips.some(ip => isInternalIP(ip)) : false;
  }
}

/**
 * Validate and sanitize input parameters
 */
export function validateInput(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Check for dangerous patterns
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(value)) {
            console.error(`[SECURITY] Blocked dangerous pattern in query param "${key}": ${value} from ${clientIP}`);
            return res.status(400).json({
              error: 'dangerous_input_detected',
              message: 'Invalid input detected'
            });
          }
        }

        // Check for ONVIF/IoT patterns
        for (const pattern of IOT_PATTERNS) {
          if (pattern.test(value)) {
            console.error(`[SECURITY] Blocked IoT/IoT pattern in query param "${key}": ${value} from ${clientIP}`);
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Access denied'
            });
          }
        }

        // Check for internal IPs (SSRF protection)
        if (containsInternalIP(value)) {
          console.error(`[SECURITY] Blocked internal IP access in query param "${key}": ${value} from ${clientIP}`);
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied'
          });
        }
      }
    }

    // Check URL parameters
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        // Check for dangerous patterns
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(value)) {
            console.error(`[SECURITY] Blocked dangerous pattern in URL param "${key}": ${value} from ${clientIP}`);
            return res.status(400).json({
              error: 'dangerous_input_detected',
              message: 'Invalid input detected'
            });
          }
        }

        // Check for ONVIF/IoT patterns
        for (const pattern of IOT_PATTERNS) {
          if (pattern.test(value)) {
            console.error(`[SECURITY] Blocked IoT pattern in URL param "${key}": ${value} from ${clientIP}`);
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Access denied'
            });
          }
        }
      }
    }

    // Check request body (if JSON)
    if (req.body && typeof req.body === 'object') {
      const checkObject = (obj: any, path = ''): boolean => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (typeof value === 'string') {
            // Check for dangerous patterns
            for (const pattern of DANGEROUS_PATTERNS) {
              if (pattern.test(value)) {
                console.error(`[SECURITY] Blocked dangerous pattern in body "${currentPath}": ${value} from ${clientIP}`);
                return false;
              }
            }

            // Check for ONVIF/IoT patterns
            for (const pattern of IOT_PATTERNS) {
              if (pattern.test(value)) {
                console.error(`[SECURITY] Blocked IoT pattern in body "${currentPath}": ${value} from ${clientIP}`);
                return false;
              }
            }

            // Check for internal IPs (SSRF protection)
            if (containsInternalIP(value)) {
              console.error(`[SECURITY] Blocked internal IP access in body "${currentPath}": ${value} from ${clientIP}`);
              return false;
            }
          } else if (typeof value === 'object' && value !== null) {
            if (!checkObject(value, currentPath)) {
              return false;
            }
          }
        }
        return true;
      };

      if (!checkObject(req.body)) {
        return res.status(400).json({
          error: 'dangerous_input_detected',
          message: 'Invalid input detected'
        });
      }
    }

    // Check headers for dangerous patterns
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(value)) {
            console.error(`[SECURITY] Blocked dangerous pattern in header "${key}": ${value} from ${clientIP}`);
            return res.status(400).json({
              error: 'dangerous_input_detected',
              message: 'Invalid input detected'
            });
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error('[SECURITY] Error in input validation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Validation error'
    });
  }
}

/**
 * Enhanced security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Request logging for security monitoring
 */
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const timestamp = new Date().toISOString();

  // Log suspicious patterns
  const url = req.originalUrl;
  const suspicious = DANGEROUS_PATTERNS.some(pattern => pattern.test(url)) ||
                    IOT_PATTERNS.some(pattern => pattern.test(url));

  if (suspicious) {
    console.warn(`[SECURITY ALERT] Suspicious request: ${req.method} ${url} from ${clientIP} UA: ${userAgent}`);
  }

  // Log all requests for monitoring (could be rate limited in production)
  console.log(`[REQUEST] ${timestamp} ${req.method} ${url} ${clientIP}`);

  next();
}
