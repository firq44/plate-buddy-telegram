-- Fix security issue: Require authentication for access requests
DROP POLICY IF EXISTS "Anyone can create access requests" ON access_requests;

CREATE POLICY "Authenticated users can create access requests"
ON access_requests
FOR INSERT
TO authenticated
WITH CHECK (is_authenticated_telegram_user());

-- Fix security issue: Require authentication for plate addition attempts
DROP POLICY IF EXISTS "Anyone can insert attempts" ON plate_addition_attempts;

CREATE POLICY "Authenticated users can insert attempts"
ON plate_addition_attempts
FOR INSERT
TO authenticated
WITH CHECK (is_authenticated_telegram_user());