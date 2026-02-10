# ClickPro Portal - Vercel Deployment Guide

## Critical Fix: API Proxy Configuration

### Problem
The API proxy at `/api/clients/[...path]` was failing in production with 500 errors because it was trying to read `NEXT_PUBLIC_*` environment variables at runtime, which are only available at build time.

### Solution
The proxy now uses only `CLICKPRO_API_URL` (server-side environment variable) which is available at runtime in Vercel serverless functions.

### Architecture Overview

The portal uses a **server-side proxy pattern** for API calls:

```
Client (Browser)
    ↓ fetch("/api/clients/.../templates")
Next.js Proxy (/api/clients/[...path]/route.ts)
    ↓ reads CLICKPRO_API_URL from server env
    ↓ proxies to ${CLICKPRO_API_URL}/api/clients/.../templates
ClickPro API (WhatsApp Integration)
```

**Benefits:**
- Client code doesn't need to know the upstream API URL
- API credentials never exposed to the browser
- Simplified CORS handling
- Single point of configuration (CLICKPRO_API_URL)

**Note:** Client-side pages may reference `NEXT_PUBLIC_CLICKPRO_API_URL` but when this is not set (recommended), they default to using relative URLs like `/api/clients/...` which automatically use the proxy.

## Vercel Deployment Steps

### 1. Configure Environment Variables

**CRITICAL**: You must set `CLICKPRO_API_URL` in Vercel for the proxy to work.

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add the following variables:

| Variable Name | Value | Environment | Required |
|--------------|-------|-------------|----------|
| `CLICKPRO_API_URL` | `https://your-api-server.com` | Production, Preview, Development | **YES** |
| `DATABASE_URL` | PostgreSQL connection string | Production, Preview, Development | **YES** |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` | Production, Preview, Development | **YES** |
| `NEXTAUTH_URL` | Your domain URL | Production | **YES** |
| `LICENSE_SIGNING_SECRET` | Generate with `openssl rand -base64 32` | Production, Preview, Development | **YES** |
| `SETUP_SECRET` | Generate with `openssl rand -base64 32` | Production, Preview, Development | **YES** |

### 2. Deploy or Redeploy

After setting environment variables:
- If first deployment: Click "Deploy"
- If updating existing deployment: Trigger a new deployment (Settings > Deployments > Redeploy)

### 3. Verify Deployment

#### Test the API Proxy

1. Open browser DevTools (F12) > Network tab
2. Navigate to Templates, Contacts, or any page that uses the API
3. Check the network requests:
   - Should see: `GET /api/clients/[clientId]/templates` → Status 200 (or 401 if not authenticated)
   - Should NOT see: Status 500 with "CLICKPRO_API_URL não configurado"

#### Check Logs

In Vercel dashboard:
1. Go to **Deployments** > Select latest deployment > **Functions**
2. Click on any `/api/clients/[...path]` function
3. Check logs for errors

### 4. Common Issues

#### Still getting 500 errors?

**Check 1**: Verify environment variable is set correctly
```bash
# In Vercel dashboard, Settings > Environment Variables
# Confirm CLICKPRO_API_URL is set for all environments
```

**Check 2**: Ensure you redeployed after adding the variable
```bash
# Variables are only loaded at deployment time
# You must redeploy for changes to take effect
```

**Check 3**: Check the variable value format
```bash
# Correct: https://api.example.com (no trailing slash)
# Correct: https://api.example.com/v1 (with path)
# Incorrect: https://api.example.com/ (trailing slash may cause issues)
```

**Check 4**: Verify the upstream API is accessible from Vercel
```bash
# The upstream API must be publicly accessible
# or accessible from Vercel's IP ranges
```

## Understanding Environment Variables in Next.js

### Server-Side Variables (Use in API Routes)
- No prefix (e.g., `CLICKPRO_API_URL`)
- Available at runtime via `process.env`
- NOT exposed to the browser
- ✅ Use for: API URLs, secrets, database connections

### Client-Side Variables (Use in Browser Code)
- Prefix with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_SITE_NAME`)
- Bundled at build time
- Exposed to the browser
- ❌ NOT available at runtime in API routes
- ✅ Use for: Public configuration, feature flags

### Why the Previous Code Failed

The previous code tried to use `NEXT_PUBLIC_CLICKPRO_API_URL` as a fallback:

```typescript
// ❌ WRONG - This doesn't work in API routes on Vercel
process.env.NEXT_PUBLIC_CLICKPRO_API_URL
```

In Vercel serverless functions, `NEXT_PUBLIC_*` variables are:
1. Replaced with their values at build time
2. Embedded in the client-side bundle
3. **NOT** available via `process.env` at runtime

### Current Implementation

```typescript
// ✅ CORRECT - Uses server-side env var
function getUpstreamBaseUrl() {
  return process.env.CLICKPRO_API_URL || "";
}
```

This works because `CLICKPRO_API_URL` (without `NEXT_PUBLIC_` prefix):
1. Is loaded at runtime from Vercel environment
2. Is available in serverless functions via `process.env`
3. Is never exposed to the browser

## Testing Locally

### Option 1: Using .env.local

```bash
cd portal
cp .env.example .env.local
# Edit .env.local and set:
# CLICKPRO_API_URL=http://localhost:3001
npm run dev
```

### Option 2: Using Environment Variables

```bash
cd portal
CLICKPRO_API_URL=http://localhost:3001 npm run dev
```

### Verify Local Setup

1. Start the ClickPro WhatsApp Integration server (default port 3001)
2. Start the portal: `npm run dev`
3. Open http://localhost:3000
4. Try to fetch templates - should proxy to http://localhost:3001/api/clients/.../templates

## Production Checklist

Before deploying to production:

- [ ] Set `CLICKPRO_API_URL` in Vercel environment variables
- [ ] Set `DATABASE_URL` in Vercel environment variables
- [ ] Set `NEXTAUTH_SECRET` in Vercel environment variables
- [ ] Set `NEXTAUTH_URL` in Vercel environment variables
- [ ] Set `LICENSE_SIGNING_SECRET` in Vercel environment variables
- [ ] Set `SETUP_SECRET` in Vercel environment variables
- [ ] Deploy or redeploy the application
- [ ] Test API proxy endpoints (templates, contacts, etc.)
- [ ] Check Vercel function logs for errors
- [ ] Verify no 500 errors related to CLICKPRO_API_URL

## Support

If you continue to experience issues:

1. Check Vercel function logs for detailed error messages
2. Verify the upstream API is responding correctly
3. Ensure the upstream API accepts requests from Vercel's IP ranges
4. Check that authentication tokens are being passed correctly
