/*
  # Add Payment Tables

  1. New Tables
    - payment_requests
      - id (uuid, primary key)
      - user_id (uuid, references users)
      - authority (text, unique) - ZarinPal authority
      - amount (bigint) - Amount in Toman
      - description (text)
      - order_id (uuid, optional)
      - status (text) - pending, completed, failed
      - ref_id (text, optional) - ZarinPal reference ID
      - created_at (timestamp)
      - updated_at (timestamp)

  2. Security
    - Enable RLS on payment_requests table
    - Add policies for authenticated users
*/

-- Payment requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  authority text UNIQUE NOT NULL,
  amount bigint NOT NULL,
  description text,
  order_id uuid,
  status text NOT NULL DEFAULT 'pending',
  ref_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payment requests"
  ON payment_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create payment requests"
  ON payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_requests_authority ON payment_requests(authority);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);