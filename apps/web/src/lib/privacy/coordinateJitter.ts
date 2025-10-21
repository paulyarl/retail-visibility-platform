/**
 * Coordinate Privacy Utilities
 * 
 * Implements privacy-safe coordinate handling with jitter for neighborhood mode.
 * Complies with GDPR Article 6 (Data Minimization) and CCPA requirements.
 */

export type PrivacyMode = 'precise' | 'neighborhood';

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Apply privacy jitter to coordinates based on privacy mode
 * 
 * @param coords - Original coordinates
 * @param mode - Privacy mode (precise or neighborhood)
 * @returns Privacy-safe coordinates
 */
export function applyPrivacyJitter(
  coords: Coordinates,
  mode: PrivacyMode = 'precise'
): Coordinates {
  if (mode === 'precise') {
    return coords;
  }

  // Neighborhood mode: Apply ±0.002° jitter (≈200m radius)
  // This provides privacy while maintaining general area visibility
  const jitterAmount = 0.002;

  return {
    latitude: roundToJitter(coords.latitude, jitterAmount),
    longitude: roundToJitter(coords.longitude, jitterAmount),
  };
}

/**
 * Round coordinate to nearest jitter interval
 * 
 * @param value - Original coordinate value
 * @param jitter - Jitter amount in degrees
 * @returns Rounded coordinate
 */
function roundToJitter(value: number, jitter: number): number {
  return Math.round(value / jitter) * jitter;
}

/**
 * Calculate approximate distance between two coordinates (Haversine formula)
 * Used for privacy validation and testing
 * 
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Validate that jittered coordinates are within acceptable privacy range
 * 
 * @param original - Original coordinates
 * @param jittered - Jittered coordinates
 * @returns True if within acceptable range (50-300m)
 */
export function validatePrivacyJitter(
  original: Coordinates,
  jittered: Coordinates
): boolean {
  const distance = calculateDistance(original, jittered);
  
  // Acceptable range: 50m to 300m
  // This ensures privacy while maintaining usefulness
  return distance >= 50 && distance <= 300;
}

/**
 * Get privacy mode display label
 * 
 * @param mode - Privacy mode
 * @returns Human-readable label
 */
export function getPrivacyModeLabel(mode: PrivacyMode): string {
  return mode === 'precise' ? 'Exact Location' : 'Approximate Area';
}

/**
 * Get privacy mode description
 * 
 * @param mode - Privacy mode
 * @returns Description text
 */
export function getPrivacyModeDescription(mode: PrivacyMode): string {
  if (mode === 'precise') {
    return 'Your exact coordinates will be visible to visitors';
  }
  return 'Coordinates will be rounded to protect your privacy while still showing your general area (≈200m radius)';
}

/**
 * Check if coordinates are valid
 * 
 * @param coords - Coordinates to validate
 * @returns True if valid
 */
export function isValidCoordinates(coords: Partial<Coordinates>): coords is Coordinates {
  if (!coords.latitude || !coords.longitude) {
    return false;
  }

  // Validate latitude range (-90 to 90)
  if (coords.latitude < -90 || coords.latitude > 90) {
    return false;
  }

  // Validate longitude range (-180 to 180)
  if (coords.longitude < -180 || coords.longitude > 180) {
    return false;
  }

  return true;
}

/**
 * Format coordinates for display
 * 
 * @param coords - Coordinates to format
 * @param precision - Decimal places (default: 6)
 * @returns Formatted string
 */
export function formatCoordinates(
  coords: Coordinates,
  precision: number = 6
): string {
  return `${coords.latitude.toFixed(precision)}, ${coords.longitude.toFixed(precision)}`;
}

/**
 * Audit log entry for coordinate access
 * Used for GDPR compliance and privacy tracking
 */
export interface CoordinateAccessLog {
  timestamp: string;
  tenantId: string;
  userId?: string;
  action: 'view' | 'geocode' | 'update';
  privacyMode: PrivacyMode;
  ipAddress?: string;
}

/**
 * Create audit log entry for coordinate access
 * 
 * @param params - Log parameters
 * @returns Audit log entry
 */
export function createCoordinateAccessLog(params: Omit<CoordinateAccessLog, 'timestamp'>): CoordinateAccessLog {
  return {
    ...params,
    timestamp: new Date().toISOString(),
  };
}
