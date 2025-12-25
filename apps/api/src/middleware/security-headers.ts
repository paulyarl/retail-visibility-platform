import helmet from 'helmet';

/**
 * Security headers middleware using Helmet.js
 * Provides comprehensive security headers for all responses
 */

// Configure Helmet with comprehensive security headers
export const securityHeaders = helmet({
  // Content Security Policy - restrict resource loading
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com", "https://www.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://maps.googleapis.com", "https://www.google.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },

  // HTTP Strict Transport Security - force HTTPS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options - prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options - prevent MIME sniffing
  noSniff: true,

  // Referrer-Policy - control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Permissions-Policy - control browser features (removed - not supported in this Helmet version)
  // permissionsPolicy: {
  //   features: {
  //     camera: [],
  //     microphone: [],
  //     geolocation: [],
  //     payment: [],
  //     usb: [],
  //     magnetometer: [],
  //     accelerometer: [],
  //     gyroscope: [],
  //     ambientLightSensor: [],
  //     autoplay: [],
  //     encryptedMedia: [],
  //     fullscreen: [],
  //     pictureInPicture: [],
  //   },
  // },

  // Cross-Origin-Embedder-Policy - enable cross-origin isolation
  crossOriginEmbedderPolicy: false, // Disabled for compatibility with external services

  // Cross-Origin-Opener-Policy - isolate browsing contexts
  crossOriginOpenerPolicy: {
    policy: 'same-origin-allow-popups',
  },

  // Cross-Origin-Resource-Policy - control cross-origin resource sharing
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },

  // Origin-Agent-Cluster - isolate origins
  originAgentCluster: true,
});

// Additional custom security headers
export const additionalSecurityHeaders = (req: any, res: any, next: any) => {
  // X-DNS-Prefetch-Control - control DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // X-Download-Options - prevent downloads from executing in IE
  res.setHeader('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies - prevent Flash/PDF from loading cross-domain
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Remove X-Powered-By header to hide technology stack
  res.removeHeader('X-Powered-By');

  // Add custom server header (optional - can be removed for additional security)
  // res.setHeader('Server', 'Web Server');

  next();
};
