# Sentry Monitoring Setup Guide

## Overview

This guide explains how to set up Sentry error monitoring and performance tracking for the Visible Shelf platform admin dashboard. The integration provides real-time monitoring with the same dashboard templates used in Sentry's interface.

## Prerequisites

- Sentry account (free tier available)
- Admin access to the platform
- Environment variable configuration access

## Step 1: Create Sentry Account

1. Go to [sentry.io](https://sentry.io/signup/) and create a free account
2. Verify your email address
3. Create a new organization or join an existing one

## Step 2: Set Up Projects

Create separate projects for each component you want to monitor:

1. **Web App Project**:
   - Name: `web` or `visible-shelf-web`
   - Platform: JavaScript → Next.js
   - Team: Create or select appropriate team

2. **API Server Project**:
   - Name: `api` or `visible-shelf-api`
   - Platform: Node.js → Express
   - Team: Create or select appropriate team

3. **Mobile App Project** (optional):
   - Name: `mobile` or `visible-shelf-mobile`
   - Platform: React Native or appropriate mobile platform
   - Team: Create or select appropriate team

## Step 3: Configure SDK Integration

The platform already has Sentry SDK configured. Verify the configuration:

### Web App (`apps/web/sentry.client.config.ts`)
- DSN: `NEXT_PUBLIC_SENTRY_DSN`
- Environment: Auto-detected from `NODE_ENV`

### API (`apps/api/src/index.ts`)
- DSN configured in environment variables
- Error tracking and performance monitoring enabled

## Step 4: Generate API Token

### Navigate to Token Creation

1. Go to your Sentry organization settings
2. Navigate to **Developer Settings** → **Auth Tokens**
3. Click **Create New Token**

### Required Permissions

When creating the API token, select these specific permissions:

#### Organization Permissions
- `org:read` - Read organization details and settings
- `org:write` - Update organization settings (optional but recommended)

#### Project Permissions
- `project:read` - Read project details and settings
- `project:write` - Update project settings (optional)

#### Team Permissions
- `team:read` - Read team information
- `team:write` - Manage team membership (optional)

#### Release Permissions
- `release:read` - Read release information
- `release:write` - Manage releases (optional)

#### Event Permissions
- `event:read` - Read event/error data
- `event:write` - Manage events (optional)

#### Member Permissions
- `member:read` - Read member information
- `member:write` - Manage member access (optional)

### Token Name
Name your token descriptively: `visible-shelf-admin-dashboard`

## Step 5: Configure Environment Variables

### Platform Environment Setup

Add these environment variables to your platform deployment:

#### Required Variables
```bash
# Sentry API Token (from Step 4)
SENTRY_API_TOKEN=your_personal_api_token_here

# Sentry Organization Slug
SENTRY_ORG_SLUG=your_organization_slug
```

#### How to Find Your Organization Slug

1. In Sentry, go to your organization settings
2. The organization slug is in the URL: `https://sentry.io/settings/[org-slug]/`
3. Or found in **Settings** → **Organization** → **General Settings**

### Environment Variable Locations

#### Development (`.env.local`)
```bash
# Add to apps/web/.env.local
NEXT_PUBLIC_SENTRY_DSN=your_web_dsn_here

# Add to apps/api/.env
SENTRY_API_TOKEN=your_api_token_here
SENTRY_ORG_SLUG=your_org_slug_here
```

#### Production/Staging
Configure these in your deployment platform:
- Vercel: Project Settings → Environment Variables
- Railway: Project Variables
- Other platforms: Their respective environment variable sections

## Step 6: Test the Integration

### Access the Admin Dashboard

1. Log in as a platform admin
2. Navigate to **Settings** → **Admin Dashboard**
3. Click on **Sentry Monitoring** in the Security & Compliance section

### Verify Configuration

The dashboard will show:
- ✅ **Green status**: "Sentry API configured" - Integration working
- ⚠️ **Yellow status**: "Sentry Not Configured" - Missing environment variables
- ❌ **Red status**: "Connection Error" - API token or network issues

### Test Features

1. **Project Selection**: Verify your projects appear in the dropdown
2. **Metrics Display**: Check that error counts and performance data load
3. **Dashboard Templates**: Ensure Error, Performance, and Release sections work
4. **Quick Actions**: Test links to full Sentry dashboards

## Step 7: Configure Alert Rules (Optional)

### Set Up Alerts in Sentry

1. Go to your Sentry project settings
2. Navigate to **Alerts** → **Create Alert Rule**

#### Recommended Alert Rules

**High Priority Errors**:
- Condition: `An event is seen` with tag `level` equals `error`
- Frequency: Every 5 minutes
- Notification: Slack/Email to dev team

**Performance Issues**:
- Condition: `Transaction duration` is `above 3000ms`
- Frequency: Every 10 minutes
- Notification: Slack/Email to dev team

**Release Health**:
- Condition: `Release health` with crash rate `above 5%`
- Frequency: Every 30 minutes
- Notification: Slack/Email to platform admins

## Step 8: Monitor and Maintain

### Regular Checks

- **Weekly**: Review error trends in admin dashboard
- **Monthly**: Audit API token permissions
- **Quarterly**: Update SDK versions and review alert rules

### Troubleshooting

#### Common Issues

**"Sentry Not Configured" Error**:
- Check environment variables are set correctly
- Verify token permissions include `org:read` and `project:read`
- Ensure organization slug matches exactly

**Empty Metrics**:
- Wait 24-48 hours for data to populate
- Check that SDK is sending data to correct projects
- Verify DSN configuration matches project settings

**Permission Errors**:
- Regenerate token with correct permissions
- Check organization membership and access levels

#### Debug Commands

```bash
# Check if environment variables are set
echo $SENTRY_API_TOKEN
echo $SENTRY_ORG_SLUG

# Test API endpoint directly
curl -H "Authorization: Bearer $SENTRY_API_TOKEN" \
     "https://sentry.io/api/0/organizations/$SENTRY_ORG_SLUG/"
```

## Security Considerations

### API Token Security
- **Never commit tokens to version control**
- **Rotate tokens regularly** (every 6-12 months)
- **Use minimal required permissions**
- **Monitor token usage** in Sentry settings

### Data Privacy
- **Error data may contain sensitive information**
- **Configure data scrubbing** in Sentry project settings
- **Review PII filtering rules** regularly

## Support

If you encounter issues:

1. Check the status indicator in the admin dashboard
2. Review Sentry API documentation: https://docs.sentry.io/api/
3. Contact platform support with error details

## API Reference

The integration uses these Sentry API endpoints:
- `GET /api/0/organizations/{org_slug}/` - Organization info
- `GET /api/0/projects/` - Project list
- `GET /api/0/organizations/{org_slug}/issues/` - Error issues
- `GET /api/0/organizations/{org_slug}/stats/` - Organization stats
- `GET /api/0/projects/{org_slug}/{project_slug}/releases/` - Release data

---

**Last Updated**: December 2025
**Platform Version**: v2.x
**Sentry SDK**: @sentry/nextjs v10.32.1, @sentry/node v10.32.1
