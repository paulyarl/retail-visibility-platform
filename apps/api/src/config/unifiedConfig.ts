/**
 * Unified Configuration
 *
 * Single source of truth for all environment-based configuration.
 * Route files must use this instead of `process.env` directly.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.3 and
 * .agents/skills/backend-dev-guidelines (§6 unifiedConfig is the only config source).
 */

class UnifiedConfig {
  private env: Record<string, string | undefined>;

  constructor() {
    this.env = { ...process.env };
  }

  // ─── Environment ──────────────────────────────────────────────────────

  get nodeEnv(): string {
    return this.env.NODE_ENV || 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  // ─── URLs ─────────────────────────────────────────────────────────────

  get webUrl(): string {
    return this.env.WEB_URL || 'http://localhost:3000';
  }

  get apiUrl(): string {
    return this.env.API_URL || 'http://localhost:8080';
  }

  // ─── Stripe ───────────────────────────────────────────────────────────

  get stripeSecretKey(): string {
    return this.env.STRIPE_SECRET_KEY || '';
  }

  get stripePlatformSecretKey(): string {
    return this.env.STRIPE_PLATFORM_SECRET_KEY || '';
  }

  get stripeWebhookSecret(): string {
    return this.env.STRIPE_WEBHOOK_SECRET || '';
  }

  // ─── PayPal ───────────────────────────────────────────────────────────

  get paypalMode(): string {
    return this.env.PAYPAL_MODE || 'sandbox';
  }

  get paypalWebhookId(): string | undefined {
    return this.env.PAYPAL_WEBHOOK_ID;
  }

  // ─── Google Business ──────────────────────────────────────────────────

  get googleBusinessClientId(): string | undefined {
    return this.env.GOOGLE_BUSINESS_CLIENT_ID;
  }

  get googleBusinessClientSecret(): string | undefined {
    return this.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  }

  get googleBusinessRedirectUri(): string | undefined {
    return this.env.GOOGLE_BUSINESS_REDIRECT_URI;
  }

  // ─── Google Maps ──────────────────────────────────────────────────────

  get googleMapsApiKey(): string | undefined {
    return this.env.GOOGLE_MAPS_API_KEY;
  }

  // ─── TikTok ───────────────────────────────────────────────────────────

  get tiktokAppSecret(): string {
    return this.env.TIKTOK_APP_SECRET || '';
  }

  // ─── Faire ────────────────────────────────────────────────────────────

  get faireWebhookSecret(): string | undefined {
    return this.env.FAIRE_WEBHOOK_SECRET;
  }

  // ─── Supabase ─────────────────────────────────────────────────────────

  get supabaseUrl(): string {
    return this.env.SUPABASE_URL || '';
  }

  get supabaseServiceRoleKey(): string {
    return this.env.SUPABASE_SERVICE_ROLE_KEY || this.env.SUPABASE_ANON_KEY || '';
  }

  get supabaseAnonKey(): string {
    return this.env.SUPABASE_ANON_KEY || '';
  }

  // ─── Auth0 ────────────────────────────────────────────────────────────

  get auth0Domain(): string {
    return this.env.AUTH0_DOMAIN || '';
  }

  get auth0ClientId(): string {
    return this.env.AUTH0_CLIENT_ID || '';
  }

  get auth0ClientSecret(): string {
    return this.env.AUTH0_CLIENT_SECRET || '';
  }

  get auth0MfaClientId(): string | undefined {
    return this.env.AUTH0_MFA_CLIENT_ID;
  }

  get auth0MfaClientSecret(): string | undefined {
    return this.env.AUTH0_MFA_CLIENT_SECRET;
  }

  // ─── Sentry ───────────────────────────────────────────────────────────

  get sentryDsn(): string | undefined {
    return this.env.SENTRY_DSN;
  }

  // ─── Meta/Facebook ────────────────────────────────────────────────────

  get metaAppId(): string | undefined {
    return this.env.META_APP_ID;
  }

  get metaAppSecret(): string | undefined {
    return this.env.META_APP_SECRET;
  }

  get metaWebhookVerifyToken(): string {
    return this.env.META_WEBHOOK_VERIFY_TOKEN || '';
  }

  // ─── Square ───────────────────────────────────────────────────────────

  get squareAccessToken(): string | undefined {
    return this.env.SQUARE_ACCESS_TOKEN;
  }

  get squareEnvironment(): string {
    return this.env.SQUARE_ENVIRONMENT || 'sandbox';
  }

  // ─── Clover ───────────────────────────────────────────────────────────

  get cloverAppId(): string | undefined {
    return this.env.CLOVER_APP_ID;
  }

  get cloverAppSecret(): string | undefined {
    return this.env.CLOVER_APP_SECRET;
  }

  // ─── Email ────────────────────────────────────────────────────────────

  get smtpHost(): string | undefined {
    return this.env.SMTP_HOST;
  }

  get smtpPort(): number {
    return parseInt(this.env.SMTP_PORT || '587');
  }

  get smtpUser(): string | undefined {
    return this.env.SMTP_USER;
  }

  get smtpPassword(): string | undefined {
    return this.env.SMTP_PASSWORD;
  }

  // ─── Google Merchant ──────────────────────────────────────────────────

  get googleMerchantId(): string | undefined {
    return this.env.GOOGLE_MERCHANT_ID;
  }

  // ─── Image Search ─────────────────────────────────────────────────────

  get googleCustomSearchApiKey(): string | undefined {
    return this.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  }

  get googleCustomSearchEngineId(): string | undefined {
    return this.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  }

  // ─── AWS ──────────────────────────────────────────────────────────────

  get awsRegion(): string {
    return this.env.AWS_REGION || 'unknown';
  }

  // ─── Vercel ───────────────────────────────────────────────────────────

  get vercelAutomationBypassSecret(): string | undefined {
    return this.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  // ─── Platform URL ─────────────────────────────────────────────────────

  get platformUrl(): string {
    return this.env.PLATFORM_URL || 'http://localhost:3000';
  }

  // ─── Frontend URL (alias) ─────────────────────────────────────────────

  get frontendUrl(): string {
    return this.env.FRONTEND_URL || this.webUrl;
  }

  get webBaseUrl(): string {
    return this.env.WEB_BASE_URL || this.webUrl;
  }

  // ─── PayPal (extended) ────────────────────────────────────────────────

  get paypalClientId(): string | undefined {
    return this.env.PAYPAL_CLIENT_ID;
  }

  get paypalClientSecret(): string | undefined {
    return this.env.PAYPAL_CLIENT_SECRET;
  }

  // ─── Square (extended) ────────────────────────────────────────────────

  get squareLocationId(): string | undefined {
    return this.env.SQUARE_LOCATION_ID;
  }

  get squareWebhookSignatureKey(): string | undefined {
    return this.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  }

  // ─── Clover (extended) ────────────────────────────────────────────────

  get cloverUseRealApi(): boolean {
    return this.env.CLOVER_USE_REAL_API === 'true';
  }

  // ─── Sentry (extended) ────────────────────────────────────────────────

  get sentryApiToken(): string | undefined {
    return this.env.SENTRY_API_TOKEN;
  }

  get sentryOrgSlug(): string | undefined {
    return this.env.SENTRY_ORG_SLUG;
  }

  // ─── Email (extended) ─────────────────────────────────────────────────

  get emailProvider(): string {
    return this.env.EMAIL_PROVIDER || 'console';
  }

  get emailFrom(): string {
    return this.env.EMAIL_FROM || 'noreply@rvp-platform.com';
  }

  get emailFromName(): string {
    return this.env.EMAIL_FROM_NAME || 'Visible Shelf Platform';
  }

  // ─── Upload ───────────────────────────────────────────────────────────

  get uploadDir(): string {
    return this.env.UPLOAD_DIR || '';
  }

  // ─── Encryption ───────────────────────────────────────────────────────

  get encryptionKey(): string {
    return this.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
  }

  // ─── Image Search APIs ────────────────────────────────────────────────

  get unsplashAccessKey(): string {
    return this.env.UNSPLASH_ACCESS_KEY || '';
  }

  get pexelsApiKey(): string {
    return this.env.PEXELS_API_KEY || '';
  }

  // ─── Quick Start ──────────────────────────────────────────────────────

  get quickStartProductLimit(): number {
    return parseInt(this.env.QUICK_START_PRODUCT_LIMIT || '500', 10);
  }

  // ─── Database ─────────────────────────────────────────────────────────

  get databaseUrl(): string {
    return this.env.DATABASE_URL || '';
  }

  // ─── App Version ──────────────────────────────────────────────────────

  get appVersion(): string {
    return this.env.npm_package_version || '1.0.0';
  }

  // ─── Generic getter for any env var not yet typed ─────────────────────

  get(key: string): string | undefined {
    return this.env[key];
  }

  getOrThrow(key: string): string {
    const value = this.env[key];
    if (!value) {
      throw new Error(`Configuration missing: ${key}`);
    }
    return value;
  }
}

export const unifiedConfig = new UnifiedConfig();
