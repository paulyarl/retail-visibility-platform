/**
 * Session Tracking Middleware
 * Automatically tracks user sessions and creates security alerts
 */

import { Request, Response, NextFunction } from 'express';
import { basePrisma } from '../prisma';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import { generateSessionId } from '../lib/id-generator';
import { collectEnhancedSecurityContext, createSecuritySummary } from '../utils/security-context';

interface SessionInfo {
  userId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  deviceName?: string;
  userRole?: string;
}

/**
 * Parse device information from user agent
 */
function parseDeviceInfo(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    type: result.device.type || 'desktop',
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || '',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || '',
    device: result.device.vendor || result.device.model || 'Unknown',
    name: undefined as string | undefined, // Will be set from browser data if available
  };
}

/**
 * Get location data from IP using IP-API (free service)
 * Falls back to Unknown if service fails
 */
async function getLocationFromIP(ipAddress: string): Promise<{
  city: string;
  region: string;
  country: string;
  coordinates: [number, number] | null;
}> {
  // Skip geolocation for local/private IPs
  if (ipAddress === '127.0.0.1' || ipAddress === 'localhost' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
    return {
      city: 'Local Network',
      region: 'Local',
      country: 'Local',
      coordinates: null,
    };
  }

  try {
    // Use IP-API for geolocation (free, no API key required)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,city,regionName,country,lat,lon`);

    if (!response.ok) {
      throw new Error(`IP-API responded with status: ${response.status}`);
    }

    const data = await response.json() as {
      status: string;
      city?: string;
      regionName?: string;
      country?: string;
      lat?: number;
      lon?: number;
      message?: string;
    };

    if (data.status === 'success') {
      return {
        city: data.city || 'Unknown',
        region: data.regionName || 'Unknown',
        country: data.country || 'Unknown',
        coordinates: data.lat && data.lon ? [data.lat, data.lon] : null,
      };
    } else {
      console.warn(`[GeoIP] IP-API failed for ${ipAddress}:`, data.message);
    }
  } catch (error) {
    console.warn(`[GeoIP] Failed to geolocate IP ${ipAddress}:`, error);
  }

  // Fallback to Unknown
  return {
    city: 'Unknown',
    region: 'Unknown',
    country: 'Unknown',
    coordinates: null,
  };
}

/**
 * Create or update user session
 */
export async function trackSession(sessionInfo: SessionInfo & { req?: Request }): Promise<void> {
  const { userId, token, ipAddress, userAgent, deviceName, userRole, req } = sessionInfo;

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const deviceInfo = parseDeviceInfo(userAgent);

    // Override device name with browser-provided name if available
    if (deviceName) {
      deviceInfo.name = deviceName;
    }

    const location = await getLocationFromIP(ipAddress);

    // Check if session already exists
    const existingSession = await basePrisma.$queryRaw<any[]>`
      SELECT id FROM user_sessions_list
      WHERE token_hash = ${tokenHash}
        AND is_active = true
    `;

    if (existingSession.length > 0) {
      // Update existing session with location/IP/device data
      await basePrisma.$executeRaw`
        UPDATE user_sessions_list
        SET last_activity = NOW(),
            device_info = ${JSON.stringify(deviceInfo)}::jsonb,
            ip_address = ${ipAddress},
            user_agent = ${userAgent},
            location = ${JSON.stringify(location)}::jsonb
        WHERE token_hash = ${tokenHash}
      `;
    } else {
      // Check if this is a new device
      const existingSessions = await basePrisma.$queryRaw<any[]>`
        SELECT device_info
        FROM user_sessions_list
        WHERE user_id = ${userId}
          AND is_active = true
      `;

      const isNewDevice = !existingSessions.some(session => {
        const existingDevice = session.device_info || {};
        return existingDevice.browser === deviceInfo.browser &&
               existingDevice.os === deviceInfo.os;
      });

      // Check session limits before creating new session
      const isPlatformAdmin = userRole === 'PLATFORM_ADMIN' || userRole === 'PLATFORM_SUPPORT';
      const maxSessions = isPlatformAdmin ? 50 : 10; // Platform admins: 50 sessions, regular users: 10

      // Count active sessions for this user
      const [{ sessionCount }] = await basePrisma.$queryRaw<[{ sessionCount: bigint }]>`SELECT COUNT(*) as sessionCount FROM user_sessions_list WHERE user_id = ${userId} AND is_active = true`;

      if (Number(sessionCount) >= maxSessions) {
        // Find and deactivate the oldest session to make room for the new one
        await basePrisma.$executeRaw`
          UPDATE user_sessions_list
          SET is_active = false
          WHERE user_id = ${userId}
            AND is_active = true
          ORDER BY last_activity ASC
          LIMIT 1
        `;

        // Create security alert for session limit exceeded
        await basePrisma.$executeRaw`
          INSERT INTO security_alerts (
            user_id,
            type,
            severity,
            title,
            message,
            metadata
          ) VALUES (
            ${userId},
            'session_limit',
            'warning',
            'Session Limit Exceeded',
            'Maximum concurrent sessions reached. Oldest session was automatically deactivated.',
            ${JSON.stringify({
              sessionLimit: maxSessions,
              activeSessions: Number(sessionCount),
              action: 'auto_cleanup_oldest',
              timestamp: new Date().toISOString(),
            })}::jsonb
          )
        `;
      }

      // Create new session
      await basePrisma.$executeRaw`
        INSERT INTO user_sessions_list (
          user_id,
          token_hash,
          device_info,
          ip_address,
          user_agent,
          location,
          last_activity,
          expires_at
        ) VALUES (
          ${userId},
          ${tokenHash},
          ${JSON.stringify(deviceInfo)}::jsonb,
          ${ipAddress},
          ${userAgent},
          ${JSON.stringify(location)}::jsonb,
          NOW(),
          NOW() + INTERVAL '30 days'
        )
      `;

      // Create security alert for new device login
      if (isNewDevice) {
        // Collect enhanced security context if request is available
        let enhancedMetadata: any = {
          device: `${deviceInfo.browser} on ${deviceInfo.os}`,
          ip: ipAddress,
          timestamp: new Date().toISOString(),
        };

        if (req) {
          try {
            const securityContext = collectEnhancedSecurityContext(req);
            const securitySummary = createSecuritySummary(securityContext);
            
            // Use enhanced metadata with all security context details
            enhancedMetadata = {
              ...enhancedMetadata,
              ...securityContext,
              summary: securitySummary,
            };
          } catch (error) {
            console.warn('[trackSession] Failed to collect enhanced security context:', error);
            // Fall back to basic metadata
          }
        }

        await basePrisma.$executeRaw`
          INSERT INTO security_alerts (
            user_id,
            type,
            severity,
            title,
            message,
            metadata
          ) VALUES (
            ${userId},
            'new_device',
            'info',
            'New Device Login',
            'You signed in from a new device.',
            ${JSON.stringify(enhancedMetadata)}::jsonb
          )
        `;
      }
    }
  } catch (error) {
    console.error('[trackSession] Error:', error);
    // Don't throw - session tracking shouldn't break auth flow
  }
}

/**
 * Middleware to track session activity
 */
export function sessionActivityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only track for authenticated requests
  if (req.user?.user_id) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                        req.socket.remoteAddress ||
                        'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Get device info from header if available
      let deviceName: string | undefined;
      const deviceInfoHeader = req.headers['x-device-info'] as string;
      if (deviceInfoHeader) {
        try {
          const deviceInfo = JSON.parse(deviceInfoHeader);
          deviceName = deviceInfo.name;
        } catch (error) {
          console.warn('[sessionActivityMiddleware] Failed to parse device info header:', error);
        }
      }

      // Track session asynchronously (don't block request)
      trackSession({
        userId: req.user.user_id,
        token,
        ipAddress,
        userAgent,
        deviceName,
        userRole: req.user?.role,
        req, // Pass the request object for enhanced security context
      }).catch(err => {
        console.error('[sessionActivityMiddleware] Error tracking session:', err);
      });
    }
  }

  next();
}

/**
 * Track failed login attempt
 */
export async function trackFailedLogin(
  email: string,
  ipAddress: string,
  userAgent: string,
  reason: string
): Promise<void> {
  try {
    await basePrisma.$executeRaw`
      INSERT INTO failed_login_attempts (
        email,
        ip_address,
        user_agent,
        reason,
        metadata
      ) VALUES (
        ${email},
        ${ipAddress},
        ${userAgent},
        ${reason},
        ${JSON.stringify({ timestamp: new Date().toISOString() })}::jsonb
      )
    `;
  } catch (error) {
    console.error('[trackFailedLogin] Error:', error);
  }
}

/**
 * Create security alert manually
 */
export async function createSecurityAlert(
  userId: string,
  type: string,
  severity: 'info' | 'warning' | 'critical',
  title: string,
  message: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await basePrisma.$executeRaw`
      INSERT INTO security_alerts (
        user_id,
        type,
        severity,
        title,
        message,
        metadata
      ) VALUES (
        ${userId},
        ${type},
        ${severity},
        ${title},
        ${message},
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  } catch (error) {
    console.error('[createSecurityAlert] Error:', error);
  }
}
