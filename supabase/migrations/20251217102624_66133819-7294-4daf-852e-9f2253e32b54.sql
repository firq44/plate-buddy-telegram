-- Add action_type column to track different types of attempts
ALTER TABLE public.plate_addition_attempts 
ADD COLUMN action_type text NOT NULL DEFAULT 'increment';

-- Update existing records based on success field
UPDATE public.plate_addition_attempts 
SET action_type = CASE 
  WHEN success = true THEN 'added'
  ELSE 'increment'
END;