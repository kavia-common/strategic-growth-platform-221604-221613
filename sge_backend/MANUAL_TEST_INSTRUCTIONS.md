# Manual Testing Instructions for Onboarding Endpoint

This document provides step-by-step instructions for manually testing the onboarding endpoint.

## Prerequisites

1. Server must be running: `npm start` or `npm run dev`
2. Supabase project must be configured with correct credentials in `.env`
3. Database schema must be applied (organizations and profiles tables)

## Step 1: Create a Test User

Use the Supabase Dashboard or create a user via the API:

```bash
# Option A: Use Supabase Dashboard
# Go to Authentication > Users > Add User
# Email: test@example.com
# Password: TestPassword123!

# Option B: Use curl to sign up
curl -X POST 'https://kdqhrrnhzbgszjoqgvje.supabase.co/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

## Step 2: Get an Access Token

Sign in to get an access token:

```bash
curl -X POST 'https://kdqhrrnhzbgszjoqgvje.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

Save the `access_token` from the response.

## Step 3: Call the Onboarding Endpoint

```bash
curl -X POST http://localhost:3001/api/onboarding/complete \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_name": "My Test Organization"
  }'
```

## Expected Response

Success (200):
```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "org": {
    "id": "uuid-here",
    "name": "My Test Organization"
  },
  "profile": {
    "id": "uuid-here",
    "org_id": "uuid-here",
    "role": "member",
    "full_name": null
  }
}
```

## Step 4: Verify in Database

Check the Supabase Dashboard:

1. Go to Table Editor
2. Check `organizations` table - should have your organization
3. Check `profiles` table - should have a profile linking your user to the organization

## Step 5: Test Idempotency

Call the endpoint again with the same token and organization name. Should return the same data with message "User already onboarded".

## Troubleshooting

### 401 Unauthorized
- Check that the token is valid and not expired
- Verify the Authorization header is correctly formatted: `Bearer <token>`

### 400 Bad Request
- Ensure `organization_name` is provided in the request body
- Check that it's a non-empty string

### 500 Internal Server Error
- Check server logs for detailed error messages
- Verify Supabase credentials are correct
- Ensure database tables exist and RLS policies are set up

### Organization/Profile Not Created
- Check server logs for detailed error messages (with debug logging enabled)
- Verify RLS policies allow inserts for authenticated users
- Check that SUPABASE_SERVICE_ROLE_KEY is set correctly
- Ensure the service uses `supabaseAdmin` client for writes

## Debug Logging

All debug logs are prefixed with:
- `[OnboardingController]` - Controller layer logs
- `[UserOnboardingService]` - Service layer logs
- `[AuthMiddleware]` - Authentication logs

Check the server console for these logs during testing.
