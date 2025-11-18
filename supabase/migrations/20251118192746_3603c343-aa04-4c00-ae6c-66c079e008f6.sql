-- Fix foreign key constraint in user_roles table
-- The constraint currently references auth.users, but should reference public.users
-- since Telegram authentication doesn't create auth.users entries

-- Drop the existing foreign key constraint
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Add new foreign key constraint to public.users instead
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE CASCADE;