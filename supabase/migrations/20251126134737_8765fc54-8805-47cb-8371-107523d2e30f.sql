-- Fix RLS policies for car_plates to allow users to delete their own plates
-- Drop conflicting policies
DROP POLICY IF EXISTS "Approved roles can update car plates" ON car_plates;
DROP POLICY IF EXISTS "Users can soft delete their own plates" ON car_plates;

-- Create new comprehensive update policy
CREATE POLICY "Users can update their own plates and admins can update all"
ON car_plates
FOR UPDATE
TO authenticated
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
  OR 
  (
    added_by_telegram_id = get_current_telegram_id()
    AND (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'user'::app_role) OR has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role))
  )
)
WITH CHECK (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
  OR 
  (
    added_by_telegram_id = get_current_telegram_id()
    AND (has_role(get_user_id_from_telegram(get_current_telegram_id()), 'user'::app_role) OR has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role))
  )
);