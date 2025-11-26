-- Update the get_plate_export_data function to include additional car details
DROP FUNCTION IF EXISTS public.get_plate_export_data();

CREATE OR REPLACE FUNCTION public.get_plate_export_data()
RETURNS TABLE(
  plate_number text,
  added_by_telegram_id text,
  added_by_username text,
  created_at timestamp with time zone,
  last_attempt_at timestamp with time zone,
  attempt_count bigint,
  color text,
  brand text,
  model text,
  description text
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
    ) as attempt_count,
    cp.color,
    cp.brand,
    cp.model,
    cp.description
  FROM car_plates cp
  LEFT JOIN users u ON u.telegram_id = cp.added_by_telegram_id
  WHERE cp.deleted_at IS NULL
  ORDER BY cp.created_at DESC;
$$;