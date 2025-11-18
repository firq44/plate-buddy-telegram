-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

-- Create enum for access request status
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create users table to store Telegram user information
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create access requests table
CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  status request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create car plates table for shared number database
CREATE TABLE public.car_plates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT NOT NULL,
  description TEXT,
  added_by_telegram_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX idx_access_requests_status ON public.access_requests(status);
CREATE INDEX idx_car_plates_number ON public.car_plates(plate_number);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_plates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Anyone can view approved users"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
      AND role = 'admin'
    )
  );

-- RLS Policies for access_requests table
CREATE POLICY "Anyone can create access requests"
  ON public.access_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their own requests"
  ON public.access_requests FOR SELECT
  USING (telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id');

CREATE POLICY "Admins can view all requests"
  ON public.access_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update requests"
  ON public.access_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
      AND role = 'admin'
    )
  );

-- RLS Policies for car_plates table
CREATE POLICY "Approved users can view car plates"
  ON public.car_plates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
    )
  );

CREATE POLICY "Approved users can add car plates"
  ON public.car_plates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
    )
  );

CREATE POLICY "Admins can delete car plates"
  ON public.car_plates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
      AND role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_car_plates_updated_at
  BEFORE UPDATE ON public.car_plates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert the main admin user
INSERT INTO public.users (telegram_id, username, role)
VALUES ('785921635', 'ARTEM', 'admin')
ON CONFLICT (telegram_id) DO NOTHING;

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.car_plates;