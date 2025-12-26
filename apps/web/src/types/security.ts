/**
 * TypeScript Interfaces for Security Features
 * Phases 1, 2, and 3
 */

// ==================== Phase 1: Basic Security + GDPR ====================

export interface LoginSession {
  id: string;
  device?: string;
  deviceInfo?: {
    type: string;
    browser: string;
    os: string;
    browserVersion?: string;
    osVersion?: string;
    device?: string;
  };
  location: string | {
    city: string;
    region: string;
    country: string;
    coordinates?: any;
  };
  ipAddress: string;
  lastActivity: string | Date; // API returns lastActivity, not lastActive
  isCurrent: boolean;
  userAgent: string;
  createdAt: string | Date;
  expiresAt?: string | Date;
}

export interface SecurityAlert {
  id: string;
  type: 'failed_login' | 'new_device' | 'password_change' | 'suspicious_activity' | 'account_change' | 'unusual_login' | 'password_changed' | 'device_added' | 'mfa_disabled' | 'account_locked';
  title: string;
  message: string;
  createdAt: string | Date;
  severity: 'info' | 'warning' | 'critical' | 'error';
  read: boolean;
  readAt?: string | Date;
  metadata?: Record<string, any>;
  actions?: SecurityAlertAction[];
  // Legacy field for backwards compatibility
  timestamp?: Date;
}

export interface SecurityAlertAction {
  label: string;
  action: 'dismiss' | 'view_details' | 'take_action';
  url?: string;
}

export interface DataExport {
  id: string;
  requestedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  format: 'json' | 'csv';
  expiresAt: Date;
  fileSize?: number;
}

export interface AccountDeletionRequest {
  id: string;
  requestedAt: Date;
  scheduledFor: Date;
  reason?: string;
  status: 'pending' | 'cancelled' | 'completed';
  canCancel: boolean;
}

// ==================== Phase 2: Full GDPR Compliance ====================

export type ConsentType = 
  | 'marketing' 
  | 'analytics' 
  | 'data_processing' 
  | 'data_sharing' 
  | 'cookies' 
  | 'profiling' 
  | 'third_party';

export interface ConsentRecord {
  id: string;
  type: ConsentType;
  consented: boolean;
  lastUpdated: Date;
  source: string;
  description: string;
  required: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentGroup {
  category: string;
  consents: ConsentRecord[];
  description: string;
}

export interface ConsentHistoryEntry {
  id: string;
  consentType: ConsentType;
  action: 'granted' | 'revoked' | 'updated';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserPreference {
  key: string;
  value: any;
  category: string;
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'json' | 'select';
  options?: string[];
  lastModified: Date;
}

export interface PreferenceCategory {
  name: string;
  description: string;
  preferences: UserPreference[];
}

// ==================== Phase 3: Advanced Security ====================

export type MFAMethod = 'TOTP' | 'SMS' | 'EMAIL' | 'BACKUP_CODE';

export interface MFAStatus {
  enabled: boolean;
  method: MFAMethod | null;
  verifiedAt: Date | null;
  backupCodesRemaining: number;
  lastUsed?: Date;
}

export interface MFASetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  otpauthUrl: string;
}

export interface MFAVerificationResult {
  success: boolean;
  message: string;
  requiresSetup?: boolean;
}

export interface SecurityMetrics {
  failedLoginAttempts: number;
  blockedRequests: number;
  suspiciousActivities: number;
  activeUsers: number;
  mfaAdoptionRate: number;
  averageResponseTime: number;
  rateLimitHits: number;
  previousPeriod: {
    failedLoginAttempts: number;
    blockedRequests: number;
    suspiciousActivities: number;
    activeUsers: number;
    rateLimitHits: number;
  };
  // Legacy fields for backwards compatibility
  failedLogins?: number;
  blockedIPs?: number;
  activeThreats?: number;
  timeRange?: string;
}

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ThreatType = 
  | 'failed_login' 
  | 'suspicious_activity' 
  | 'rate_limit_exceeded' 
  | 'brute_force_attempt'
  | 'unusual_access_pattern'
  | 'unauthorized_access_attempt';

export interface SecurityThreat {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  description: string;
  source: string;
  detectedAt: string;
  affectedResources: string[];
  ipAddress: string;
  userAgent: string;
  userId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface BlockedIP {
  id: string;
  ipAddress: string;
  reason: string;
  blockedAt: Date;
  expiresAt: Date;
  permanent: boolean;
  attempts?: number;
  metadata?: Record<string, any>;
}

export interface SecurityHealthStatus {
  status: 'healthy' | 'warning' | 'critical' | 'error';
  uptime: string;
  issues: string[];
  metrics: SecurityMetrics;
  timestamp: Date;
  checks: {
    threatCount: boolean;
    loginFailures: boolean;
  };
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ==================== Error Types ====================

export interface SecurityError {
  code: 'MFA_REQUIRED' | 'CONSENT_MISSING' | 'SECURITY_VIOLATION' | 'UNAUTHORIZED' | 'FORBIDDEN';
  message: string;
  actionRequired?: string;
  retryAfter?: number;
}

// ==================== Form Types ====================

export interface MFASetupFormData {
  verificationCode: string;
}

export interface ConsentUpdateData {
  type: ConsentType;
  consented: boolean;
}

export interface BulkConsentUpdateData {
  updates: ConsentUpdateData[];
}

export interface PreferenceUpdateData {
  key: string;
  value: any;
}

export interface AccountDeletionFormData {
  reason?: string;
  confirmation: string;
  password: string;
  preserveData?: boolean;
}

export interface DataExportFormData {
  format: 'json' | 'csv';
  includeMetadata: boolean;
}
