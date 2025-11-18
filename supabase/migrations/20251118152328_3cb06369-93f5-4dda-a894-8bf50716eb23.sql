-- Remove the public SELECT policy that exposes all user data
DROP POLICY IF EXISTS "Anyone can view approved users" ON public.users;

-- Create a security definer function to check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated_telegram_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- Create a security definer function to get current telegram_id from auth
CREATE OR REPLACE FUNCTION public.get_current_telegram_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt()->>'telegram_id',
    (auth.jwt()->'user_metadata'->>'telegram_id')
  );
$$;

-- Only authenticated users can view users table
CREATE POLICY "Authenticated users can view users"
  ON public.users FOR SELECT
  USING (public.is_authenticated_telegram_user());

-- Update other policies to use the helper function
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );

-- Update access_requests policies
DROP POLICY IF EXISTS "Anyone can view their own requests" ON public.access_requests;

CREATE POLICY "Users can view their own requests"
  ON public.access_requests FOR SELECT
  USING (telegram_id = public.get_current_telegram_id());

DROP POLICY IF EXISTS "Admins can view all requests" ON public.access_requests;

CREATE POLICY "Admins can view all requests"
  ON public.access_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update requests" ON public.access_requests;

CREATE POLICY "Admins can update requests"
  ON public.access_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );

-- Update car_plates policies
DROP POLICY IF EXISTS "Approved users can view car plates" ON public.car_plates;

CREATE POLICY "Approved users can view car plates"
  ON public.car_plates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
    )
  );

DROP POLICY IF EXISTS "Approved users can add car plates" ON public.car_plates;

CREATE POLICY "Approved users can add car plates"
  ON public.car_plates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
    )
  );

DROP POLICY IF EXISTS "Admins can delete car plates" ON public.car_plates;

CREATE POLICY "Admins can delete car plates"
  ON public.car_plates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );