# User Onboarding Setup Guide

This guide explains how to set up automatic user onboarding for the SGE platform.

## Overview

When a user signs up, the system automatically:
1. Finds or creates an organization based on the `organization_name` provided during signup
2. Creates a profile record for the user with `role='member'` and `full_name=NULL`
3. Links the user to the organization via `org_id`

## Implementation Methods

There are **two methods** to ensure users are onboarded:

### Method 1: Supabase Auth Webhook (Primary)

This is the **recommended** approach as it's more reliable and provides better error handling.

#### Setup Steps:

1. **Configure Webhook in Supabase Dashboard:**
   - Go to **Authentication → Webhooks**
   - Click **Add Webhook**
   - Configure:
     - **Event**: `user.created` (or `auth.user.created` depending on your Supabase version)
     - **Webhook URL**: `https://your-backend-url/webhooks/auth`
     - **HTTP Method**: POST
     - **Secret**: (optional) Add a webhook secret for security
   - Click **Save**

2. **Environment Configuration:**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in your `.env` file
   - This key is required for the webhook to bypass RLS and create records

3. **Test the Webhook:**
   ```bash
   # Use the manual onboarding endpoint for testing
   curl -X POST https://your-backend-url/webhooks/onboard \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId": "USER_UUID", "organizationName": "Test Org"}'
   ```

### Method 2: Database Trigger (Backup)

This method serves as a **backup** in case the webhook fails or is not configured.

#### Setup Steps:

1. **Apply the Trigger:**
   - Go to **Supabase Dashboard → SQL Editor**
   - Open `trigger_user_onboarding.sql` from this directory
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click **Run**

2. **Verify Installation:**
   ```sql
   -- Check if trigger exists
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   
   -- Check if function exists
   SELECT * FROM pg_proc WHERE proname = 'handle_new_user_onboarding';
   ```

## How It Works

### Frontend Signup Flow

1. User fills out signup form with:
   - Email
   - Password
   - Organization Name (optional)

2. Frontend calls `supabase.auth.signUp()` with metadata:
   ```javascript
   supabase.auth.signUp({
     email,
     password,
     options: {
       data: {
         organization_name: orgName
       }
     }
   })
   ```

3. Supabase creates the user in `auth.users` table

### Backend Onboarding Flow

**Via Webhook (Method 1):**
1. Supabase sends webhook to `/webhooks/auth`
2. Backend receives `user.created` event with user data
3. `userOnboardingService.onboardUser()` is called:
   - Extracts `organization_name` from `raw_user_meta_data`
   - Searches for existing organization with matching name (case-insensitive)
   - If found, uses existing org; otherwise creates new org
   - Creates profile with `id=user.id`, `org_id`, `role='member'`, `full_name=NULL`
4. Returns success response

**Via Trigger (Method 2):**
1. Trigger fires on INSERT to `auth.users`
2. Function extracts organization name from metadata
3. Finds or creates organization
4. Creates profile record
5. Returns (errors are logged but don't fail user creation)

## Testing User Signup

### Test with Mock Data

1. **Sign up a test user via frontend:**
   - Go to `/signup`
   - Fill form with:
     - Email: `test@example.com`
     - Password: `testpass123`
     - Organization: `Test Organization`
   - Submit

2. **Verify in Supabase Dashboard:**
   ```sql
   -- Check user was created
   SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'test@example.com';
   
   -- Check organization was created/found
   SELECT * FROM organizations WHERE name ILIKE '%Test Organization%';
   
   -- Check profile was created
   SELECT p.*, o.name as org_name 
   FROM profiles p
   JOIN organizations o ON p.org_id = o.id
   WHERE p.id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
   ```

3. **Expected Results:**
   - User exists in `auth.users` with `organization_name` in metadata
   - Organization exists in `organizations` table
   - Profile exists in `profiles` with correct `org_id` and `role='member'`

### Manual Onboarding (Recovery)

If a user was created but not onboarded (profile missing), use the manual endpoint:

```bash
curl -X POST https://your-backend-url/webhooks/onboard \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID_HERE",
    "organizationName": "Desired Org Name"
  }'
```

## Troubleshooting

### User created but no profile

**Symptoms:** User can log in but gets errors like "User does not belong to an organization"

**Solutions:**
1. Check webhook logs in Supabase Dashboard
2. Check backend logs for webhook errors
3. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
4. Use manual onboarding endpoint to fix
5. If trigger is installed, check database logs

### Organization not found or created

**Symptoms:** Profile exists but `org_id` is NULL or points to wrong org

**Solutions:**
1. Check if organization name was passed correctly in signup metadata
2. Verify RLS policies allow organization creation
3. Check database logs for errors

### Webhook not firing

**Symptoms:** No webhook logs in backend, no profile created

**Solutions:**
1. Verify webhook URL is correct and publicly accessible
2. Check webhook configuration in Supabase Dashboard
3. Test webhook manually using curl or Postman
4. Ensure backend is running and accessible
5. Check if trigger is installed as backup

## Security Considerations

1. **Webhook Endpoint:** Consider adding webhook signature verification
2. **Manual Onboarding:** Only allow admins to use this endpoint
3. **Service Role Key:** Keep `SUPABASE_SERVICE_ROLE_KEY` secret and secure
4. **RLS Policies:** Existing policies remain unchanged and secure

## API Documentation

All webhook endpoints are documented in Swagger:
- Visit `https://your-backend-url/docs`
- Look for **Webhooks** tag
- Endpoints:
  - `POST /webhooks/auth` - Supabase auth webhook
  - `POST /webhooks/onboard` - Manual onboarding (protected)

## Monitoring

Monitor onboarding success by:

1. **Backend Logs:**
   ```bash
   # Look for these log messages:
   # "Starting onboarding for user {userId}"
   # "Created organization: {name} ({id})"
   # "Created profile for user {userId}"
   # "Successfully onboarded user {userId}"
   ```

2. **Database Queries:**
   ```sql
   -- Check recent signups without profiles
   SELECT u.id, u.email, u.created_at
   FROM auth.users u
   LEFT JOIN profiles p ON u.id = p.id
   WHERE p.id IS NULL
   AND u.created_at > NOW() - INTERVAL '24 hours';
   
   -- Check onboarding success rate
   SELECT 
     COUNT(*) as total_users,
     COUNT(p.id) as onboarded_users,
     COUNT(*) - COUNT(p.id) as missing_profiles
   FROM auth.users u
   LEFT JOIN profiles p ON u.id = p.id
   WHERE u.created_at > NOW() - INTERVAL '7 days';
   ```

## Next Steps

After setup:
1. ✅ Apply database schema (`schema.sql`)
2. ✅ Configure Supabase webhook (Method 1)
3. ✅ OR apply database trigger (Method 2)
4. ✅ Set `SUPABASE_SERVICE_ROLE_KEY` in `.env`
5. ✅ Test signup flow
6. ✅ Monitor logs and database
