# Onboarding Endpoint Documentation

## Overview

The `/api/onboarding/complete` endpoint handles user onboarding after Supabase authentication. It creates or finds an organization and creates a user profile with proper role assignment.

## Endpoint Details

**URL**: `POST /api/onboarding/complete`

**Authentication**: Required (JWT Bearer token from Supabase Auth)

**Content-Type**: `application/json`

## Request

### Headers
```
Authorization: Bearer <supabase-jwt-token>
Content-Type: application/json
```

### Body
```json
{
  "organization_name": "Acme Corporation"
}
```

**Fields**:
- `organization_name` (string, required): Name of the organization to join or create. Case-insensitive matching is used to find existing organizations.

## Response

### Success Response (200 OK)

**New User Onboarding**:
```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "org": {
    "id": "uuid",
    "name": "Acme Corporation"
  },
  "profile": {
    "id": "user-uuid",
    "org_id": "org-uuid",
    "role": "member",
    "full_name": null
  }
}
```

**Already Onboarded User** (Idempotent):
```json
{
  "success": true,
  "message": "User already onboarded",
  "org": {
    "id": "uuid",
    "name": "Existing Organization"
  },
  "profile": {
    "id": "user-uuid",
    "org_id": "org-uuid",
    "role": "member",
    "full_name": null
  }
}
```

### Error Responses

**400 Bad Request** - Missing or invalid organization_name:
```json
{
  "error": "organization_name is required and must be a non-empty string"
}
```

**401 Unauthorized** - Invalid or missing JWT token:
```json
{
  "error": "Invalid or expired token"
}
```

**500 Internal Server Error** - Database or processing error:
```json
{
  "error": "Failed to complete onboarding",
  "details": "Error message"
}
```

## Implementation Details

### Backend Flow

1. **Authentication**: Validates JWT token via auth middleware
2. **Input Validation**: Ensures organization_name is provided and valid
3. **Idempotency Check**: Checks if user already has a profile
4. **Organization Handling**: 
   - Searches for existing organization (case-insensitive)
   - Creates new organization if not found
5. **Profile Creation**: Creates profile with `role='member'` and `full_name=NULL`

### Frontend Integration

The frontend calls this endpoint immediately after successful Supabase signup:

```javascript
// After successful signup
const { data: sessionData } = await supabase.auth.getSession();
const accessToken = sessionData?.session?.access_token;

const response = await fetch(`${apiBase}/api/onboarding/complete`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    organization_name: orgName || 'Default Organization'
  })
});
```

## Key Features

### 1. Idempotency
The endpoint is safe to call multiple times. If a user already has a profile, it returns the existing data without creating duplicates.

### 2. Case-Insensitive Organization Matching
Organizations are matched using case-insensitive search (`ILIKE`), so "Acme Corp" and "acme corp" are treated as the same organization.

### 3. Graceful Error Handling
- If onboarding fails, the frontend still navigates to the dashboard
- Users can complete onboarding later through their profile
- All errors are logged for debugging

### 4. RLS Compliance
- Uses Supabase service role for admin operations
- Respects row-level security policies
- User authentication is validated before any operations

## Testing

Run the test script to verify the endpoint setup:

```bash
node test-onboarding-endpoint.js
```

This will verify:
- Supabase connection is working
- Organizations table is accessible
- Profiles table is accessible
- Case-insensitive lookups work correctly

## Database Schema Requirements

### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Profiles Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member',
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Environment Variables

Ensure these are set in `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Swagger Documentation

The endpoint is fully documented in Swagger/OpenAPI format. Access the documentation at:

```
http://localhost:3001/docs
```

Or view the OpenAPI spec at:

```
http://localhost:3001/openapi.json
```
