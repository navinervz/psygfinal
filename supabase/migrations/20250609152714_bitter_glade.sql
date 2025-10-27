/*
  # Add Crypto Payment Tables

  1. New Tables
    - crypto_payment_requests
      - id (uuid, primary key)
      - user_id (uuid, references users)
      - payment_id (text, unique) - Payment4 payment ID
      - amount (decimal) - Amount in crypto
      - currency (text) - USDT, BTC, ETH
      - description (text)
      - order_id (uuid, optional)
      - status (text) - pending, completed, failed
      - wallet_address (text) - Store wallet address
      - transaction_hash (text, optional) - Blockchain transaction hash
      - exchange_rate (decimal) - Rate at time of payment
      - created_at (timestamp)
      - updated_at (timestamp)
      - confirmed_at (timestamp, optional)

  2. Security
    - Enable RLS on crypto_payment_requests table
    - Add policies for authenticated users
*/

-- Crypto payment requests table
CREATE TABLE IF NOT EXISTS crypto_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  payment_id text UNIQUE NOT NULL,
  amount decimal NOT NULL,
  currency text NOT NULL,
  description text,
  order_id uuid,
  status text NOT NULL DEFAULT 'pending',
  wallet_address text NOT NULL,
  transaction_hash text,
  exchange_rate decimal NOT NULL DEFAULT 65000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz
);

ALTER TABLE crypto_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own crypto payment requests"
  ON crypto_payment_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create crypto payment requests"
  ON crypto_payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_payment_id ON crypto_payment_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_user_id ON crypto_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_status ON crypto_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payment_requests_currency ON crypto_payment_requests(currency);