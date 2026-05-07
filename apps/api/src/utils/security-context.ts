import { Request } from 'express';

/**
 * Parse User-Agent string to extract browser and device information
 */
function parseUserAgent(userAgent: string) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

  const ua = userAgent.toLowerCase();
  
  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('opera/') || ua.includes('opr/')) browser = 'Opera';
  else if (ua.includes('msie') || ua.includes('trident')) browser = 'Internet Explorer';

  // OS detection
  let os = 'Unknown';
  if (ua.includes('windows nt')) os = 'Windows';
  else if (ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('ubuntu')) os = 'Ubuntu';

  // Device detection
  let device = 'Desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = 'Tablet';
  } else if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    device = 'Bot/Crawler';
  }

  return { browser, os, device };
}

/**
 * Extract browser version from User-Agent
 */
function extractBrowserVersion(userAgent: string, browser: string) {
  if (!userAgent || browser === 'Unknown') return null;

  const ua = userAgent.toLowerCase();
  const patterns = {
    'Chrome': /chrome\/(\d+\.\d+)/,
    'Firefox': /firefox\/(\d+\.\d+)/,
    'Safari': /version\/(\d+\.\d+)/,
    'Edge': /edg\/(\d+\.\d+)/,
    'Opera': /opera\/(\d+\.\d+)|opr\/(\d+\.\d+)/,
    'Internet Explorer': /msie (\d+\.\d+)|trident.*rv:(\d+\.\d+)/
  };

  const pattern = patterns[browser as keyof typeof patterns];
  if (pattern) {
    const match = ua.match(pattern);
    return match ? match[1] || match[2] : null;
  }

  return null;
}

/**
 * Create device fingerprint from various request headers and characteristics
 */
function createDeviceFingerprint(req: Request) {
  const headers = req.headers;
  
  // Collect various headers for fingerprinting
  const fingerprintData = {
    userAgent: headers['user-agent'],
    acceptLanguage: headers['accept-language'],
    acceptEncoding: headers['accept-encoding'],
    accept: headers['accept'],
    connection: headers['connection'],
    upgradeInsecureRequests: headers['upgrade-insecure-requests'],
    dnt: headers['dnt'], // Do Not Track
    secFetchDest: headers['sec-fetch-dest'],
    secFetchMode: headers['sec-fetch-mode'],
    secFetchSite: headers['sec-fetch-site'],
    secFetchUser: headers['sec-fetch-user'],
    secChUa: headers['sec-ch-ua'], // Chrome User-Agent Client Hints
    secChUaMobile: headers['sec-ch-ua-mobile'],
    secChUaPlatform: headers['sec-ch-ua-platform'],
  };

  // Create a simple hash (in production, use a proper hashing function)
  const fingerprintString = Object.values(fingerprintData)
    .filter(Boolean)
    .join('|');
  
  return {
    fingerprint: fingerprintString, // In production, hash this
    raw: fingerprintData
  };
}

/**
 * Extract comprehensive location data from various headers
 */
function extractLocationData(req: Request) {
  const headers = req.headers;
  
  return {
    // IP-based location
    ipAddress: req.ip,
    
    // Cloudflare headers (if using Cloudflare)
    cloudflare: {
      country: headers['cf-ipcountry'] || headers['cf-country'],
      region: headers['cf-region'] || headers['cf-region-code'],
      city: headers['cf-ipcity'] || headers['cf-city'],
      timezone: headers['cf-timezone'],
      asn: headers['cf-asn'],
      organization: headers['cf-ray'] ? 'Cloudflare' : undefined,
      colo: headers['cf-colo'], // Cloudflare data center
    },
    
    // Generic geo headers
    geo: {
      country: headers['x-country-code'] || headers['geo-country'],
      region: headers['x-region'] || headers['geo-region'],
      city: headers['x-city'] || headers['geo-city'],
      timezone: headers['x-timezone'] || headers['geo-timezone'],
      latitude: headers['x-latitude'] || headers['geo-latitude'],
      longitude: headers['x-longitude'] || headers['geo-longitude'],
    },
    
    // Proxy/CDN headers
    proxy: {
      forwardedFor: headers['x-forwarded-for'],
      realIp: headers['x-real-ip'],
      via: headers['via'],
      xOriginalFor: headers['x-original-for'],
    }
  };
}

/**
 * Enhanced device and location data collection for security alerts
 */
export function collectEnhancedSecurityContext(req: Request) {
  const userAgent = req.get('User-Agent') || '';
  const deviceInfo = parseUserAgent(userAgent);
  const browserVersion = extractBrowserVersion(userAgent, deviceInfo.browser);
  const fingerprint = createDeviceFingerprint(req);
  const locationData = extractLocationData(req);
  
  return {
    // Basic request info
    endpoint: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    
    // Enhanced device information
    device: {
      ...deviceInfo,
      version: browserVersion,
      fingerprint: fingerprint.fingerprint,
      fingerprintData: fingerprint.raw,
      isBot: deviceInfo.device === 'Bot/Crawler',
      isMobile: deviceInfo.device === 'Mobile',
      isTablet: deviceInfo.device === 'Tablet',
      isDesktop: deviceInfo.device === 'Desktop',
    },
    
    // Enhanced location information
    location: locationData,
    
    // Network information
    network: {
      ip: req.ip,
      proxyChain: req.get('x-forwarded-for')?.split(',').map(ip => ip.trim()) || [],
      isBehindProxy: !!req.get('x-forwarded-for') || !!req.get('x-real-ip'),
      originalIp: req.get('x-real-ip') || req.get('x-original-for'),
    },
    
    // Request characteristics
    request: {
      protocol: req.protocol,
      secure: req.secure,
      xhr: req.get('x-requested-with') === 'XMLHttpRequest',
      contentType: req.get('content-type'),
      contentLength: req.get('content-length'),
      referer: req.get('referer'),
      origin: req.get('origin'),
      authorization: req.get('authorization') ? '[REDACTED]' : undefined,
    },
    
    // Security headers
    security: {
      dnt: req.get('dnt'), // Do Not Track
      secFetchDest: req.get('sec-fetch-dest'),
      secFetchMode: req.get('sec-fetch-mode'),
      secFetchSite: req.get('sec-fetch-site'),
      secChUa: req.get('sec-ch-ua'),
      secChUaMobile: req.get('sec-ch-ua-mobile'),
      secChUaPlatform: req.get('sec-ch-ua-platform'),
    },
    
    // Session information
    session: {
      cookie: req.get('cookie') ? '[REDACTED]' : undefined,
      sessionId: req.get('x-session-id') || (req as any).session?.id,
    },
    
    // Application context
    application: {
      tenantId: req.headers['x-tenant-id'],
      userId: (req as any).user?.user_id,
      userRole: (req as any).user?.role,
      userEmail: (req as any).user?.email,
      isAuthenticated: !!(req as any).user,
      requestPath: req.path,
      queryParameters: req.query,
      pathParameters: req.params,
      isPlatformUser: !!(req as any).user,
      isExternalActor: !(req as any).user,
      userTier: (req as any).user?.tier,
      userOrganization: (req as any).user?.organization_id,
    }
  };
}

/**
 * Create a summary of the security context for quick analysis
 */
export function createSecuritySummary(context: ReturnType<typeof collectEnhancedSecurityContext>) {
  return {
    threatLevel: calculateThreatLevel(context),
    riskFactors: identifyRiskFactors(context),
    location: `${context.location.cloudflare.city || context.location.geo.city || 'Unknown'}, ${context.location.cloudflare.country || context.location.geo.country || 'Unknown'}`,
    device: `${context.device.device} - ${context.device.browser} ${context.device.version || ''}`,
    ip: context.network.ip,
    isSuspicious: isSuspiciousActivity(context),
  };
}

function calculateThreatLevel(context: any): 'low' | 'medium' | 'high' | 'critical' {
  let score = 0;
  
  // External actors get higher base threat level
  if (context.application.isExternalActor) {
    score += 2; // Base score for external actors
  } else {
    score += 0.5; // Lower base score for platform users
  }
  
  // High-risk factors
  if (context.device.isBot) score += 3;
  if (context.network.proxyChain.length > 2) score += 2;
  if (context.location.cloudflare.country === 'Unknown') score += 1;
  if (!context.device.fingerprint) score += 1;
  
  // Medium-risk factors
  if (context.device.isMobile && context.application.isAdminRequest) score += 1;
  if (context.network.isBehindProxy) score += 1;
  if (!context.security.dnt) score += 0.5;
  
  // Platform user specific factors
  if (context.application.isPlatformUser) {
    // Platform users on admin routes from unusual locations/devices
    if (context.application.isAdminRequest && context.device.isBot) score += 2;
    if (context.application.isAdminRequest && context.network.isBehindProxy) score += 1;
    // Unusual user agent for authenticated user
    if (context.device.isBot && context.application.isAuthenticated) score += 2;
  }
  
  // External actor specific factors
  if (context.application.isExternalActor) {
    // External actors hitting admin endpoints
    if (context.application.isAdminRequest) score += 3;
    // External actors with sophisticated tools
    if (context.device.fingerprint && context.device.fingerprint.length > 100) score += 1;
    // External actors from high-risk regions (add your logic here)
    if (context.location.cloudflare.country === 'CN' || context.location.cloudflare.country === 'RU') score += 1;
  }
  
  if (score >= 5) return 'critical';
  if (score >= 3.5) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function identifyRiskFactors(context: any): string[] {
  const factors = [];
  
  // User type factors
  if (context.application.isExternalActor) {
    factors.push('External actor (unauthenticated)');
    if (context.application.isAdminRequest) {
      factors.push('External actor accessing admin endpoints');
    }
  } else {
    factors.push('Platform user (authenticated)');
    if (context.application.isAdminRequest && context.device.isBot) {
      factors.push('Authenticated user with bot-like behavior');
    }
  }
  
  // Device and network factors
  if (context.device.isBot) factors.push('Bot/Crawler detected');
  if (context.network.proxyChain.length > 2) factors.push('Multiple proxy hops');
  if (context.location.cloudflare.country === 'Unknown') factors.push('Unknown location');
  if (context.application.isAdminRequest && context.device.isMobile) factors.push('Mobile admin access');
  if (context.network.isBehindProxy) factors.push('Behind proxy/VPN');
  if (!context.security.dnt) factors.push('No Do Not Track');
  if (context.request.xhr && !context.application.isAuthenticated) factors.push('Unauthenticated XHR request');
  
  // Advanced risk factors
  if (context.application.isExternalActor && context.location.cloudflare.country === 'CN') {
    factors.push('High-risk geographic region (China)');
  }
  if (context.application.isExternalActor && context.location.cloudflare.country === 'RU') {
    factors.push('High-risk geographic region (Russia)');
  }
  if (context.device.fingerprint && context.device.fingerprint.length > 100) {
    factors.push('Sophisticated fingerprinting tools');
  }
  
  return factors;
}

function isSuspiciousActivity(context: any): boolean {
  return calculateThreatLevel(context) === 'high' || calculateThreatLevel(context) === 'critical';
}
