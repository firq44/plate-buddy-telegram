-- Remove the hardcoded admin insert as it's now handled in code
-- This ensures the main admin (785921635) is not visible in the database
DELETE FROM public.users WHERE telegram_id = '785921635';

-- Note: Main admin access is now controlled via hardcoded constants in the frontend
-- This provides better security as the admin ID is not stored in the database