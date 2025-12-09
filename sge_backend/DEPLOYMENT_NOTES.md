# Deployment Notes - User Onboarding System

## For Deployment Agent / DevOps

### Environment Variables Required

The following environment variable **must** be set for the user onboarding system to work:

```env
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-from-supabase>
```

This key is available in:
```
Supabase Dashboard → Settings → API → service_role key
```

⚠️ **Security Warning**: This key has full database access. Keep it secret.

### Post-Deployment Configuration

After deploying the backend, **one** of the following must be configured:

#### Option 1: Configure Supabase Webhook (Recommended)

1. Go to Supabase Dashboard → Authentication → Webhooks
2. Create new webhook:
   - **Event**: `user.created` (or `INSERT` on `auth.users`)
   - **URL**: `https://<deployed-backend-url>/webhooks/auth`
   - **Method**: POST
   - **Webhook Secret**: (optional but recommended for production)

#### Option 2: Apply Database Trigger

1. Go to Supabase Dashboard → SQL Editor
2. Execute the contents of: `database/trigger_user_onboarding.sql`
3. Verify:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

### Verification Steps

After deployment, verify the system is working:

1. **Test webhook endpoint**:
   ```bash
   curl -X POST https://<backend-url>/webhooks/auth \
     -H "Content-Type: application/json" \
     -d '{"type":"test"}'
   ```
   Should return: `{"success":false,"error":"..."}` or success if key is configured

2. **Check API documentation**:
   Visit: `https://<backend-url>/docs`
   Should see "Webhooks" tag with two endpoints

3. **Test signup flow**:
   - Sign up a test user via frontend
   - Check database for profile creation:
   ```sql
   SELECT COUNT(*) FROM profiles 
   WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
   ```

### Monitoring

**Log Messages to Monitor**:
- ✅ "Starting onboarding for user {userId}"
- ✅ "Created organization: {name} ({id})"
- ✅ "Successfully onboarded user {userId}"
- ❌ "Auth webhook error:" (indicates failure)

**Health Check Query**:
```sql
-- Users without profiles (should be 0 or very few)
SELECT COUNT(*) FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
AND u.created_at > NOW() - INTERVAL '24 hours';
```

### Rollback Plan

If issues occur, the system degrades gracefully:
- Without service key: Webhook fails but user creation succeeds
- Users can still authenticate
- Profiles can be created manually via `/webhooks/onboard` endpoint

To manually onboard users:
```bash
curl -X POST https://<backend-url>/webhooks/onboard \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<user-uuid>","organizationName":"Org Name"}'
```

### Database Migrations

No database changes required beyond the base schema (`database/schema.sql`).

If applying the trigger:
- File: `database/trigger_user_onboarding.sql`
- Safe to apply: Yes, idempotent
- Rollback: `DROP TRIGGER on_auth_user_created ON auth.users;`

### Performance Considerations

- Webhook adds ~100-500ms to signup flow
- Trigger adds ~50-100ms to signup flow
- Both are asynchronous from user perspective
- No impact on existing user authentication

### Security Notes

1. **Service Role Key**:
   - Must be in environment variables, not hardcoded
   - Rotate periodically
   - Never commit to version control

2. **Webhook Endpoint**:
   - Public endpoint (Supabase needs access)
   - Consider adding signature verification in production
   - Rate limiting recommended

3. **RLS Policies**:
   - No changes to existing policies
   - Admin client bypasses RLS only for initial creation
   - Users still protected by RLS after creation

### Testing in Staging

Before production deployment:

1. Apply schema and trigger/webhook in staging Supabase
2. Set staging service key in staging backend
3. Test signup flow with multiple scenarios:
   - New org + new user
   - Existing org + new user
   - User without org name (should use "Default Organization")
4. Verify all profiles created correctly
5. Test manual onboarding endpoint

### Production Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in production environment
- [ ] Webhook configured in production Supabase dashboard
- [ ] OR trigger applied in production database
- [ ] Webhook URL uses HTTPS
- [ ] Test user signup completed successfully
- [ ] Monitoring/alerts configured for failed onboardings
- [ ] Documentation updated with production URLs
- [ ] Support team notified of new endpoints
- [ ] Rollback plan tested

### Support Information

**Endpoints**:
- Webhook: `POST /webhooks/auth` (public)
- Manual: `POST /webhooks/onboard` (authenticated)
- Docs: `GET /docs`

**Files**:
- Service: `src/services/userOnboardingService.js`
- Controller: `src/controllers/webhookController.js`
- Routes: `src/routes/webhooks.js`
- Trigger: `database/trigger_user_onboarding.sql`

**Documentation**:
- Setup: `WEBHOOK_SETUP.md`
- Quick Start: `QUICK_START.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`

### Contact

For issues with this implementation, check:
1. Backend logs for error messages
2. Supabase webhook logs (Dashboard → Authentication → Webhooks)
3. Database for orphaned users (users without profiles)
4. Environment variables are set correctly
