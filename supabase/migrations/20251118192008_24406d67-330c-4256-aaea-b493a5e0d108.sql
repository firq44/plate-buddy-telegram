-- Drop the legacy role column from users table
-- This column is no longer used; roles are now managed in the user_roles table
ALTER TABLE public.users DROP COLUMN IF EXISTS role;