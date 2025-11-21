-- Tighten access control so only users with explicit roles have access
-- 1) Update RLS policies on car_plates to require roles from user_roles

ALTER TABLE public.car_plates ENABLE ROW LEVEL SECURITY;

-- Drop old policies based only on existence in users table
DROP POLICY IF EXISTS "Approved users can view non-deleted car plates" ON public.car_plates;
DROP POLICY IF EXISTS "Approved users can view car plates" ON public.car_plates;
DROP POLICY IF EXISTS "Approved users can add car plates" ON public.car_plates;
DROP POLICY IF EXISTS "Approved users can update car plates" ON public.car_plates;

-- Regular approved users (role=user/admin) can see only non-deleted plates
CREATE POLICY "Approved roles can view non-deleted car plates"
ON public.car_plates
FOR SELECT
USING (
  (
    public.has_role(public.get_user_id_from_telegram(public.get_current_telegram_id()), 'user'::public.app_role)
    OR public.has_role(public.get_user_id_from_telegram(public.get_current_telegram_id()), 'admin'::public.app_role)
  )
  AND deleted_at IS NULL
);

-- Only users with role user/admin can insert new plates
CREATE POLICY "Approved roles can add car plates"
ON public.car_plates
FOR INSERT
WITH CHECK (
  public.has_role(public.get_user_id_from_telegram(public.get_current_telegram_id()), 'user'::public.app_role)
  OR public.has_role(public.get_user_id_from_telegram(public.get_current_telegram_id()), 'admin'::public.app_role)
);

-- Only users with role user/admin can update plates (additional to admin/soft-delete policies)
CREATE POLICY "Approved roles can update car plates"
ON public.car_plates
FOR UPDATE
USING (
  public.has_role(public.get_user_id_from_telegram(public.get_current_telegram_id()), 'user'::public.app_role)
  OR public.has_role(public.get_user_id_from_telegram(public.get_current_telegram_id()), 'admin'::public.app_role)
);