# User Onboarding - Quick Start Guide

## ⚡ 5-Minute Setup

### Prerequisites
✅ Backend is running  
✅ Database schema is applied (`database/schema.sql`)  
❌ Need: `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### Setup Steps

**1. Get Service Role Key**
```
Supabase Dashboard → Settings → API → Copy "service_role" key
```

**2. Add to .env**
```bash
echo "SUPABASE_SERVICE_ROLE_KEY=your-key-here" >> .env
```

**3. Restart Backend**
```bash
npm start
```

**4. Configure Webhook OR Apply Trigger**

**Option A: Webhook (Recommended)**
```
Supabase Dashboard → Authentication → Webhooks
- Name: User Onboarding
- Event: user.created
- URL: https://your-backend-url/webhooks/auth
- Method: POST
```

**Option B: Database Trigger**
```
Supabase Dashboard → SQL Editor
- Copy contents of: database/trigger_user_onboarding.sql
- Paste and Run
```

**5. Test**
```bash
# Test the service
node test-onboarding.js

# Or test via signup
# Go to frontend /signup and create test account
```

---

## 🧪 Quick Test

```bash
# Test webhook endpoint
curl -X POST http://localhost:3001/webhooks/auth \
  -H "Content-Type: application/json" \
  -d '{
    "type":"user.created",
    "record":{
      "id":"test-uuid",
      "raw_user_meta_data":{"organization_name":"Test Org"}
    }
  }'

# Expected: Success message if key is configured
# or error message if key is missing
```

---

## 📋 Verification Checklist

After a user signs up, verify:

```sql
-- Check user exists
SELECT id, email FROM auth.users 
WHERE email = 'test@example.com';

-- Check organization created
SELECT * FROM organizations 
WHERE name ILIKE '%org name%';

-- Check profile created and linked
SELECT p.id, p.role, o.name as org_name
FROM profiles p
JOIN organizations o ON p.org_id = o.id
WHERE p.id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

Expected results:
- ✅ User in auth.users
- ✅ Organization in organizations table
- ✅ Profile with role='member', full_name=NULL
- ✅ Profile.org_id matches organization.id

---

## 🚨 Troubleshooting

**Problem: "Supabase admin client is not configured"**
- Solution: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` and restart

**Problem: User created but no profile**
- Check webhook is configured in Supabase Dashboard
- Check webhook URL is correct and publicly accessible
- Check backend logs for errors
- Apply database trigger as backup

**Problem: Wrong organization assigned**
- Verify organization_name is passed in signup metadata
- Check for typos or case mismatches
- Organizations are matched case-insensitively

---

## 📚 Full Documentation

- **Complete Setup**: `WEBHOOK_SETUP.md`
- **Database Details**: `database/ONBOARDING_SETUP.md`
- **Implementation**: `IMPLEMENTATION_SUMMARY.md`
- **API Docs**: Visit `/docs` when server is running

---

## 🎯 Key Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /webhooks/auth` | Supabase webhook | None |
| `POST /webhooks/onboard` | Manual onboarding | Required |
| `GET /docs` | API documentation | None |

---

## 💡 Tips

1. **Use both webhook AND trigger** for redundancy
2. **Monitor logs** for "Successfully onboarded user" messages
3. **Test with mock data** before real signups
4. **Check for orphaned users** periodically:
   ```sql
   SELECT u.* FROM auth.users u
   LEFT JOIN profiles p ON u.id = p.id
   WHERE p.id IS NULL;
   ```

---

## ✅ Success Criteria

- User signs up → Organization created/found
- Profile created with role='member'
- User can log in and access their org data
- No errors in backend logs
- Swagger docs show webhook endpoints
