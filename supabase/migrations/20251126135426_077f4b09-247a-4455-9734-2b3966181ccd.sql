-- Simplify update policies so plate owner can always update/delete their own plates
-- Remove previous update policies
DROP POLICY IF EXISTS "Users can update their own plates and admins can update all" ON car_plates;
DROP POLICY IF EXISTS "Admins can update car plates" ON car_plates;

-- New unified update policy: owner OR admin can update
CREATE POLICY "Owners and admins can update plates"
ON car_plates
FOR UPDATE
TO authenticated
USING (
  added_by_telegram_id = get_current_telegram_id()
  OR has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
)
WITH CHECK (
  added_by_telegram_id = get_current_telegram_id()
  OR has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);