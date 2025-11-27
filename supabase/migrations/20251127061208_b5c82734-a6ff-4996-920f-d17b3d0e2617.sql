-- Add INSERT policy for users table to allow edge function to create user records
-- Service role can always insert
CREATE POLICY "Service role can insert users"
ON public.users
FOR INSERT
TO service_role
WITH CHECK (true);

-- Authenticated users can insert their own record (edge function creates user with service_role, so this is backup)
CREATE POLICY "Users can insert their own record"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);