-- Add DELETE policy for admins on users table
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role));