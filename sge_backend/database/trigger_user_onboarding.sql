-- Automatic User Onboarding Trigger
--
-- This trigger automatically creates an organization and profile for new users.
-- It fires when a new user is inserted into auth.users.
--
-- IMPORTANT: This is a backup mechanism. The primary method is via webhook.
-- This trigger ensures that even if the webhook fails, users get onboarded.
--
-- To apply this trigger:
-- 1. Go to Supabase Dashboard -> SQL Editor
-- 2. Copy and paste this entire file
-- 3. Run the script

-- Function to handle new user onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_org_name text;
  v_existing_profile_count int;
BEGIN
  -- Check if profile already exists (prevent duplicate inserts)
  SELECT COUNT(*) INTO v_existing_profile_count
  FROM public.profiles
  WHERE id = NEW.id;

  IF v_existing_profile_count > 0 THEN
    RAISE NOTICE 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;

  -- Extract organization name from user metadata
  -- Check both raw_user_meta_data and user_metadata
  v_org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    NEW.raw_user_meta_data->>'organizationName',
    'Default Organization'
  );

  RAISE NOTICE 'Onboarding user % with organization name: %', NEW.id, v_org_name;

  -- Find or create organization
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_org_name))
  LIMIT 1;

  IF v_org_id IS NULL THEN
    -- Create new organization
    INSERT INTO public.organizations (name)
    VALUES (TRIM(v_org_name))
    RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Created new organization % with id %', v_org_name, v_org_id;
  ELSE
    RAISE NOTICE 'Found existing organization % with id %', v_org_name, v_org_id;
  END IF;

  -- Create profile for the user
  INSERT INTO public.profiles (id, org_id, role, full_name)
  VALUES (
    NEW.id,
    v_org_id,
    'member',
    NULL
  );

  RAISE NOTICE 'Created profile for user % in organization %', NEW.id, v_org_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user_onboarding for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_onboarding();

-- Add comment to document the trigger
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
  'Automatically creates organization and profile records when a new user signs up';

COMMENT ON FUNCTION public.handle_new_user_onboarding() IS
  'Handles automatic onboarding of new users by creating/finding an organization and creating a profile record';
