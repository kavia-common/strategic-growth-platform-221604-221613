-- SGE Multi-tenant Database Schema
--
-- This script sets up the database schema for the Strategic Growth Engine (SGE) platform.
-- It includes tables for Organizations, Profiles, Conversations, and Messages.
-- Row Level Security (RLS) policies are applied to enforce multi-tenant isolation.
--
-- Prerequisites:
-- - Supabase project or PostgreSQL with pgcrypto extension.
-- - Supabase Auth enabled (references auth.users).

-- 1. Extensions
create extension if not exists pgcrypto;

-- 2. Helper Functions
-- Function to get the current authenticated user ID.
-- This wraps Supabase's auth.uid() for consistent access.
create or replace function public.current_user_id()
returns uuid
language sql stable security definer
as $$
  select auth.uid();
$$;

-- 3. Tables

-- Organizations
-- Represents a tenant or company using the platform.
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Profiles
-- Extends the auth.users table with application-specific data.
-- Links a user to an organization.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete set null,
  role text check (role in ('admin', 'member')) default 'member',
  full_name text,
  created_at timestamptz default now()
);

-- Conversations
-- Represents a chat session or thread.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz default now()
);

-- Messages
-- Individual messages within a conversation.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- 4. Indexes
create index if not exists idx_profiles_org_id on profiles(org_id);
create index if not exists idx_conversations_org_id on conversations(org_id);
create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_org_id on messages(org_id);

-- 5. Row Level Security (RLS)

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Policies

-- TABLE: organizations
-- Select: Users can view their own organization.
create policy "Users can view their own organization"
  on organizations for select
  using (
    exists (
      select 1 from profiles
      where profiles.org_id = organizations.id
      and profiles.id = auth.uid()
    )
  );

-- Insert: Authenticated users can create an organization (e.g., during onboarding).
create policy "Authenticated users can create organizations"
  on organizations for insert
  to authenticated
  with check (true);

-- Update: Only admins of the organization can update it.
create policy "Admins can update their organization"
  on organizations for update
  using (
    exists (
      select 1 from profiles
      where profiles.org_id = organizations.id
      and profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Delete: Only admins of the organization can delete it.
create policy "Admins can delete their organization"
  on organizations for delete
  using (
    exists (
      select 1 from profiles
      where profiles.org_id = organizations.id
      and profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );


-- TABLE: profiles
-- Select: Users can view their own profile and profiles of others in their organization.
create policy "Users can view profiles in their organization"
  on profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from profiles as my_profile
      where my_profile.id = auth.uid()
      and my_profile.org_id = profiles.org_id
    )
  );

-- Insert: Users can create their own profile.
create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Update (Self): Users can update their own profile.
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Update (Admin): Admins can update profiles within their organization (e.g., changing roles).
create policy "Admins can update profiles in their organization"
  on profiles for update
  using (
    exists (
      select 1 from profiles as admin_profile
      where admin_profile.id = auth.uid()
      and admin_profile.org_id = profiles.org_id
      and admin_profile.role = 'admin'
    )
  );

-- Delete: Only admins can delete profiles within their organization.
create policy "Admins can delete profiles in their organization"
  on profiles for delete
  using (
    exists (
      select 1 from profiles as admin_profile
      where admin_profile.id = auth.uid()
      and admin_profile.org_id = profiles.org_id
      and admin_profile.role = 'admin'
    )
  );


-- TABLE: conversations
-- Select: Users can view conversations in their org if they own them OR are an admin.
create policy "View conversations"
  on conversations for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = conversations.org_id
      and (
        conversations.user_id = auth.uid()
        or profiles.role = 'admin'
      )
    )
  );

-- Insert: Authenticated users can create conversations for their own org.
create policy "Create conversations"
  on conversations for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = conversations.org_id
    )
    and user_id = auth.uid()
  );

-- Update: Owner or Admin.
create policy "Update conversations"
  on conversations for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = conversations.org_id
      and (
        conversations.user_id = auth.uid()
        or profiles.role = 'admin'
      )
    )
  );

-- Delete: Owner or Admin.
create policy "Delete conversations"
  on conversations for delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = conversations.org_id
      and (
        conversations.user_id = auth.uid()
        or profiles.role = 'admin'
      )
    )
  );


-- TABLE: messages
-- Select: Visible if user belongs to org AND (is owner of conversation OR admin).
create policy "View messages"
  on messages for select
  using (
    exists (
       select 1 from profiles
       where profiles.id = auth.uid()
       and profiles.org_id = messages.org_id
       and (
          profiles.role = 'admin'
          or exists (
             select 1 from conversations
             where conversations.id = messages.conversation_id
             and conversations.user_id = auth.uid()
          )
       )
    )
  );

-- Insert: Authenticated users can insert if it matches their org and conversation visibility.
create policy "Create messages"
  on messages for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = messages.org_id
    )
    and exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and conversations.org_id = messages.org_id
      and (
        conversations.user_id = auth.uid()
        or exists (
            select 1 from profiles p
            where p.id = auth.uid()
            and p.org_id = messages.org_id
            and p.role = 'admin'
        )
      )
    )
  );

-- Update: Admin only (for simplicity).
create policy "Admin update messages"
  on messages for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = messages.org_id
      and profiles.role = 'admin'
    )
  );

-- Delete: Admin only (for simplicity).
create policy "Admin delete messages"
  on messages for delete
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.org_id = messages.org_id
      and profiles.role = 'admin'
    )
  );


-- Seed Helper Instructions (Commented Out)
/*
  -- Example: Create an Organization and Link Initial User
  -- 1. Sign up a user in Supabase Auth. Get their UUID (e.g., from dashboard or auth.users).
  -- 2. Run the following SQL, replacing placeholders:
  
  with new_org as (
    insert into organizations (name) values ('My First Organization') returning id
  )
  insert into profiles (id, org_id, role, full_name)
  select 'REPLACE_WITH_USER_UUID', id, 'admin', 'Admin User'
  from new_org;
*/
