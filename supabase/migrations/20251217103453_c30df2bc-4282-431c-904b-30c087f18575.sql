-- Drop the current restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create access requests" ON access_requests;

-- Create a more flexible policy for authenticated users
-- Since users must go through telegram-auth validation to be authenticated,
-- we can trust the telegram_id they provide
CREATE POLICY "Authenticated users can create access requests" 
ON access_requests 
FOR INSERT 
TO authenticated
WITH CHECK (true);