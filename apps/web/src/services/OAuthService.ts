/**
 * OAuth 2.0 Authentication Service
 * 
 * Implements Authorization Code Flow with PKCE for secure authentication
 * Replaces traditional username/password login with SSO
 */

export interface OAuthConfig {
  clientId: string;
  domain: string;
  redirectUri: string;
  audience?: string;
  scope?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface OAuthUser {
  sub: string; // user ID
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  // Custom claims for your app
  role?: string;
  tenant_ids?: string[];
}

export class OAuthService {
  private config: OAuthConfig;
  private codeVerifier: string = '';
  private state: string = '';

  constructor(config: OAuthConfig) {
    this.config = {
      scope: 'openid profile email',
      ...config
    };
  }

  /**
   * Generate PKCE code verifier (random string)
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Generate random state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Initiate OAuth login flow
   */
  async initiateLogin(): Promise<void> {
    // Generate PKCE parameters
    this.codeVerifier = this.generateCodeVerifier();
    this.state = this.generateState();
    const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

    // Store PKCE verifier and state in session storage
    sessionStorage.setItem('oauth_code_verifier', this.codeVerifier);
    sessionStorage.setItem('oauth_state', this.state);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope!,
      state: this.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    if (this.config.audience) {
      params.append('audience', this.config.audience);
    }

    const authUrl = `https://${this.config.domain}/authorize?${params.toString()}`;
    
    // Redirect to SSO provider
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback (called from redirect page)
   */
  async handleCallback(): Promise<{ tokens: OAuthTokens; user: OAuthUser }> {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // Check for errors
    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    // Verify state parameter
    const storedState = sessionStorage.getItem('oauth_state');
    if (!state || state !== storedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Get code verifier
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    if (!codeVerifier) {
      throw new Error('Code verifier not found');
    }

    if (!code) {
      throw new Error('Authorization code not received');
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, codeVerifier);
    
    // Get user info from ID token or separate endpoint
    const user = await this.getUserInfo(tokens);

    // Clean up session storage
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_state');

    return { tokens, user };
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const response = await fetch(`https://${this.config.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
    };
  }

  /**
   * Get user information from ID token or user info endpoint
   */
  private async getUserInfo(tokens: OAuthTokens): Promise<OAuthUser> {
    // If we have an ID token, decode it (JWT)
    if (tokens.idToken) {
      try {
        const payload = this.decodeJWT(tokens.idToken);
        return {
          sub: payload.sub,
          email: payload.email,
          email_verified: payload.email_verified,
          name: payload.name,
          given_name: payload.given_name,
          family_name: payload.family_name,
          picture: payload.picture,
          // Custom claims for your app
          role: payload['https://yourapp.com/role'],
          tenant_ids: payload['https://yourapp.com/tenant_ids'],
        };
      } catch (error) {
        console.warn('Failed to decode ID token, falling back to user info endpoint');
      }
    }

    // Fallback to user info endpoint
    const response = await fetch(`https://${this.config.domain}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json();
  }

  /**
   * Decode JWT token (client-side, for ID token only)
   */
  private decodeJWT(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(`https://${this.config.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken, // Some providers don't return new refresh token
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
    };
  }

  /**
   * Logout (revoke tokens)
   */
  async logout(): Promise<void> {
    // Clear local tokens (handled by AuthContext)
    
    // Optional: Revoke tokens at provider
    const logoutUrl = `https://${this.config.domain}/v2/logout?client_id=${this.config.clientId}&returnTo=${encodeURIComponent(window.location.origin)}`;
    
    // Redirect to logout endpoint
    window.location.href = logoutUrl;
  }
}

// Export singleton instance
export const oauthService = new OAuthService({
  clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID || 'your-client-id',
  domain: process.env.NEXT_PUBLIC_OAUTH_DOMAIN || 'your-domain.auth0.com',
  redirectUri: `${window.location.origin}/auth/callback`,
  audience: process.env.NEXT_PUBLIC_OAUTH_AUDIENCE || 'https://your-api.com',
});
