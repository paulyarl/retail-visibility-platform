# Get Google Business OAuth Tokens

## Using Google OAuth 2.0 Playground (Easiest Method)

1. Go to: https://developers.google.com/oauthplayground

2. Click the gear icon ⚙️ (top right) to configure:
   - **OAuth flow:** Server-side
   - **OAuth endpoints:** Google
   - **Authorization endpoint:** https://accounts.google.com/o/oauth2/v2/auth
   - **Token endpoint:** https://oauth2.googleapis.com/token
   - **Access token location:** Authorization header w/ Bearer prefix

3. In the "Input your own scopes" box, enter:
   ```
   https://www.googleapis.com/auth/business.manage
   ```

4. Click "Authorize APIs"

5. Sign in with your Google account and grant permissions

6. Click "Exchange authorization code for tokens"

7. **Copy these values:**
   - **Access token:** `ya29.xxxxx...`
   - **Refresh token:** `1//xxxxx...`

## Alternative: Use Your Existing OAuth Flow

If you have an existing OAuth flow in your app, you can use it to get tokens and then copy them from the database.

## Alternative: Command Line (Advanced)

```bash
# Install oauth2l if you want command line
# Then run:
oauth2l fetch --credentials credentials.json --scope https://www.googleapis.com/auth/business.manage business.manage
```

## Next Step

Once you have the **access_token** and **refresh_token**, update the INSERT SQL and run it in Supabase.

The access token is short-lived (1 hour), but the refresh token is long-lived and will be used to get new access tokens automatically.


## RENEWAL INSTRUCTIONS

✅ Manual Token Renewal - Ready!
Yes, you can manually renew the Google OAuth token using the OAuth Playground. Here's the complete process:

🔄 Manual Renewal Steps:
1. Go to OAuth Playground: https://developers.google.com/oauthplayground

2. Configure (⚙️ gear icon):
- **Client ID:** `YOUR_CLIENT_ID_HERE`
- **Client Secret:** `YOUR_CLIENT_SECRET_HERE`
- **Scope:** `https://www.googleapis.com/auth/business.manage`
3. Authorize & Get New Token:

Click "Authorize APIs"
Sign in and grant permissions
Click "Exchange authorization code for tokens"
Copy the new access_token
4. Update Token in Database:

sql
-- Run this in Supabase SQL Editor:
UPDATE oauth_integrations
SET
  access_token = '{
    "access_token": "YOUR_NEW_TOKEN_HERE",
    "token_type": "Bearer",
    "expires_in": 3599
  }'::json,
  expires_at = NOW() + INTERVAL '1 hour',
  updated_at = NOW()
WHERE provider = 'google_business'
  AND tenant_id IS NULL;
⏰ When to Renew:
Token expires: ~1 hour after generation
Service fails: When you see hardcoded categories (30) instead of Google API (4,000+)
Test endpoint: Call /api/test/gbp-sync to check status
🔑 For Long-Term Automation:
To avoid manual renewal, you need a refresh_token. Get it by:

Using your actual client credentials in OAuth Playground (not the default ones)
Or implementing the full OAuth flow in your app
Manual renewal is quick and works perfectly for now! The service will continue working with live Google Business Profile categories. 🎯

Feedback submitted