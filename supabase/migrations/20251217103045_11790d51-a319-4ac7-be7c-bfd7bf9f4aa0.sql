-- Drop the insecure policy
DROP POLICY IF EXISTS "Anyone can create access requests" ON access_requests;

-- Create a new policy requiring Telegram authentication
CREATE POLICY "Authenticated users can create access requests" 
ON access_requests 
FOR INSERT 
TO authenticated
WITH CHECK (
  telegram_id = get_current_telegram_id()
);