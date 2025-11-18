-- Привязываем проверки ролей к users.id, полученному по текущему Telegram ID

-- access_requests
ALTER POLICY "Admins can update requests"
ON public.access_requests
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

ALTER POLICY "Admins can view all requests"
ON public.access_requests
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

-- car_plates
ALTER POLICY "Admins can update car plates"
ON public.car_plates
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

ALTER POLICY "Users can delete their own plates"
ON public.car_plates
USING (
  (added_by_telegram_id = get_current_telegram_id())
  OR has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

-- plate_addition_attempts
ALTER POLICY "Admins can view all attempts"
ON public.plate_addition_attempts
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

-- user_roles
ALTER POLICY "Admins can view all user roles"
ON public.user_roles
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

ALTER POLICY "Admins can manage user roles"
ON public.user_roles
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
)
WITH CHECK (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

ALTER POLICY "Users can view their own roles"
ON public.user_roles
USING (
  user_id = get_user_id_from_telegram(get_current_telegram_id())
);

-- users
ALTER POLICY "Admins can manage users"
ON public.users
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
)
WITH CHECK (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

ALTER POLICY "Admins can view all users"
ON public.users
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);
