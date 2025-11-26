-- Allow plate owners to always see their own plates (including deleted)
CREATE POLICY "Owners can view their own plates"
ON car_plates
FOR SELECT
TO authenticated
USING (added_by_telegram_id = get_current_telegram_id());