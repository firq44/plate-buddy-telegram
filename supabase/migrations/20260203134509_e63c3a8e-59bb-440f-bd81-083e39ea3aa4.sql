-- Drop the old update policy that only allows owners and admins
DROP POLICY IF EXISTS "Owners and admins can update plates" ON public.car_plates;

-- Create new update policy allowing any user with 'user' or 'admin' role to update plates
CREATE POLICY "Users and admins can update plates"
ON public.car_plates
FOR UPDATE
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'user'::app_role) OR
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
)
WITH CHECK (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'user'::app_role) OR
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);