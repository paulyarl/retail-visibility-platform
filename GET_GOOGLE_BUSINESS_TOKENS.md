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
