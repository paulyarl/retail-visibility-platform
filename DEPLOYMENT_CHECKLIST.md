# Deployment Checklist

Use this checklist to ensure your Retail Visibility Platform is properly configured for production.

## ✅ Pre-Deployment Checklist

### Supabase Configuration

- [ ] **Create Storage Bucket**
  - Go to Supabase → Storage
  - Create bucket named `photos`
  - Set as public bucket

- [ ] **Set Storage Policies**
  - Policy 1: Public read access
  - Policy 2: Authenticated users can upload
  - Policy 3: Authenticated users can delete

- [ ] **Configure Auth Redirect URLs**
  - Site URL: `https://retail-visibility-platform-web.vercel.app`
  - Allowed redirect URLs:
    - `https://retail-visibility-platform-web.vercel.app/**`
    - `http://localhost:3000/**` (for development)

- [ ] **Get API Keys**
  - Copy `SUPABASE_URL` from Settings → API
  - Copy `anon` key for web app
  - Copy `service_role` key for API

### Railway Configuration

- [ ] **Add Environment Variables**
  ```
  DATABASE_URL=[your-postgresql-url]
  NODE_ENV=production
  SUPABASE_URL=https://[your-project].supabase.co
  SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
  ```

- [ ] **Verify Deployment**
  - Check that Railway auto-deploys from `spec-sync` branch
  - Verify API is accessible at `https://rvpapi-production.up.railway.app/health`
  - Check logs for any errors

### Vercel Configuration

- [ ] **Add Environment Variables**
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://[your-project].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
  API_BASE_URL=https://rvpapi-production.up.railway.app
  ```

- [ ] **Set Production Branch**
  - Go to Settings → Git
  - Set Production Branch to `spec-sync` (or `main` if merged)

- [ ] **Verify Deployment**
  - Check that Vercel auto-deploys from production branch
  - Verify web app is accessible
  - Check function logs for errors

### Package Installation

- [ ] **Install Dependencies**
  ```bash
  # In apps/web directory
  npm install
  
  # In apps/api directory
  npm install
  ```

- [ ] **Verify Vercel Analytics Package**
  - Check that `@vercel/analytics` is installed in `apps/web/package.json`
  - If not, run: `npm install @vercel/analytics` in `apps/web`

## 🧪 Testing Checklist

### Manual Testing

- [ ] **Authentication Flow**
  - Go to `/login`
  - Request magic link
  - Click link in email
  - Verify redirect to `/tenants`
  - Verify "Signed in as..." shows correct email

- [ ] **Tenants Page**
  - Create a new tenant
  - Verify tenant appears in list
  - Rename a tenant
  - Delete a tenant
  - Click on tenant to go to items page

- [ ] **Items Page**
  - Create a new item
  - Verify item appears in list
  - Edit item details
  - Upload a photo
  - Verify photo displays correctly
  - Delete an item

- [ ] **Photo Upload (Supabase Storage)**
  - Upload a photo to an item
  - Check Supabase Storage → photos bucket
  - Verify file is stored in correct path: `[tenant-id]/[sku]/[timestamp].jpg`
  - Verify photo URL starts with Supabase domain
  - Restart Railway service
  - Verify photo still displays (persistence test)

- [ ] **Error Handling**
  - Try invalid operations
  - Verify error messages display properly
  - Verify retry buttons work

### Automated Testing

- [ ] **Run API Tests**
  ```bash
  cd apps/api
  npm test
  ```
  - Verify all tests pass

## 📊 Monitoring Setup

### Vercel

- [ ] **Enable Analytics**
  - Verify Analytics component is in layout
  - Go to Vercel Dashboard → Analytics
  - Verify page views are being tracked

- [ ] **Check Function Logs**
  - Go to Vercel Dashboard → Logs → Functions
  - Verify no errors in recent logs
  - Check response times

### Railway

- [ ] **Check Service Logs**
  - Go to Railway → Your Service → Deployments
  - Click on latest deployment → Logs
  - Verify no errors
  - Check for Supabase upload success messages

- [ ] **Monitor Metrics**
  - Check CPU usage
  - Check Memory usage
  - Verify service is healthy

### Supabase

- [ ] **Check Auth Logs**
  - Go to Supabase → Auth → Logs
  - Verify magic link emails are being sent
  - Check for any auth errors

- [ ] **Check Storage Usage**
  - Go to Supabase → Storage → photos
  - Verify photos are being uploaded
  - Check storage usage

## 🔒 Security Checklist

- [ ] **Environment Variables**
  - Verify no secrets in code
  - Verify all secrets in environment variables
  - Verify `service_role` key is never exposed to client

- [ ] **CORS Configuration**
  - Verify API only accepts requests from Vercel domain
  - Check CORS settings in `apps/api/src/index.ts`

- [ ] **Supabase RLS**
  - Verify Row Level Security is enabled
  - Test that unauthenticated users cannot access data

- [ ] **Storage Policies**
  - Verify public can read photos
  - Verify only authenticated users can upload
  - Verify only authenticated users can delete

## 🚀 Go-Live Checklist

- [ ] **Final Smoke Test**
  - Test complete user flow end-to-end
  - Verify all features work on production URLs
  - Test on different devices/browsers

- [ ] **Performance Check**
  - Check page load times
  - Verify images load quickly
  - Check API response times

- [ ] **Backup Plan**
  - Document rollback procedure
  - Keep previous deployment available
  - Have emergency contacts ready

- [ ] **Communication**
  - Notify stakeholders of go-live
  - Share production URLs
  - Provide user documentation

## 📝 Post-Deployment

- [ ] **Monitor for 24 Hours**
  - Check logs regularly
  - Monitor error rates
  - Watch for performance issues

- [ ] **Gather Feedback**
  - Collect user feedback
  - Document any issues
  - Plan improvements

- [ ] **Update Documentation**
  - Document any configuration changes
  - Update README if needed
  - Add any lessons learned

## ⚠️ Troubleshooting

### Photo Upload Fails

**Symptom**: Photos don't upload or return 500 error

**Check**:
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set on Railway
2. Check Railway logs for Supabase errors
3. Verify storage bucket exists and is named `photos`
4. Check storage policies are set correctly

### Magic Link Not Working

**Symptom**: Magic link redirects to wrong URL or doesn't work

**Check**:
1. Verify Site URL in Supabase matches production URL
2. Check redirect URLs include `/**` wildcard
3. Verify email is being sent (check Supabase Auth logs)
4. Check spam folder

### API Returns 401

**Symptom**: API calls return 401 Unauthorized

**Check**:
1. Verify user is authenticated (check AuthPanel)
2. Check Supabase session is valid
3. Verify API_BASE_URL is set correctly on Vercel
4. Check Railway logs for errors

### Deployment Fails

**Symptom**: Vercel or Railway deployment fails

**Check**:
1. Check build logs for errors
2. Verify all dependencies are installed
3. Check for TypeScript errors
4. Verify environment variables are set

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ All manual tests pass
- ✅ All automated tests pass
- ✅ No errors in logs
- ✅ Photos persist after Railway restart
- ✅ Analytics tracking works
- ✅ Error boundaries catch errors gracefully
- ✅ Loading states display correctly
- ✅ Performance is acceptable (<500ms response times)

---

**Last Updated**: October 21, 2025
**Version**: 1.0.0
