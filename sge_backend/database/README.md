# SGE Database Schema & Setup

This directory contains the SQL schema for the Strategic Growth Engine (SGE) application.

## Files

- `schema.sql`: The main SQL migration file containing table definitions, indexes, and Row Level Security (RLS) policies.

## Entities

The schema defines the following core tables:

1.  **organizations**: Represents tenants.
    -   `id` (UUID): Unique identifier.
    -   `name`: Organization name.
2.  **profiles**: User profiles linked to `auth.users`.
    -   `id` (UUID): Links to Supabase Auth User ID.
    -   `org_id`: Foreign key to `organizations`.
    -   `role`: 'admin' or 'member'.
3.  **conversations**: Chat sessions.
    -   `org_id`: The organization this conversation belongs to.
    -   `user_id`: The user who owns the conversation.
4.  **messages**: Individual chat messages.
    -   `role`: 'user', 'assistant', or 'system'.

## Security (RLS)

Row Level Security is enabled on all tables to ensure multi-tenant isolation.
-   **Organizations**: Visible only to members.
-   **Profiles**: Visible to org members. Editable by owner. Role management by admins.
-   **Conversations/Messages**: Visible to the owner (user) and organization admins.

## Setup Instructions

To apply this schema to your Supabase project:

1.  Go to the **SQL Editor** in your Supabase Dashboard.
2.  Open the `schema.sql` file from this directory.
3.  Copy the contents and paste them into the SQL Editor.
4.  Run the script.

### Prerequisites

-   The script enables the `pgcrypto` extension if it is not already enabled.
-   It assumes the standard Supabase `auth.users` table exists.

### Seed Data (Optional)

To bootstrap the first organization and admin user:

1.  Create a user via the Authentication tab in Supabase or your app's signup flow.
2.  Copy the User ID (UUID).
3.  Run the SQL snippet provided in the comments at the bottom of `schema.sql`, replacing `REPLACE_WITH_USER_UUID` with the actual UUID.
