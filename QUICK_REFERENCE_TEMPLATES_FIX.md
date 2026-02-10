# Quick Reference: /api/clients/:id/templates Error Fix

## What Was Fixed
The silent 500 Internal Server Error on `/api/clients/:id/templates` endpoint now returns detailed, traceable error messages.

## How to Use

### For Production Deployment (Vercel)

1. **Verify Environment Variable:**
   ```
   Vercel Dashboard > Project Settings > Environment Variables
   
   Required:
   - CLICKPRO_API_URL = http://your-backend-url
   ```

2. **Deploy the changes**

3. **Test the endpoint:**
   ```bash
   # Should return detailed error if client not found
   curl https://your-app.vercel.app/api/clients/123/templates
   ```

4. **Check logs if there are issues:**
   ```
   Vercel Dashboard > Deployments > Latest > Function Logs
   Search for: [apiProxy]
   ```

### For Local Development

1. **Set environment variable:**
   ```bash
   # In portal/.env
   CLICKPRO_API_URL=http://localhost:3001
   ```

2. **Run the portal:**
   ```bash
   cd portal
   npm install
   npm run dev
   ```

3. **Test the endpoint:**
   ```bash
   # Manual test
   curl http://localhost:3000/api/clients/123/templates
   
   # Or use the test script
   node portal/scripts/test-api-proxy-errors.js
   ```

### Enable Debug Logging (Production)

If you need detailed logs in production:

1. Add environment variable in Vercel:
   ```
   DEBUG_API_PROXY = true
   ```

2. Redeploy

3. Logs will now include all request/response details

4. **Remember to remove** this variable when debugging is complete to reduce log costs

## Error Response Examples

### Missing Client ID (400)
```json
{
  "error": "Client ID is required",
  "details": "The path must include a client ID: /api/clients/{id}/..."
}
```

### Missing Environment Variable (500)
```json
{
  "error": "CLICKPRO_API_URL não configurado no servidor",
  "details": "Configure a variável de ambiente CLICKPRO_API_URL nas configurações do Vercel..."
}
```

### Backend Error (404/500)
```json
{
  "error": "Upstream API returned 404",
  "details": {
    "error": "Client not found"
  },
  "upstreamStatus": 404
}
```

## Testing Checklist

- [ ] Verify `CLICKPRO_API_URL` is set in Vercel
- [ ] Test with missing client ID: `/api/clients//templates` → Should return 400
- [ ] Test with invalid client ID: `/api/clients/999999/templates` → Should return error from backend
- [ ] Test with valid client ID (if backend configured)
- [ ] Check Vercel logs show `[apiProxy]` messages for errors

## Documentation

- **Detailed Error Scenarios:** `portal/docs/API_PROXY_ERROR_HANDLING.md`
- **Complete Fix Summary:** `FIX_SUMMARY_TEMPLATES_ERROR.md`
- **Test Script:** `portal/scripts/test-api-proxy-errors.js`

## Support

If you're still seeing 500 errors:

1. Check Vercel Function Logs for `[apiProxy]` messages
2. Verify `CLICKPRO_API_URL` is set correctly
3. Enable `DEBUG_API_PROXY=true` temporarily for detailed logs
4. Check the backend API is accessible from Vercel
