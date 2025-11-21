-- Add soft delete columns to car_plates table
ALTER TABLE public.car_plates 
ADD COLUMN deleted_at timestamp with time zone,
ADD COLUMN deleted_by_telegram_id text;

-- Update RLS policy for regular users to exclude deleted plates
DROP POLICY IF EXISTS "Approved users can view car plates" ON public.car_plates;

CREATE POLICY "Approved users can view non-deleted car plates" 
ON public.car_plates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users WHERE telegram_id = get_current_telegram_id()
  )
  AND deleted_at IS NULL
);

-- Create separate policy for admins to view all plates including deleted
CREATE POLICY "Admins can view all car plates including deleted" 
ON public.car_plates 
FOR SELECT 
USING (
  has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role)
);

-- Update the soft delete policy
DROP POLICY IF EXISTS "Users can delete their own plates" ON public.car_plates;

CREATE POLICY "Users can soft delete their own plates" 
ON public.car_plates 
FOR UPDATE 
USING (
  (added_by_telegram_id = get_current_telegram_id() OR 
   has_role(get_user_id_from_telegram(get_current_telegram_id()), 'admin'::app_role))
  AND deleted_at IS NULL
);

-- Update get_plate_export_data function to exclude deleted plates for regular exports
CREATE OR REPLACE FUNCTION public.get_plate_export_data()
RETURNS TABLE(
  plate_number text,
  added_by_telegram_id text,
  added_by_username text,
  created_at timestamp with time zone,
  last_attempt_at timestamp with time zone,
  attempt_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cp.plate_number,
    cp.added_by_telegram_id,
    u.username as added_by_username,
    cp.created_at,
    cp.last_attempt_at,
    COALESCE(
      (SELECT COUNT(*) FROM plate_addition_attempts 
       WHERE plate_number = cp.plate_number AND success = false),
      0
    ) as attempt_count
  FROM car_plates cp
  LEFT JOIN users u ON u.telegram_id = cp.added_by_telegram_id
  WHERE cp.deleted_at IS NULL
  ORDER BY cp.created_at DESC;
$$;