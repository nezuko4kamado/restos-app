-- Add price_difference column to app_43909_products table
ALTER TABLE app_43909_products 
ADD COLUMN IF NOT EXISTS price_difference DECIMAL(10,2) DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN app_43909_products.price_difference IS 'Percentage change from previous price (e.g., 5.50 means +5.5%, -3.20 means -3.2%)';
