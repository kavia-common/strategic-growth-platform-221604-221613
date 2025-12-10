# Simplified User Onboarding Design & Implementation Guide

## Executive Summary

This document proposes the simplest possible onboarding approach for the Strategic Growth Engine (SGE) platform: handling organization and profile creation via a **single backend endpoint call immediately after signup**, eliminating the need for webhooks or database triggers.

**Key Benefits:**
- ✅ No webhook configuration required
- ✅ No database triggers needed
- ✅ Simpler debugging and error handling
- ✅ Explicit control flow in application code
- ✅ Works identically in development and production

---

## Current Architecture Problems

### Problem 1: Complexity

The current system has **three** potential onboarding mechanisms:
1. Supabase Auth Webhook → Backend endpoint
2. Database trigger on `auth.users` INSERT
3. Manual onboarding endpoint (recovery only)

This creates confusion about which mechanism is actually working and increases failure points.

### Problem 2: Trigger Error Analysis

The database trigger (`trigger_user_onboarding.sql`) likely fails due to one or more of these issues:

#### Issue A: Permission Problems
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_onboarding();
```

**Root Cause:** The trigger attempts to create a trigger on the `auth.users` table, which is in the `auth` schema (owned by Supabase). Standard database users typically don't have permission to create triggers on system schemas.

**Error Message You'll See:**
```
ERROR: permission denied for table users
ERROR: must be owner of table users
ERROR: permission denied for schema auth
```

#### Issue B: RLS Policy Conflicts

The trigger function uses `SECURITY DEFINER` to bypass RLS, but:
- The function runs as the function owner (your DB user)
- RLS policies on `organizations` and `profiles` may still block INSERTs
- Service role permissions are needed but not available in trigger context

**Error Message You'll See:**
```
ERROR: new row violates row-level security policy
ERROR: permission denied for table organizations
```

#### Issue C: Metadata Access Timing

```sql
v_org_name := COALESCE(
  NEW.raw_user_meta_data->>'organization_name',
  NEW.raw_user_meta_data->>'organizationName',
  'Default Organization'
);
```

**Root Cause:** The `raw_user_meta_data` field might not be populated yet when the trigger fires, or Supabase's internal auth flow may not have committed the metadata at trigger execution time.

#### Issue D: Transaction Isolation

If the auth user creation and trigger execution are in separate transactions, the trigger might not see the committed user data yet, leading to race conditions.

---

## Proposed Solution: Post-Signup Endpoint Call

### Architecture Overview

```
┌─────────────┐
│   User      │
│  Fills Form │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend: Signup.js                │
│  - Validates input                  │
│  - Calls supabase.auth.signUp()     │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Supabase Auth                      │
│  - Creates user in auth.users       │
│  - Returns user object + JWT        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend: Check response           │
│  if (data.user) {                   │
│    await onboardUser()              │
│  }                                  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Backend: POST /api/onboard         │
│  - Creates organization (if needed) │
│  - Creates profile                  │
│  - Returns success                  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend: Navigate to /dashboard  │
└─────────────────────────────────────┘
```

### Why This Works

1. **Explicit timing**: Onboarding happens exactly when we want it
2. **Error handling**: Frontend can catch and display errors
3. **Retryable**: If onboarding fails, user can retry from UI
4. **Debuggable**: Full visibility into request/response
5. **No permissions issues**: Backend uses service role key
6. **No webhook setup**: Works out of the box

---

## Implementation

### Step 1: Create New Backend Endpoint

**File:** `strategic-growth-platform-221604-221613/sge_backend/src/routes/onboarding.js`

```javascript
const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authenticate } = require('../middleware/auth');
const userOnboardingService = require('../services/userOnboardingService');

/**
 * @swagger
 * /api/onboard:
 *   post:
 *     summary: Onboard the authenticated user
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName:
 *                 type: string
 *                 description: Organization name (optional)
 *     responses:
 *       200:
 *         description: User onboarded successfully
 *       400:
 *         description: User already onboarded
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { organizationName } = req.body;

    // Check if already onboarded
    const isOnboarded = await userOnboardingService.isUserOnboarded(userId);
    if (isOnboarded) {
      return res.status(200).json({
        success: true,
        message: 'User already onboarded',
        alreadyOnboarded: true
      });
    }

    // Perform onboarding
    const result = await userOnboardingService.onboardUser(userId, {
      organization_name: organizationName
    });

    res.status(200).json({
      success: true,
      message: 'User onboarded successfully',
      organization: result.organization,
      profile: result.profile
    });
  })
);

module.exports = router;
```

**File:** `strategic-growth-platform-221604-221613/sge_backend/src/routes/index.js` (add this route)

```javascript
// Add after existing route imports
const onboardingRoutes = require('./onboarding');

// Add after existing route registrations
router.use('/api/onboard', onboardingRoutes);
```

### Step 2: Update Frontend Signup Flow

**File:** `strategic-growth-platform-221604-221614/sge_frontend/src/pages/Signup.js`

Update the `handleSignup` function:

```javascript
const handleSignup = async (e) => {
  e.preventDefault();
  
  if (password !== confirmPassword) {
    return setError("Passwords do not match");
  }

  if (password.length < 6) {
    return setError("Password must be at least 6 characters");
  }

  setLoading(true);
  setError(null);

  try {
    // Step 1: Create auth user
    const { data, error } = await signUp(email, password, {
      organization_name: orgName
    });

    if (error) throw error;
    
    if (data.user && data.session) {
      // Step 2: Onboard user immediately
      try {
        const onboardResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/onboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session.access_token}`
          },
          body: JSON.stringify({
            organizationName: orgName || null
          })
        });

        const onboardData = await onboardResponse.json();
        
        if (!onboardResponse.ok) {
          throw new Error(onboardData.error || 'Failed to complete onboarding');
        }

        console.log('Onboarding successful:', onboardData);
        
        // Step 3: Navigate to dashboard
        navigate('/dashboard');
      } catch (onboardError) {
        // Onboarding failed, but user was created
        console.error('Onboarding error:', onboardError);
        setError(`Account created but onboarding failed: ${onboardError.message}. Please contact support or try logging in.`);
      }
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Step 3: Add API Service Helper (Optional but Recommended)

**File:** `strategic-growth-platform-221604-221614/sge_frontend/src/services/api.js`

Add this method:

```javascript
export const onboardUser = async (token, organizationName = null) => {
  const response = await api.post(
    '/api/onboard',
    { organizationName },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return response.data;
};
```

Then use it in Signup.js:

```javascript
import { onboardUser } from '../services/api';

// In handleSignup:
const onboardData = await onboardUser(data.session.access_token, orgName);
```

---

## Minimal SQL Implementation

If you prefer a **pure SQL approach** (no backend service), here's how to do it safely:

### Option 1: Client-Side SQL Execution (Not Recommended)

**Why not recommended:** Exposes service role key to frontend.

### Option 2: SQL Function Called from Frontend (Better)

Create a SQL function that can be called with regular auth:

```sql
-- Create a safe onboarding function that respects RLS
CREATE OR REPLACE FUNCTION public.onboard_current_user(
  p_organization_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_org_name text;
  v_result jsonb;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already onboarded
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already onboarded',
      'alreadyOnboarded', true
    );
  END IF;

  -- Set organization name
  v_org_name := COALESCE(TRIM(p_organization_name), 'Default Organization');

  -- Find or create organization
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE LOWER(TRIM(name)) = LOWER(v_org_name)
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES (v_org_name)
    RETURNING id INTO v_org_id;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, org_id, role, full_name)
  VALUES (v_user_id, v_org_id, 'member', NULL);

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Onboarded successfully',
    'organizationId', v_org_id,
    'organizationName', v_org_name
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.onboard_current_user TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.onboard_current_user IS 
  'Onboards the current authenticated user by creating org and profile';
```

**Frontend Usage:**

```javascript
// After successful signUp
const { data: onboardResult, error: onboardError } = await supabase
  .rpc('onboard_current_user', {
    p_organization_name: orgName
  });

if (onboardError) {
  console.error('Onboarding failed:', onboardError);
} else {
  console.log('Onboarded:', onboardResult);
  navigate('/dashboard');
}
```

### Exact SQL for Manual Testing

If you need to manually onboard a user via SQL:

```sql
-- Step 1: Get the user ID
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Step 2: Create organization (or find existing)
INSERT INTO public.organizations (name)
VALUES ('My Organization')
ON CONFLICT DO NOTHING  -- PostgreSQL 9.5+
RETURNING id, name;

-- If using older PostgreSQL:
WITH new_org AS (
  INSERT INTO public.organizations (name)
  SELECT 'My Organization'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM('My Organization'))
  )
  RETURNING id, name
)
SELECT * FROM new_org
UNION ALL
SELECT id, name FROM public.organizations
WHERE LOWER(TRIM(name)) = LOWER(TRIM('My Organization'))
AND NOT EXISTS (SELECT 1 FROM new_org)
LIMIT 1;

-- Step 3: Create profile (replace UUIDs with actual values)
INSERT INTO public.profiles (id, org_id, role, full_name)
VALUES (
  'USER_UUID_HERE',
  'ORG_UUID_HERE',
  'member',
  NULL
);
```

**One-liner version:**

```sql
WITH 
  target_user AS (
    SELECT id FROM auth.users WHERE email = 'user@example.com' LIMIT 1
  ),
  org AS (
    INSERT INTO public.organizations (name)
    SELECT 'My Organization'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE LOWER(TRIM(name)) = 'my organization'
    )
    RETURNING id
    UNION ALL
    SELECT id FROM public.organizations 
    WHERE LOWER(TRIM(name)) = 'my organization' 
    LIMIT 1
  )
INSERT INTO public.profiles (id, org_id, role, full_name)
SELECT target_user.id, org.id, 'member', NULL
FROM target_user, org
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = target_user.id
);
```

---

## Fixing the Trigger (If You Still Want It)

If you decide to keep the trigger approach despite its complexity, here's how to fix it:

### Fix 1: Use Supabase Service Role

The trigger cannot be created on `auth.users` by regular users. You need to:

1. **Run the trigger SQL using Supabase Service Role key** via the SQL Editor in Supabase Dashboard (it automatically uses elevated permissions)

2. **Or** use Supabase CLI with migrations:

```bash
supabase db push
```

### Fix 2: Grant Proper Permissions

Add these grants before creating the trigger:

```sql
-- Grant usage on auth schema (may not work depending on Supabase version)
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Ensure function has proper ownership
ALTER FUNCTION public.handle_new_user_onboarding() OWNER TO postgres;
```

### Fix 3: Revised Trigger with Better Error Handling

```sql
-- Improved trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
BEGIN
  -- Immediately exit if profile exists (idempotency)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RAISE NOTICE 'Profile already exists for user %, skipping', NEW.id;
    RETURN NEW;
  END IF;

  -- Wait a moment for metadata to be committed
  PERFORM pg_sleep(0.1);

  -- Extract organization name with multiple fallbacks
  v_org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    NEW.raw_user_meta_data->>'organizationName',
    NEW.raw_user_meta_data->>'org_name',
    (NEW.email_confirmed_at IS NULL) AND (NEW.raw_user_meta_data->>'organization')::text,
    'Default Organization'
  );

  v_org_name := TRIM(v_org_name);
  
  RAISE NOTICE 'Onboarding user % with org: %', NEW.id, v_org_name;

  -- Find existing organization (case-insensitive)
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE LOWER(TRIM(name)) = LOWER(v_org_name)
  LIMIT 1;

  -- Create organization if not found
  IF v_org_id IS NULL THEN
    BEGIN
      INSERT INTO public.organizations (name)
      VALUES (v_org_name)
      RETURNING id INTO v_org_id;
      
      RAISE NOTICE 'Created organization: % (%)', v_org_name, v_org_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create organization: %', SQLERRM;
      -- Try to find it again in case of race condition
      SELECT id INTO v_org_id
      FROM public.organizations
      WHERE LOWER(TRIM(name)) = LOWER(v_org_name)
      LIMIT 1;
      
      IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Cannot create or find organization';
      END IF;
    END;
  END IF;

  -- Create profile
  BEGIN
    INSERT INTO public.profiles (id, org_id, role, full_name)
    VALUES (NEW.id, v_org_id, 'member', NULL);
    
    RAISE NOTICE 'Created profile for user %', NEW.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Profile already exists (race condition), skipping';
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't fail user creation
    RAISE WARNING 'Onboarding error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure function has elevated permissions
ALTER FUNCTION public.handle_new_user_onboarding() OWNER TO postgres;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_onboarding();
```

### Testing the Fixed Trigger

```sql
-- Check if trigger is installed
SELECT 
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- Test by creating a user (use Supabase Auth UI, not direct SQL)
-- Then check:
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'organization_name' AS org_from_metadata,
  p.org_id,
  o.name AS org_name,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.organizations o ON p.org_id = o.id
WHERE u.email = 'test@example.com';
```

---

## Comparison: Endpoint vs Trigger vs Webhook

| Feature | Post-Signup Endpoint | Database Trigger | Supabase Webhook |
|---------|---------------------|------------------|------------------|
| **Complexity** | Low | Medium | High |
| **Setup Required** | Add 1 route | Run SQL script | Configure webhook URL |
| **Error Handling** | Excellent | Limited | Good |
| **Debugging** | Easy | Hard | Medium |
| **Retryable** | Yes | No | Limited |
| **Works Offline** | No | Yes | No |
| **Permission Issues** | None | Common | None |
| **Transaction Safety** | Separate | Same | Async |
| **Best For** | Most cases | Legacy/constraint | Microservices |

---

## Recommended Approach

**Primary: Post-Signup Endpoint** (Option in Implementation section)

**Fallback: SQL Function** (For DB-centric apps)

**Avoid: Database Trigger** (Unless you have specific constraints requiring it)

---

## Migration Path

If you're currently using webhooks or triggers:

### Step 1: Deploy New Endpoint

Add the `/api/onboard` endpoint to your backend without removing old mechanisms.

### Step 2: Update Frontend

Update signup flow to call the new endpoint.

### Step 3: Test Thoroughly

Test with new signups to ensure onboarding works.

### Step 4: Monitor Both Paths

Keep both old and new mechanisms active for 1-2 weeks, monitoring which one actually handles onboarding.

### Step 5: Remove Old Mechanisms

Once confident:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_onboarding();
```

And remove webhook configuration from Supabase Dashboard.

---

## Testing Checklist

- [ ] New user signup with organization name
- [ ] New user signup without organization name (uses default)
- [ ] User signup when organization already exists (should reuse)
- [ ] User signup when onboarding endpoint fails (error handling)
- [ ] User signup when network is slow (loading states)
- [ ] Multiple users signing up to same organization
- [ ] Verify RLS policies still work after onboarding
- [ ] Verify user can access dashboard after onboarding
- [ ] Verify conversations can be created after onboarding
- [ ] Manual SQL onboarding for recovery scenarios

---

## Troubleshooting Guide

### Issue: "Not authenticated" error during onboarding

**Cause:** JWT token not passed or expired

**Fix:** Ensure `data.session.access_token` is passed in Authorization header

### Issue: "User already onboarded" but can't access dashboard

**Cause:** Profile exists but RLS policies blocking access

**Fix:** Check RLS policies on tables:

```sql
-- Test if user can see their profile
SET request.jwt.claims.sub = 'USER_UUID_HERE';
SELECT * FROM public.profiles WHERE id = 'USER_UUID_HERE';
```

### Issue: Organization created but profile not created

**Cause:** Transaction failed halfway through

**Fix:** Use the manual SQL onboarding script from "Exact SQL for Manual Testing" section

### Issue: Frontend shows success but backend shows error

**Cause:** Response not properly checked

**Fix:** Always check `response.ok` before assuming success:

```javascript
if (!onboardResponse.ok) {
  throw new Error('Onboarding failed');
}
```

---

## Security Considerations

1. **Endpoint Protection**: The `/api/onboard` endpoint is protected by authentication middleware, so only authenticated users can call it

2. **Service Role Key**: Backend uses service role key to bypass RLS, which is secure because it's server-side only

3. **Idempotency**: The endpoint checks if user is already onboarded, preventing duplicate profiles

4. **Rate Limiting**: Consider adding rate limiting to prevent abuse:

```javascript
const rateLimit = require('express-rate-limit');

const onboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many onboarding attempts, please try again later'
});

router.post('/', onboardLimiter, authenticate, asyncHandler(async (req, res) => {
  // ...
}));
```

5. **Input Validation**: Sanitize organization name:

```javascript
const { organizationName } = req.body;
const sanitizedOrgName = organizationName
  ?.trim()
  .substring(0, 100) // Max length
  .replace(/[<>]/g, ''); // Remove potential XSS
```

---

## Conclusion

The **post-signup endpoint approach** is the simplest, most reliable method for user onboarding. It provides:

- Clear, linear control flow
- Excellent error handling
- Easy debugging
- No complex setup
- Works the same everywhere

The trigger approach, while elegant in theory, introduces permission issues, timing problems, and debugging challenges that outweigh its benefits for most applications.

**Next Steps:**

1. Implement the `/api/onboard` endpoint
2. Update the frontend signup flow
3. Test thoroughly
4. Remove old webhook/trigger mechanisms
5. Document the new flow for your team

---

## Appendix: Complete Code Examples

### Backend Route (Complete File)

**File:** `src/routes/onboarding.js`

```javascript
const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { authenticate } = require('../middleware/auth');
const userOnboardingService = require('../services/userOnboardingService');

/**
 * @swagger
 * /api/onboard:
 *   post:
 *     summary: Onboard the authenticated user
 *     description: Creates organization and profile for the newly signed up user
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName:
 *                 type: string
 *                 description: Organization name (optional, defaults to "Default Organization")
 *                 example: "Acme Corporation"
 *     responses:
 *       200:
 *         description: User onboarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User onboarded successfully"
 *                 organization:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     org_id:
 *                       type: string
 *                       format: uuid
 *                     role:
 *                       type: string
 *                       example: "member"
 *       400:
 *         description: User already onboarded
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error during onboarding
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { organizationName } = req.body;

    console.log(`Onboarding request from user ${userId}`, { organizationName });

    // Check if already onboarded
    const isOnboarded = await userOnboardingService.isUserOnboarded(userId);
    if (isOnboarded) {
      console.log(`User ${userId} is already onboarded`);
      return res.status(200).json({
        success: true,
        message: 'User already onboarded',
        alreadyOnboarded: true
      });
    }

    // Perform onboarding
    const result = await userOnboardingService.onboardUser(userId, {
      organization_name: organizationName
    });

    console.log(`Successfully onboarded user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'User onboarded successfully',
      organization: result.organization,
      profile: result.profile
    });
  })
);

module.exports = router;
```

### Frontend Helper (Complete File)

**File:** `src/utils/onboarding.js`

```javascript
/**
 * Onboard a newly signed-up user
 * @param {string} accessToken - JWT token from Supabase auth
 * @param {string|null} organizationName - Optional organization name
 * @returns {Promise<object>} Onboarding result
 */
export const onboardUser = async (accessToken, organizationName = null) => {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  const response = await fetch(`${apiUrl}/api/onboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      organizationName: organizationName || undefined
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Onboarding failed');
  }

  return data;
};
```

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Ready for Implementation
