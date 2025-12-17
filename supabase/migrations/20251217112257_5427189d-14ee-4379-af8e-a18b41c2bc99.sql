-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own record" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own record" ON public.users;

-- Recreate policies as PERMISSIVE
-- Allow authenticated users to view their own record
CREATE POLICY "Users can view own record"
ON public.users
FOR SELECT
TO authenticated
USING (telegram_id = get_current_telegram_id());

-- Allow admins to view all users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role));

-- Allow admins to manage (insert/update/delete) users
CREATE POLICY "Admins can manage users"
ON public.users
FOR ALL
TO authenticated
USING (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role))
WITH CHECK (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role));

-- Allow service role full access (for edge functions)
-- This is a special policy that allows the service role to bypass RLS
CREATE POLICY "Service role has full access"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);