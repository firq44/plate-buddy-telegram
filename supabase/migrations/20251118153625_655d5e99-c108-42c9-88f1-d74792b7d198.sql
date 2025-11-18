-- Add UPDATE policy for car_plates (only admins can update)
CREATE POLICY "Only admins can update car plates"
  ON public.car_plates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );

-- Update DELETE policy to allow users to delete their own plates
DROP POLICY IF EXISTS "Admins can delete car plates" ON public.car_plates;

CREATE POLICY "Users can delete their own plates"
  ON public.car_plates FOR DELETE
  USING (
    added_by_telegram_id = public.get_current_telegram_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );

-- Create table to track duplicate plate addition attempts
CREATE TABLE public.plate_addition_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT NOT NULL,
  attempted_by_telegram_id TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_plate_addition_attempts_number ON public.plate_addition_attempts(plate_number);
CREATE INDEX idx_plate_addition_attempts_telegram_id ON public.plate_addition_attempts(attempted_by_telegram_id);

-- Enable RLS
ALTER TABLE public.plate_addition_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can view all attempts
CREATE POLICY "Admins can view all attempts"
  ON public.plate_addition_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE telegram_id = public.get_current_telegram_id()
      AND role = 'admin'
    )
  );

-- Anyone can insert attempts
CREATE POLICY "Anyone can insert attempts"
  ON public.plate_addition_attempts FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.plate_addition_attempts;

-- Add column to track last attempt
ALTER TABLE public.car_plates 
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

-- Create function to get plate export data
CREATE OR REPLACE FUNCTION public.get_plate_export_data()
RETURNS TABLE (
  plate_number TEXT,
  added_by_telegram_id TEXT,
  added_by_username TEXT,
  created_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  attempt_count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cp.plate_number,
    cp.added_by_telegram_id,
    u.username as added_by_username,
    cp.created_at,
    cp.last_attempt_at,
    COALESCE(
      (SELECT COUNT(*) FROM plate_addition_attempts 
       WHERE plate_number = cp.plate_number AND success = false),
      0
    ) as attempt_count
  FROM car_plates cp
  LEFT JOIN users u ON u.telegram_id = cp.added_by_telegram_id
  ORDER BY cp.created_at DESC;
$$;