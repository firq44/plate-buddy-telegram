
-- Drop the current insert policy
DROP POLICY IF EXISTS "Anyone can create access requests" ON public.access_requests;

-- Create policy that allows ANYONE (including anon/unauthenticated) to insert
CREATE POLICY "Anyone can create access requests"
ON public.access_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
