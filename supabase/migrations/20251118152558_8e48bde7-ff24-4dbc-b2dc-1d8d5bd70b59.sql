-- Update the helper function to correctly extract telegram_id from JWT
CREATE OR REPLACE FUNCTION public.get_current_telegram_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'telegram_id'),
    (auth.jwt() -> 'app_metadata' ->> 'telegram_id')
  );
$$;