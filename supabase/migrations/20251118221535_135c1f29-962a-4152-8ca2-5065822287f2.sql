-- Allow approved users (with a record in users table) to update car plate attempt stats
CREATE POLICY "Approved users can update car plates"
ON public.car_plates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.telegram_id = get_current_telegram_id()
  )
);
