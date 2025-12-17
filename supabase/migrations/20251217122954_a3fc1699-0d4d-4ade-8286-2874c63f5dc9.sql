-- Allow users with 'user' role to view attempts
CREATE POLICY "Users can view all attempts"
ON public.plate_addition_attempts
FOR SELECT
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'user'::app_role)
);