# API Proxy Error Handling - Testing Guide

## Overview

This document explains the error handling improvements made to the `/api/clients/:id/templates` endpoint and other proxied routes through `/api/clients/[...path]`.

## What Was Fixed

The proxy function in `portal/src/lib/apiProxy.ts` now includes:

1. **Comprehensive try/catch blocks** - No more unhandled exceptions
2. **Detailed server-side logging** - All requests/responses are logged
3. **Validation** - Client ID and environment variables are validated
4. **Structured error responses** - All errors return JSON with `error` and `details` fields

## Logging Levels

The proxy now uses different logging levels:

- **Development Mode** (`NODE_ENV=development`): All debug logs are enabled
- **Production Mode with Debug**: Set `DEBUG_API_PROXY=true` to enable detailed logging
- **Production Mode**: Only critical errors are logged

This reduces log noise and costs in production while maintaining full debugging capability when needed.

To enable debug logging in production (Vercel):
1. Go to Project Settings > Environment Variables
2. Add `DEBUG_API_PROXY` with value `true`
3. Redeploy

## Error Scenarios & Expected Responses

### Scenario 1: Missing Environment Variable (CLICKPRO_API_URL)

**Request:**
```bash
GET /api/clients/123/templates
```

**Expected Response:**
```json
{
  "error": "CLICKPRO_API_URL não configurado no servidor",
  "details": "Configure a variável de ambiente CLICKPRO_API_URL nas configurações do Vercel (Project Settings > Environment Variables)."
}
```

**Status:** `500`

**Server Logs (Development/Debug mode):**
```
[apiProxy] Request method: GET
[apiProxy] Path segments: ['123', 'templates']
[apiProxy] Request URL: http://localhost:3000/api/clients/123/templates
[apiProxy] Client ID: 123
[apiProxy] Base URL: (not set)
[apiProxy] ERROR: Failed to build upstream URL - CLICKPRO_API_URL not configured
```

**Server Logs (Production mode):**
```
[apiProxy] ERROR: Failed to build upstream URL - CLICKPRO_API_URL not configured
```

### Scenario 2: Missing Client ID

**Request:**
```bash
GET /api/clients//templates
```

**Expected Response:**
```json
{
  "error": "Client ID is required",
  "details": "The path must include a client ID: /api/clients/{id}/..."
}
```

**Status:** `400`

**Server Logs:**
```
[apiProxy] ERROR: Missing client ID in path
```

**Note:** The client ID is validated with `.trim()`, so empty strings are treated as missing.

### Scenario 3: Upstream API Returns 404 (Client Not Found)

**Request:**
```bash
GET /api/clients/999999/templates
```

**Expected Response:**
```json
{
  "error": "Upstream API returned 404",
  "details": {
    "error": "Client not found"
  },
  "upstreamStatus": 404
}
```

**Status:** `404`

**Server Logs (Development/Debug mode):**
```
[apiProxy] Request method: GET
[apiProxy] Path segments: ['999999', 'templates']
[apiProxy] Request URL: http://localhost:3000/api/clients/999999/templates
[apiProxy] Client ID: 999999
[apiProxy] Base URL: http://localhost:3001
[apiProxy] Upstream URL: http://localhost:3001/api/clients/999999/templates
[apiProxy] Sending request to upstream...
[apiProxy] Upstream response status: 404
[apiProxy] Upstream response ok: false
[apiProxy] Upstream error response body: {"error":"Client not found"}
```

**Server Logs (Production mode):**
```
[apiProxy] Upstream error response body: {"error":"Client not found"}
```

### Scenario 4: Upstream API Returns 500 (Server Error)

**Request:**
```bash
GET /api/clients/123/templates
```

**Expected Response:**
```json
{
  "error": "Upstream API returned 500",
  "details": {
    "error": "Database connection failed"
  },
  "upstreamStatus": 500
}
```

**Status:** `500`

**Server Logs:**
```
[apiProxy] Request method: GET
[apiProxy] Path segments: ['123', 'templates']
[apiProxy] Request URL: http://localhost:3000/api/clients/123/templates
[apiProxy] Client ID: 123
[apiProxy] Base URL: http://localhost:3001
[apiProxy] Upstream URL: http://localhost:3001/api/clients/123/templates
[apiProxy] Sending request to upstream...
[apiProxy] Upstream response status: 500
[apiProxy] Upstream response ok: false
[apiProxy] Upstream error response body: {"error":"Database connection failed"}
```

### Scenario 5: Network Error / Fetch Failure

**Request:**
```bash
GET /api/clients/123/templates
```

**Expected Response (Development):**
```json
{
  "error": "Internal proxy error",
  "details": "fetch failed",
  "stack": "Error: fetch failed\n    at ..."
}
```

**Expected Response (Production):**
```json
{
  "error": "Internal proxy error",
  "details": "fetch failed"
}
```

**Status:** `500`

**Server Logs:**
```
[apiProxy] CRITICAL ERROR: Error: fetch failed
[apiProxy] Error stack: Error: fetch failed
    at ...
```

**Note:** Stack traces are only included in the response body in development mode for security reasons. They are always logged server-side.

### Scenario 6: Successful Request

**Request:**
```bash
GET /api/clients/123/templates
Authorization: Bearer <valid-token>
```

**Expected Response:**
```json
{
  "templates": [
    {
      "id": 1,
      "name": "welcome_message",
      "status": "APPROVED"
    }
  ]
}
```

**Status:** `200`

**Server Logs (Development/Debug mode):**
```
[apiProxy] Request method: GET
[apiProxy] Path segments: ['123', 'templates']
[apiProxy] Request URL: http://localhost:3000/api/clients/123/templates
[apiProxy] Client ID: 123
[apiProxy] Base URL: http://localhost:3001
[apiProxy] Upstream URL: http://localhost:3001/api/clients/123/templates
[apiProxy] Sending request to upstream...
[apiProxy] Upstream response status: 200
[apiProxy] Upstream response ok: true
[apiProxy] Successful response, forwarding to client
```

**Server Logs (Production mode):**
```
(No logs unless DEBUG_API_PROXY=true)
```

## Testing Checklist

### Local Testing (Development)

1. **Test without CLICKPRO_API_URL:**
   ```bash
   # Remove CLICKPRO_API_URL from .env
   curl http://localhost:3000/api/clients/123/templates
   # Expected: 500 with "CLICKPRO_API_URL não configurado"
   ```

2. **Test with missing client ID:**
   ```bash
   curl http://localhost:3000/api/clients//templates
   # Expected: 400 with "Client ID is required"
   ```

3. **Test with valid setup but invalid client ID:**
   ```bash
   # Set CLICKPRO_API_URL in .env
   curl http://localhost:3000/api/clients/999999/templates
   # Expected: 404 or error from upstream API
   ```

4. **Test with valid client ID:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        http://localhost:3000/api/clients/123/templates
   # Expected: 200 with templates data
   ```

### Production Testing (Vercel)

1. **Verify environment variable in Vercel:**
   - Go to Project Settings > Environment Variables
   - Confirm `CLICKPRO_API_URL` is set
   - Redeploy if needed

2. **Test production endpoint:**
   ```bash
   curl https://your-app.vercel.app/api/clients/123/templates
   ```

3. **Check Vercel logs:**
   - Go to Vercel Dashboard > Your Project > Deployments
   - Click on latest deployment
   - View Function Logs
   - Search for `[apiProxy]` to see detailed logs

## Root Cause Analysis

Based on the implementation, the 500 error could have been caused by:

### ❓ Was it an environment variable issue?
**Likely: YES** - If `CLICKPRO_API_URL` was not configured in Vercel, the previous implementation returned a 500 error without detailed logging, making it hard to diagnose.

### ❓ Was it a missing/invalid route?
**Possible: YES** - If the upstream API didn't have the `/api/clients/:id/templates` endpoint, or if it returned an error, the previous implementation would forward the error without logging details.

### ❓ Was it invalid data?
**Possible: YES** - If the client ID was invalid or the upstream API rejected it, the previous implementation didn't log the error details, making debugging difficult.

## Additional Notes

- All errors are logged with `console.error` to ensure they appear in server logs
- Error responses always include `Content-Type: application/json`
- Stack traces are only included in critical errors to aid debugging
- The proxy preserves the original status code from the upstream API when possible
- Authorization headers are forwarded to the upstream API
