# User Onboarding Webhook Setup

## Overview

This document explains how to configure automatic user onboarding for the SGE platform. When a user signs up, the system automatically:

1. Finds or creates an organization based on the `organization_name` provided
2. Creates a profile record with `role='member'` and `full_name=NULL`
3. Links the user to the organization

## Architecture

### Two Implementation Paths

**Path 1: Supabase Auth Webhook (Recommended)**
- Most reliable
- Better error handling and logging
- Easier to debug and monitor
- Requires public webhook endpoint

**Path 2: Database Trigger (Backup)**
- Runs inside Supabase database
- No external dependencies
- Backup if webhook fails
- Limited error handling

Both can run simultaneously for redundancy.

## Setup Instructions

### Step 1: Environment Configuration

Ensure your `.env` file contains:

```env
# Required for webhook to bypass RLS
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Already configured
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-anon-key
```

### Step 2A: Configure Supabase Webhook (Primary Method)

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Go to **Authentication** → **Webhooks**

2. **Add New Webhook**
   - Click **"Add Webhook"** or **"Create Webhook"**

3. **Configure Webhook Settings**
   ```
   Name: User Registration Webhook
   Event: user.created (or INSERT on auth.users)
   Webhook URL: https://your-backend-domain/webhooks/auth
   HTTP Method: POST
   ```

4. **Optional: Add Webhook Secret**
   - For production, add a secret for verification
   - Store it in `.env` as `WEBHOOK_SECRET`

5. **Save and Enable**

### Step 2B: Apply Database Trigger (Backup Method)

1. **Open Supabase SQL Editor**
   - Go to **SQL Editor** in Supabase Dashboard

2. **Run Trigger Script**
   - Open `database/trigger_user_onboarding.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **Run**

3. **Verify Installation**
   ```sql
   -- Check trigger exists
   SELECT tgname, tgrelid::regclass, tgfoid::regproc
   FROM pg_trigger
   WHERE tgname = 'on_auth_user_created';

   -- Check function exists  
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'handle_new_user_onboarding';
   ```

## Testing the Implementation

### Test 1: Run Automated Test Script

```bash
cd sge_backend
node test-onboarding.js
```

This will:
- Test organization creation
- Test profile creation
- Test finding existing organizations
- Test default organization behavior
- Clean up test data

Expected output:
```
🧪 Testing User Onboarding Service
═══════════════════════════════════════

📝 Test Case 1: First-time user signup with new organization
─────────────────────────────────────────────────────────────
✅ Result:
   Organization Created: Test Organization for Onboarding (uuid)
   Profile Created: User uuid with role 'member'
   ...

🎉 All tests passed successfully!
```

### Test 2: Manual Webhook Test

Test the webhook endpoint directly:

```bash
# Replace with your backend URL and a test user ID
curl -X POST https://your-backend-url/webhooks/auth \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "record": {
      "id": "test-user-uuid-here",
      "email": "test@example.com",
      "raw_user_meta_data": {
        "organization_name": "Test Company"
      }
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "User onboarded successfully",
  "userId": "test-user-uuid-here",
  "organizationId": "org-uuid",
  "organizationName": "Test Company"
}
```

### Test 3: End-to-End Signup Flow

1. **Start the backend**
   ```bash
   cd sge_backend
   npm start
   ```

2. **Open frontend and sign up**
   - Navigate to `/signup`
   - Enter email, password, and organization name
   - Submit form

3. **Verify in Supabase Dashboard**
   ```sql
   -- Check the user was created
   SELECT id, email, raw_user_meta_data->>'organization_name' as org_name
   FROM auth.users
   WHERE email = 'your-test-email@example.com';

   -- Check organization was created
   SELECT * FROM organizations
   WHERE name ILIKE '%your-org-name%';

   -- Check profile was created and linked
   SELECT 
     p.id,
     p.role,
     p.full_name,
     o.name as organization_name
   FROM profiles p
   JOIN organizations o ON p.org_id = o.id
   WHERE p.id = (SELECT id FROM auth.users WHERE email = 'your-test-email@example.com');
   ```

4. **Expected Results**
   - ✅ User exists in `auth.users`
   - ✅ Organization exists in `organizations`
   - ✅ Profile exists in `profiles` with correct `org_id` and `role='member'`
   - ✅ `full_name` is `NULL`

## API Documentation

### Webhook Endpoints

#### POST /webhooks/auth
**Purpose:** Receives Supabase auth webhooks

**Authentication:** None (called by Supabase)

**Request Body:**
```json
{
  "type": "INSERT",
  "record": {
    "id": "user-uuid",
    "email": "user@example.com",
    "raw_user_meta_data": {
      "organization_name": "Company Name"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "User onboarded successfully",
  "userId": "user-uuid",
  "organizationId": "org-uuid",
  "organizationName": "Company Name"
}
```

#### POST /webhooks/onboard
**Purpose:** Manual onboarding for recovery

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "userId": "user-uuid",
  "organizationName": "Company Name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User onboarded successfully",
  "organization": { "id": "...", "name": "..." },
  "profile": { "id": "...", "org_id": "...", "role": "member" }
}
```

## Monitoring and Troubleshooting

### Check Backend Logs

```bash
# Look for these log messages:
# "Received auth webhook: { type: 'INSERT', userId: '...' }"
# "Starting onboarding for user ..."
# "Created organization: ... (...)"
# "Created profile for user ..."
# "Successfully onboarded user ..."
```

### Common Issues

#### Issue 1: Webhook Not Firing

**Symptoms:** User created but no profile

**Debug Steps:**
1. Check Supabase webhook configuration
2. Verify webhook URL is publicly accessible
3. Check Supabase webhook logs (Dashboard → Authentication → Webhooks)
4. Test webhook manually with curl
5. Check if trigger is installed as backup

**Solution:**
```bash
# Test webhook connectivity
curl -X POST https://your-backend-url/webhooks/auth \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","record":{"id":"test"}}'
```

#### Issue 2: "Supabase admin client is not configured"

**Symptoms:** Error in logs, webhook returns error

**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`
- Restart backend after adding the key
- Check key is valid in Supabase Dashboard → Settings → API

#### Issue 3: Organization Not Created

**Symptoms:** Profile created but `org_id` is NULL

**Debug Steps:**
1. Check if organization_name was passed in signup
2. Check RLS policies allow organization creation
3. Review backend logs for errors

**Solution:**
- Ensure frontend passes `organization_name` in metadata
- Verify admin client has permission to insert organizations

#### Issue 4: Duplicate Profiles

**Symptoms:** Multiple profiles for same user

**Solution:**
- Service includes duplicate check
- If duplicates exist, delete extras:
```sql
DELETE FROM profiles
WHERE id = 'user-uuid'
AND created_at < (
  SELECT MAX(created_at) FROM profiles WHERE id = 'user-uuid'
);
```

### Database Queries for Monitoring

```sql
-- Check users without profiles (onboarding failures)
SELECT u.id, u.email, u.created_at, u.raw_user_meta_data->>'organization_name' as org_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

-- Onboarding success rate (last 7 days)
SELECT 
  COUNT(DISTINCT u.id) as total_signups,
  COUNT(DISTINCT p.id) as successful_onboards,
  ROUND(COUNT(DISTINCT p.id)::numeric / COUNT(DISTINCT u.id) * 100, 2) as success_rate_percent
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.created_at > NOW() - INTERVAL '7 days';

-- Recent onboarding activity
SELECT 
  p.created_at,
  u.email,
  o.name as organization,
  p.role
FROM profiles p
JOIN auth.users u ON p.id = u.id
JOIN organizations o ON p.org_id = o.id
ORDER BY p.created_at DESC
LIMIT 10;
```

## Security Considerations

1. **Webhook Security**
   - Webhook endpoint is public (no auth required for Supabase to call it)
   - Consider adding webhook signature verification in production
   - Rate limit the webhook endpoint

2. **Service Role Key**
   - Keep `SUPABASE_SERVICE_ROLE_KEY` secret
   - Never commit to version control
   - Rotate periodically

3. **Manual Onboarding Endpoint**
   - Protected by authentication middleware
   - Only authenticated users can trigger manual onboarding
   - Consider restricting to admin role only

4. **RLS Policies**
   - Existing RLS policies remain in effect
   - Service uses admin client to bypass RLS for initial creation
   - Users can only see their own org and profiles after creation

## Production Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured in production `.env`
- [ ] Supabase webhook configured with production backend URL
- [ ] Database trigger applied as backup
- [ ] Webhook endpoint is publicly accessible
- [ ] SSL/TLS enabled on backend
- [ ] Error monitoring/logging configured
- [ ] Test signup flow in production
- [ ] Monitor onboarding success rate
- [ ] Set up alerts for onboarding failures

## Additional Resources

- See `database/ONBOARDING_SETUP.md` for detailed database setup
- See `database/trigger_user_onboarding.sql` for trigger implementation
- See Swagger docs at `/docs` for API reference
- Run `node test-onboarding.js` for automated testing

## Support

For issues or questions:
1. Check backend logs for error messages
2. Review Supabase webhook logs
3. Run the test script: `node test-onboarding.js`
4. Verify environment variables are set correctly
5. Check database for orphaned records
