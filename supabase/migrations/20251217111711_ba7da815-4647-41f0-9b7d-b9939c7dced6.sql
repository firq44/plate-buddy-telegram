-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create access requests" ON public.access_requests;

-- Create a new PERMISSIVE INSERT policy that allows any authenticated user to create access requests
CREATE POLICY "Authenticated users can create access requests"
ON public.access_requests
FOR INSERT
TO authenticated
WITH CHECK (true);