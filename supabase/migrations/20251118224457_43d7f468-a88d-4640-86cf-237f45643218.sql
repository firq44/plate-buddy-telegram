-- Добавляем политику чтобы пользователи могли читать свои собственные роли
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());