-- Add price_difference column to products table (without app_43909 prefix)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS price_difference DECIMAL(10,2) DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN products.price_difference IS 'Percentage change from previous price (e.g., 5.50 means +5.5%, -3.20 means -3.2%)';
