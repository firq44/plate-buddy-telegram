-- Удаляем старую политику которая требует аутентификацию
DROP POLICY IF EXISTS "Authenticated users can create access requests" ON public.access_requests;

-- Создаем новую политику которая разрешает всем создавать запросы
CREATE POLICY "Anyone can create access requests"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Обновляем политику обновления чтобы работала и для anon
DROP POLICY IF EXISTS "Users can update their own requests" ON public.access_requests;

CREATE POLICY "Users can update their own requests"
ON public.access_requests
FOR UPDATE
TO anon, authenticated
USING (telegram_id = get_current_telegram_id())
WITH CHECK (telegram_id = get_current_telegram_id());