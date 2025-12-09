# SGE Backend

Backend service for the Strategic Growth Engine (SGE) platform. Built with Express.js, Supabase, and Google Gemini AI.

## Features
- **Authentication**: JWT validation via Supabase Auth.
- **AI Chat**: Integration with Google Gemini for conversational interface.
- **Dashboard**: Aggregated analytics endpoints.
- **Persistence**: Multi-tenant data storage using Supabase (PostgreSQL) with RLS.

## API Overview

### Auth
All `/api/*` routes require `Authorization: Bearer <token>` header.

### Chat
- `POST /api/chat/conversations`: Create a new conversation.
- `GET /api/chat/conversations`: List user's conversations.
- `GET /api/chat/conversations/:id/messages`: Get message history.
- `POST /api/chat/message`: Send a message and get an AI response.

### Dashboard
- `GET /api/dashboard/summary`: Get mock analytics data.

## Setup
1. Copy `.env.example` to `.env` and fill in credentials.
2. `npm install`
3. `npm start`
