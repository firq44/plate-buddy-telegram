-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user_id from telegram_id
CREATE OR REPLACE FUNCTION public.get_user_id_from_telegram(telegram_id_param text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE telegram_id = telegram_id_param LIMIT 1;
$$;

-- Migrate existing roles to user_roles table (with proper type conversion)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 
  CASE 
    WHEN role::text = 'admin' THEN 'admin'::app_role
    ELSE 'user'::app_role
  END
FROM public.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Update RLS policies on users table
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;

CREATE POLICY "Users can view their own record"
ON public.users
FOR SELECT
TO authenticated
USING (telegram_id = get_current_telegram_id());

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update RLS policy for user_roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update access_requests policies
DROP POLICY IF EXISTS "Admins can view all requests" ON public.access_requests;

CREATE POLICY "Admins can view all requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update requests" ON public.access_requests;

CREATE POLICY "Admins can update requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update car_plates policies
DROP POLICY IF EXISTS "Only admins can update car plates" ON public.car_plates;

CREATE POLICY "Admins can update car plates"
ON public.car_plates
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can delete their own plates" ON public.car_plates;

CREATE POLICY "Users can delete their own plates"
ON public.car_plates
FOR DELETE
TO authenticated
USING (
  added_by_telegram_id = get_current_telegram_id() OR 
  has_role(auth.uid(), 'admin')
);

-- Update plate_addition_attempts policies
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.plate_addition_attempts;

CREATE POLICY "Admins can view all attempts"
ON public.plate_addition_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Update users table admin policy
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

CREATE POLICY "Admins can manage users"
ON public.users
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));