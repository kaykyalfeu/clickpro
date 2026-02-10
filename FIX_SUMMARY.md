# Fix Summary: API Proxy Environment Variable Resolution

## Issue Fixed ✅

**Problem**: API proxy at `/api/clients/:id/templates` was returning 500 errors in production with message:
```
CLICKPRO_API_URL não configurado no servidor. Configure CLICKPRO_API_URL...
```

**Root Cause**: The proxy code was trying to read `NEXT_PUBLIC_*` environment variables at runtime in a server-side API route. In Vercel, these variables are only available at build time, not at runtime.

## Solution

Changed the proxy to use **only** `CLICKPRO_API_URL` (server-side environment variable), which is available at runtime in Vercel serverless functions.

### Code Changes

**Before** (broken):
```typescript
function getUpstreamBaseUrl() {
  return (
    process.env.CLICKPRO_API_URL
    || process.env.NEXT_PUBLIC_CLICKPRO_API_URL  // ❌ Not available at runtime
    || process.env.NEXT_PUBLIC_API_BASE_URL      // ❌ Not available at runtime
    || ""
  );
}
```

**After** (fixed):
```typescript
function getUpstreamBaseUrl() {
  // CRITICAL: Only use server-side env var CLICKPRO_API_URL
  // NEXT_PUBLIC_* variables are NOT available at runtime in API routes on Vercel
  return process.env.CLICKPRO_API_URL || "";
}
```

## What You Need to Do

### 1. Set Environment Variable in Vercel

1. Go to: https://vercel.com/[your-team]/[your-project]/settings/environment-variables
2. Click "Add New"
3. Set:
   - **Key**: `CLICKPRO_API_URL`
   - **Value**: URL of your ClickPro/WhatsApp Integration API (e.g., `https://api.clickpro.example.com`)
   - **Environments**: Check all three: Production ✓, Preview ✓, Development ✓
4. Click "Save"

### 2. Redeploy

- Go to: https://vercel.com/[your-team]/[your-project]
- Click "Deployments" tab
- Find the latest deployment
- Click "..." menu > "Redeploy"

**OR** merge this PR and it will auto-deploy.

### 3. Verify

After deployment:

1. Open your portal: `https://clickpro.grupogarciaseguradoras.com.br`
2. Navigate to any page that uses the API (Templates, Contacts, etc.)
3. Open Browser DevTools (F12) > Network tab
4. Look for requests to `/api/clients/.../templates`
5. Should see: **Status 200** (or 401 if not authenticated)
6. Should NOT see: **Status 500** with CLICKPRO_API_URL error

## Understanding the Fix

### Why NEXT_PUBLIC_* Doesn't Work at Runtime

In Next.js:

- **Build time**: `NEXT_PUBLIC_*` variables are read and replaced with their literal values
- **Client bundle**: These values are embedded in the JavaScript sent to browsers
- **Runtime**: The `process.env.NEXT_PUBLIC_*` expressions are already replaced, so they're not in `process.env`

Example:
```typescript
// At build time:
const apiUrl = process.env.NEXT_PUBLIC_API_URL;  // Reads from .env

// In bundled code sent to browser:
const apiUrl = "https://example.com";  // Literal value

// In server-side code at runtime:
process.env.NEXT_PUBLIC_API_URL  // ❌ undefined! The variable is gone
```

### How Server-Side Env Vars Work

Server-side variables (without `NEXT_PUBLIC_` prefix):

- **Build time**: Available in server components and at build time
- **Runtime**: Available in API routes, server actions, server components
- **Client bundle**: NOT included (more secure)

```typescript
// At runtime in API route:
process.env.CLICKPRO_API_URL  // ✅ Reads from Vercel environment
```

## Files Changed

- `portal/src/lib/apiProxy.ts` - Main fix: removed NEXT_PUBLIC_ fallbacks
- `portal/.env.example` - Added documentation about env vars
- `portal/README.md` - Added environment variables section
- `portal/VERCEL_DEPLOYMENT.md` - Complete deployment guide

## Additional Documentation

See these files for more details:

- `portal/VERCEL_DEPLOYMENT.md` - Complete Vercel deployment guide
- `portal/README.md` - Environment variables section
- `portal/.env.example` - All available environment variables

## Support

If you still see errors after following these steps:

1. Check Vercel function logs: Deployments > [latest] > Functions > `/api/clients/[...path]`
2. Verify `CLICKPRO_API_URL` is set correctly in Vercel environment variables
3. Ensure the upstream API is accessible from Vercel
4. Check that the URL has no trailing slash: `https://api.example.com` not `https://api.example.com/`
