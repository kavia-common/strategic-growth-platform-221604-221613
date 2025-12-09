# CORS Configuration

## Overview

The Express backend is configured to enable Cross-Origin Resource Sharing (CORS) to allow the React frontend (running on a different origin) to make API requests.

## Allowed Origins

The following origins are allowed by default:

1. `http://localhost:3000` - Local development frontend
2. `https://vscode-internal-30623-beta.beta01.cloud.kavia.ai:3000` - Preview environment frontend
3. Any origin specified in `process.env.FRONTEND_ORIGIN`
4. Any origin specified in `process.env.REACT_APP_FRONTEND_URL`

## Configuration Details

### Location
CORS configuration is in `src/app.js`

### Settings

- **Methods**: GET, POST, PUT, DELETE, PATCH, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Requested-With, Accept
- **Exposed Headers**: Content-Length, X-Request-Id
- **Credentials**: Enabled (true) - allows cookies and auth headers
- **Preflight**: Automatic handling with 204 status

### Dynamic Origin Handling

The CORS middleware uses a function to dynamically check origins:

```javascript
origin: function (origin, callback) {
  if (!origin) return callback(null, true); // Allow no-origin requests
  
  if (allowedOrigins.indexOf(origin) !== -1) {
    callback(null, true); // Allowed
  } else {
    console.warn(`CORS blocked origin: ${origin}`);
    callback(null, true); // Allow in dev but log warning
  }
}
```

## Testing CORS

### Method 1: Using the test script

```bash
# From the sge_backend directory
node test-cors.js
```

### Method 2: Using curl

```bash
# Test preflight request
curl -X OPTIONS http://localhost:3001/ \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v
```

Expected response headers:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept
Access-Control-Allow-Credentials: true
```

### Method 3: Browser DevTools

1. Open the frontend in a browser
2. Open DevTools → Network tab
3. Make an API request
4. Check the response headers for `Access-Control-Allow-*` headers

## Environment Variables

To configure additional allowed origins, set these in your `.env` file:

```env
FRONTEND_ORIGIN=https://your-custom-domain.com
REACT_APP_FRONTEND_URL=https://another-domain.com
```

## Troubleshooting

### Issue: CORS error still appears

1. **Check the origin**: Ensure the frontend origin matches one of the allowed origins
2. **Check credentials**: If using auth tokens/cookies, ensure `credentials: 'include'` is set in frontend fetch/axios
3. **Check headers**: Ensure the frontend is sending allowed headers only
4. **Check logs**: Look for "CORS blocked origin" warnings in backend logs

### Issue: Preflight requests failing

1. Ensure OPTIONS method is allowed (it is by default)
2. Check that `optionsSuccessStatus: 204` is set
3. Verify no authentication middleware is blocking OPTIONS requests

### Issue: Credentials not working

1. Ensure `credentials: true` in CORS config (backend)
2. Ensure `credentials: 'include'` in fetch/axios config (frontend)
3. Verify `Access-Control-Allow-Credentials: true` header is present

## Production Considerations

For production deployment:

1. **Remove wildcard acceptance**: Update the origin function to strictly reject unknown origins
2. **Set specific origins**: Configure exact production URLs via environment variables
3. **Enable HTTPS only**: Ensure all origins use HTTPS in production
4. **Rate limiting**: Consider adding rate limiting for OPTIONS requests
5. **Monitoring**: Log blocked origins for security monitoring

Example production configuration:

```javascript
origin: function (origin, callback) {
  if (!origin) return callback(new Error('Not allowed by CORS'));
  
  if (allowedOrigins.indexOf(origin) !== -1) {
    callback(null, true);
  } else {
    console.error(`CORS blocked unauthorized origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  }
}
```

## References

- [Express CORS middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [MDN: Preflight requests](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
