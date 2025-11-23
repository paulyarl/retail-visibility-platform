# Railway API Deployment Guide

**Status:** ✅ PRODUCTION READY - Custom Dockerfile Configuration

## Overview

This guide documents the custom Railway deployment configuration for the API service, which uses a **Dockerfile approach** instead of the default Railpack auto-detection to avoid monorepo build issues.

## Why Custom Dockerfile?

**Problem with Railpack:**
- Railway auto-detects monorepo and uses `pnpm install --frozen-lockfile`
- Causes lockfile mismatch errors between `pnpm-lock.yaml` and `package.json`
- Builds from wrong context (root instead of `apps/api`)
- Cannot handle TypeScript version conflicts

**Solution with Dockerfile:**
- Uses `pnpm install --no-frozen-lockfile` (flexible)
- Proper monorepo context handling
- Controlled build environment
- Avoids apt-get timeout issues

## Required Railway Environment Variables

### Production Environment
```bash
RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile
RAILWAY_ROOT_DIR=apps/api
```

### Staging Environment  
```bash
RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile
RAILWAY_ROOT_DIR=apps/api
```

## Setting Environment Variables

```bash
# Switch to correct environment
railway environment production  # or staging

# Set required variables
railway variables --set "RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile"
railway variables --set "RAILWAY_ROOT_DIR=apps/api"
```

## Dockerfile Configuration

**Location:** `apps/api/Dockerfile`

**Key Features:**
- Uses `node:20` base image (includes OpenSSL, avoids apt-get)
- Handles monorepo structure correctly
- Installs from repository root for workspace resolution
- Builds and runs from `apps/api` directory
- Uses `--no-frozen-lockfile` for flexibility

## Emergency Deployment Steps

### 1. Quick Redeploy (Same Code)
```bash
# Switch to environment
railway environment production  # or staging

# Redeploy latest
railway redeploy
```

### 2. Deploy New Code
```bash
# Ensure code is pushed to correct branch
git checkout main           # for production
git checkout staging        # for staging
git push origin main        # or staging

# Switch environment and deploy
railway environment production  # or staging
railway deploy
```

### 3. Fix Broken Deployment

**If deployment fails, check these common issues:**

#### A. Missing Environment Variables
```bash
railway variables | Select-String -Pattern "RAILWAY"
# Should show RAILWAY_DOCKERFILE_PATH and RAILWAY_ROOT_DIR
```

#### B. Lockfile Issues
```bash
# Update lockfile locally
pnpm install
git add pnpm-lock.yaml
git commit -m "Update lockfile"
git push origin main  # or staging
```

#### C. TypeScript Errors
```bash
# Check for compilation errors
npx tsc --noEmit
# Fix errors, commit, and redeploy
```

## Build Process Overview

### Expected Build Steps:
1. **Snapshot** - Code fetched from GitHub
2. **Docker Build:**
   - [1/10] Base image (`node:20`)
   - [2/10] Enable corepack
   - [3/10] Set workdir `/app`
   - [4/10] Copy root `package.json`, `pnpm-lock.yaml`
   - [5/10] Copy `apps/api/package.json`
   - [6/10] Copy `apps/api/prisma/`
   - [7/10] Install dependencies (~2-3 minutes)
   - [8/10] Copy `apps/api` source
   - [9/10] Switch to `/app/apps/api`
   - [10/10] Build TypeScript + Prisma
3. **Export** - Create container image
4. **Deploy** - Start container
5. **Health Check** - Verify API is responding

### Expected Timeline:
- **Build**: 4-5 minutes
- **Deploy**: 1-2 minutes  
- **Total**: 6-7 minutes

## Troubleshooting

### Build Failures

**Checksum/Path Errors:**
```
failed to calculate checksum of ref ... "/prisma": not found
```
- **Cause:** Wrong Docker context or missing RAILWAY_ROOT_DIR
- **Fix:** Ensure environment variables are set correctly

**Lockfile Errors:**
```
ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile"
```
- **Cause:** TypeScript version mismatch
- **Fix:** Run `pnpm install` locally and commit updated lockfile

**apt-get Timeout:**
```
process "/bin/sh -c apt-get update..." exit code: 137
```
- **Cause:** Using `node:slim` base image
- **Fix:** Dockerfile uses `node:20` (full image with OpenSSL)

### Runtime Failures

**Database Connection:**
- Check Supabase environment variables
- Verify `DATABASE_URL` is correct for environment

**Missing Routes:**
- Check if all route files are included in build
- Verify TypeScript compilation succeeded

## Deployment Domains

### Production
- **API:** https://api.visibleshelf.com
- **Health Check:** https://api.visibleshelf.com/health
- **Routes:** https://api.visibleshelf.com/__routes

### Staging  
- **API:** https://aps.visibleshelf.store
- **Health Check:** https://aps.visibleshelf.store/health
- **Routes:** https://aps.visibleshelf.store/__routes

## Monitoring Commands

```bash
# Check deployment status
railway deployment list --limit 5

# View logs
railway logs --lines 50

# Check environment variables
railway variables

# Check service status
railway status
```

## Emergency Contacts

**If deployment fails and this guide doesn't help:**
1. Check Railway dashboard for detailed error logs
2. Verify GitHub Actions aren't blocking deployment
3. Check Supabase database connectivity
4. Review recent commits for breaking changes

## File Locations

- **Dockerfile:** `apps/api/Dockerfile`
- **API Package:** `apps/api/package.json`
- **Prisma Schema:** `apps/api/prisma/schema.prisma`
- **Build Script:** `apps/api/build-with-selective-errors.js`

## Success Indicators

✅ **Build logs show:** "🌟 Build completed with warnings"  
✅ **Dependencies:** "Done in Xm Xs using pnpm v10.20.0"  
✅ **Health check:** Returns `{"status": "ok"}`  
✅ **Routes endpoint:** Returns array of available routes  

---

**Last Updated:** November 23, 2025  
**Deployment Method:** Custom Dockerfile (not Railpack)  
**Environments:** Production + Staging both configured  

What Fixed It:
Ultra-simple Dockerfile approach:

dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile
WORKDIR /app/apps/api
RUN pnpm build
EXPOSE 8080
CMD ["npm", "start"]
Key Lessons Learned:
Docker trailing slash - COPY apps/api ./apps/api/ vs ./apps/api matters
Complexity kills - Simple approach worked when complex ones failed
Railpack fallback - Always good to have proven alternatives
Emergency debugging - Sometimes you need to strip everything down
Documentation Updated:
✅ Railway Deployment Guide - Merged to both branches
✅ Working Dockerfile - Proven in production
✅ Emergency procedures - Documented for future incidents

End of story indeed! 🚀 Both environments are running smoothly with the emergency fix that became the permanent solution.

Production API: https://api.visibleshelf.com ✅
Staging API: https://aps.visibleshelf.store ✅