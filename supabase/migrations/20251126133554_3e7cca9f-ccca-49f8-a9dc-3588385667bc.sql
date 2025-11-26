-- Add additional fields to car_plates table
ALTER TABLE car_plates 
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS model TEXT;

-- Update description column comment
COMMENT ON COLUMN car_plates.description IS 'Additional comment about the car';