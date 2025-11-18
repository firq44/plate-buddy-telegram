-- Разрешаем пользователям обновлять свои собственные запросы (например, повторно подавать после отклонения)
CREATE POLICY "Users can update their own requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (telegram_id = get_current_telegram_id())
WITH CHECK (telegram_id = get_current_telegram_id());