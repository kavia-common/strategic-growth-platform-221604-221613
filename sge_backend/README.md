# SGE Backend

Backend service for the Strategic Growth Engine (SGE) platform. Built with Express.js, Supabase, and Google Gemini AI.

## Features
- **Authentication**: JWT validation via Supabase Auth.
- **User Onboarding**: Automatic organization and profile creation on signup via webhooks or database triggers.
- **AI Chat**: Integration with Google Gemini for conversational interface.
- **Dashboard**: Aggregated analytics endpoints.
- **Persistence**: Multi-tenant data storage using Supabase (PostgreSQL) with RLS.

## API Overview

### Auth
All `/api/*` routes require `Authorization: Bearer <token>` header.

### Webhooks
- `POST /webhooks/auth`: Supabase Auth webhook for automatic user onboarding (no auth required).
- `POST /webhooks/onboard`: Manual user onboarding endpoint (auth required).

### Chat
- `POST /api/chat/conversations`: Create a new conversation.
- `GET /api/chat/conversations`: List user's conversations.
- `GET /api/chat/conversations/:id/messages`: Get message history.
- `POST /api/chat/message`: Send a message and get an AI response.

### Dashboard
- `GET /api/dashboard/summary`: Get mock analytics data.

## Setup

### Basic Setup
1. Copy `.env.example` to `.env` and fill in credentials.
2. `npm install`
3. `npm start`

### User Onboarding Setup
**Important:** To enable automatic user onboarding, you must configure either:

**Option 1: Supabase Webhook (Recommended)**
- See `WEBHOOK_SETUP.md` for detailed instructions
- Configure webhook in Supabase Dashboard: Authentication → Webhooks
- Set webhook URL to: `https://your-backend-url/webhooks/auth`

**Option 2: Database Trigger (Backup)**
- See `database/ONBOARDING_SETUP.md` for instructions
- Apply `database/trigger_user_onboarding.sql` in Supabase SQL Editor

### Testing Onboarding
```bash
# Run automated tests
node test-onboarding.js

# View API documentation
npm start
# Then visit http://localhost:3001/docs
```

### Required Environment Variables
```env
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Required for onboarding

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Server Configuration
PORT=3001
```

## Documentation
- **API Docs**: Available at `/docs` when server is running
- **Onboarding Setup**: See `WEBHOOK_SETUP.md` and `database/ONBOARDING_SETUP.md`
- **Database Schema**: See `database/README.md` and `database/schema.sql`
- **CORS Configuration**: See `CORS_CONFIG.md`
