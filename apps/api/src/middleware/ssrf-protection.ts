import { Request, Response, NextFunction } from 'express';

/**
 * SSRF (Server-Side Request Forgery) Protection Middleware
 * Blocks attempts to access internal networks and services
 */

const DANGEROUS_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
  'metadata.azure.com', // Azure metadata
  'instance-data.ec2.internal', // AWS EC2 metadata
  'api.service.internal', // Internal service discovery
  'internal.api', // Internal API
  'kubernetes.default.svc', // Kubernetes internal
  'docker.for.mac.host.internal', // Docker for Mac
  'docker.for.win.host.internal', // Docker for Windows
  'host.docker.internal', // Docker host
];

const ALLOWED_DOMAINS = [
  // Add your allowed external domains here
  'api.example.com',
  'cdn.example.com',
  // Add more as needed
];

const ALLOWED_PORTS = [
  80,  // HTTP
  443, // HTTPS
  // Add other allowed ports as needed
];

/**
 * Check if a hostname is dangerous
 */
function isDangerousHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  // Check dangerous domains
  if (DANGEROUS_DOMAINS.some(domain => lowerHostname.includes(domain))) {
    return true;
  }

  // Check for internal IP patterns (already handled in security.ts)
  // This is additional domain-based checking

  return false;
}

/**
 * Check if a port is allowed
 */
function isAllowedPort(port: number): boolean {
  return ALLOWED_PORTS.includes(port);
}

/**
 * Enhanced URL validation for SSRF protection
 */
function validateUrlForSSRF(url: string): { valid: boolean; reason?: string } {
  try {
    const urlObj = new URL(url);

    // Block dangerous hostnames
    if (isDangerousHostname(urlObj.hostname)) {
      return { valid: false, reason: 'Dangerous hostname blocked' };
    }

    // Check if port is specified and allowed
    if (urlObj.port && !isAllowedPort(parseInt(urlObj.port))) {
      return { valid: false, reason: `Port ${urlObj.port} not allowed` };
    }

    // For HTTPS-only policy
    if (urlObj.protocol !== 'https:') {
      return { valid: false, reason: 'Only HTTPS URLs allowed' };
    }

    // Check against whitelist (if configured)
    if (ALLOWED_DOMAINS.length > 0) {
      const isAllowed = ALLOWED_DOMAINS.some(domain =>
        urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
      );
      if (!isAllowed) {
        return { valid: false, reason: 'Domain not in whitelist' };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/**
 * SSRF Protection Middleware
 */
export function ssrfProtection(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    // Check all URL-like parameters for SSRF
    const checkValue = (value: string, context: string): boolean => {
      if (!value || typeof value !== 'string') return true;

      // Check for URL patterns
      const urlPatterns = [
        /^https?:\/\/[^\s]+/i,
        /^[^\s]*:\/\/[^\s]+/i, // Any protocol
      ];

      for (const pattern of urlPatterns) {
        const matches = value.match(pattern);
        if (matches) {
          for (const match of matches) {
            const validation = validateUrlForSSRF(match);
            if (!validation.valid) {
              console.error(`[SSRF BLOCKED] ${validation.reason} in ${context}: ${match} from ${clientIP}`);
              return false;
            }
          }
        }
      }

      return true;
    };

    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        if (!checkValue(value, `query.${key}`)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied - SSRF protection'
          });
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && !checkValue(item, `query.${key}[]`)) {
            return res.status(403).json({
              error: 'Forbidden',
              message: 'Access denied - SSRF protection'
            });
          }
        }
      }
    }

    // Check URL parameters
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        if (!checkValue(value, `params.${key}`)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied - SSRF protection'
          });
        }
      }
    }

    // Check request body recursively
    const checkObject = (obj: any, path: string): boolean => {
      if (typeof obj === 'string') {
        return checkValue(obj, path);
      } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (!checkObject(obj[i], `${path}[${i}]`)) {
            return false;
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (!checkObject(value, `${path}.${key}`)) {
            return false;
          }
        }
      }
      return true;
    };

    if (req.body && !checkObject(req.body, 'body')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied - SSRF protection'
      });
    }

    next();
  } catch (error) {
    console.error('[SSRF] Error in SSRF protection:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Security validation error'
    });
  }
}

/**
 * Rate limiting for security (basic implementation)
 * In production, use a proper rate limiting library like express-rate-limit
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function basicRateLimit(windowMs: number = 60000, maxRequests: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if rate limiting is globally disabled via environment variable
    // Note: For full admin toggle support, this would need to be moved to the async applyRateLimit middleware
    if (process.env.RATE_LIMITING_ENABLED === 'false') {
      return next(); // Rate limiting disabled via environment variable
    }

    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    // Get or create request count for this IP
    let clientData = requestCounts.get(clientIP);
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + windowMs };
      requestCounts.set(clientIP, clientData);
    }

    // Check rate limit
    if (clientData.count >= maxRequests) {
      console.warn(`[RATE LIMIT] Blocked ${clientIP} - exceeded ${maxRequests} requests per ${windowMs}ms`);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded'
      });
    }

    // Increment counter
    clientData.count++;

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      for (const [ip, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
          requestCounts.delete(ip);
        }
      }
    }

    next();
  };
}

/**
 * Block ONVIF and IoT-related requests
 */
export function blockIotRequests(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const url = req.originalUrl.toLowerCase();

  // Block ONVIF patterns
  if (url.includes('/onvif') ||
      url.includes('device_service') ||
      url.includes('/camera') ||
      url.includes('/ipcamera') ||
      url.includes('rtsp://') ||
      url.includes('rtmp://')) {
    console.error(`[IOT BLOCKED] IoT/IoT request blocked: ${req.method} ${req.originalUrl} from ${clientIP}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'IoT/IoT access not allowed'
    });
  }

  next();
}
