# Vercel Deploy Hooks Setup

Deploy hooks allow you to trigger Vercel deployments via HTTP POST requests.

## 🔧 Setup Instructions

### 1. Create Deploy Hook in Vercel

1. **Go to Vercel Dashboard:** https://vercel.com/dashboard
2. **Select your project:** `visible-shelf-api` (or your web project)
3. **Settings** → **Git**
4. **Scroll to "Deploy Hooks"**
5. **Click "Create Hook"**
   - **Hook Name:** `Staging Deploy`
   - **Git Branch:** `staging`
6. **Copy the generated URL** (looks like: `https://api.vercel.com/v1/integrations/deploy/...`)

### 2. Set Environment Variable

#### On Windows (PowerShell):
```powershell
$env:VERCEL_DEPLOY_HOOK_STAGING="https://api.vercel.com/v1/integrations/deploy/YOUR_HOOK_ID"
```

#### On Mac/Linux (Bash):
```bash
export VERCEL_DEPLOY_HOOK_STAGING="https://api.vercel.com/v1/integrations/deploy/YOUR_HOOK_ID"
```

#### Permanently (add to your shell profile):
**PowerShell:** Add to `$PROFILE`
**Bash:** Add to `~/.bashrc` or `~/.zshrc`

### 3. Trigger Deployment

#### Using PowerShell (Windows):
```powershell
.\scripts\deploy-staging.ps1
```

#### Using Bash (Mac/Linux):
```bash
chmod +x scripts/deploy-staging.sh
./scripts/deploy-staging.sh
```

#### Using curl directly:
```bash
curl -X POST $VERCEL_DEPLOY_HOOK_STAGING
```

## 🚀 Usage

### Manual Trigger
Run the script whenever you want to trigger a deployment:
```powershell
# Windows
.\scripts\deploy-staging.ps1

# Mac/Linux
./scripts/deploy-staging.sh
```

### GitHub Actions (Optional)
The workflow at `.github/workflows/deploy-staging.yml` will automatically trigger on:
- Push to `staging` branch
- Manual workflow dispatch

To use GitHub Actions:
1. Go to GitHub → Your Repo → Settings → Secrets and variables → Actions
2. Add secret: `VERCEL_DEPLOY_HOOK_STAGING` with your hook URL
3. Workflow will run automatically on push to staging

## 📊 Monitoring

After triggering deployment:
1. Go to **Vercel Dashboard** → **Deployments**
2. Watch the deployment progress
3. Check build logs for any errors

## 🔍 Troubleshooting

### Hook not triggering?
- Verify the hook URL is correct
- Check Vercel project settings
- Ensure the branch name matches exactly

### Deployment fails?
- Check Vercel build logs
- Verify environment variables are set
- Check for build errors in the logs

## 🎯 Multiple Projects

If you have both web and API on Vercel:

**Web Deploy Hook:**
```powershell
$env:VERCEL_DEPLOY_HOOK_WEB_STAGING="<web-hook-url>"
```

**API Deploy Hook:**
```powershell
$env:VERCEL_DEPLOY_HOOK_API_STAGING="<api-hook-url>"
```

Create separate scripts for each project.
