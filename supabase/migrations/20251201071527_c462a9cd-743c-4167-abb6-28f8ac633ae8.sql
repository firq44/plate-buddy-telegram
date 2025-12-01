-- Create storage bucket for car photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-photos', 'car-photos', true);

-- Add photo_url column to car_plates table
ALTER TABLE public.car_plates
ADD COLUMN photo_url text;

-- Create storage policies for car photos
CREATE POLICY "Car photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'car-photos');

CREATE POLICY "Authenticated users can upload car photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'car-photos' 
  AND is_authenticated_telegram_user()
);

CREATE POLICY "Users can update their own car photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'car-photos' 
  AND is_authenticated_telegram_user()
);

CREATE POLICY "Users can delete their own car photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'car-photos' 
  AND is_authenticated_telegram_user()
);