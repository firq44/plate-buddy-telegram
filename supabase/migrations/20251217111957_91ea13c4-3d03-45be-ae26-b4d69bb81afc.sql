-- Drop ALL existing policies on access_requests table
DROP POLICY IF EXISTS "Authenticated users can create access requests" ON public.access_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.access_requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON public.access_requests;

-- Recreate policies as PERMISSIVE (default)
-- Allow ANY authenticated user to INSERT access requests
CREATE POLICY "Anyone can create access requests"
ON public.access_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (telegram_id = get_current_telegram_id());

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role));

-- Admins can update any request
CREATE POLICY "Admins can update requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role));

-- Users can update their own requests
CREATE POLICY "Users can update own requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (telegram_id = get_current_telegram_id())
WITH CHECK (telegram_id = get_current_telegram_id());