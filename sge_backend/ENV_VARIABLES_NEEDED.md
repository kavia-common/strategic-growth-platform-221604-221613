# Required Environment Variables

The following environment variables need to be added to the `.env` file for full functionality:

## Critical for User Onboarding

### SUPABASE_SERVICE_ROLE_KEY
**Purpose:** Allows the backend to bypass Row Level Security (RLS) policies to create organizations and profiles during user signup.

**How to get it:**
1. Go to Supabase Dashboard
2. Navigate to: Settings → API
3. Copy the `service_role` key (under "Project API keys")
4. Add to `.env`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Security:** This key has full database access. Keep it secret and never commit to version control.

## Required for AI Chat Features

### GEMINI_API_KEY
**Purpose:** Enables Google Gemini AI integration for chat responses.

**How to get it:**
1. Go to Google AI Studio: https://makersuite.google.com/app/apikey
2. Create or select a project
3. Generate an API key
4. Add to `.env`:
   ```env
   GEMINI_API_KEY=your-api-key-here
   ```

## Current Status

The backend will start without these keys, but:
- ❌ User onboarding webhooks will fail without `SUPABASE_SERVICE_ROLE_KEY`
- ❌ AI chat features will not work without `GEMINI_API_KEY`
- ✅ Other features (authentication, dashboard) will work

## After Adding Keys

1. Restart the backend server:
   ```bash
   npm start
   ```

2. Test the onboarding:
   ```bash
   node test-onboarding.js
   ```

3. The test should pass and show:
   ```
   🎉 All tests passed successfully!
   ```
