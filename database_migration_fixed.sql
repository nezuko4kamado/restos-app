-- RESTOS Database Migration Script (FIXED)
-- This script safely updates the products table with new price structure columns
-- Run this in your Supabase SQL Editor

BEGIN;

-- Migration script to update products table with new price structure
-- This script safely adds missing columns for dynamic pricing support

DO $$
DECLARE
    table_exists boolean;
    column_exists boolean;
BEGIN
    -- Check if products table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_d84fcb9242_products'
    ) INTO table_exists;

    IF NOT table_exists THEN
        -- Create the complete products table with all necessary columns
        CREATE TABLE app_d84fcb9242_products (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            brand TEXT,
            sku TEXT,
            barcode TEXT,
            
            -- New price structure columns
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            discounted_price DECIMAL(10,2),
            discount_amount DECIMAL(10,2) DEFAULT 0.00,
            discount_percent DECIMAL(5,2) DEFAULT 0.00,
            
            -- Legacy price column (for backward compatibility)
            price DECIMAL(10,2),
            
            -- VAT and currency
            vat_rate DECIMAL(5,2) DEFAULT 22.00,
            currency TEXT DEFAULT 'EUR',
            
            -- Inventory
            stock_quantity INTEGER DEFAULT 0,
            min_stock_level INTEGER DEFAULT 0,
            unit_of_measure TEXT DEFAULT 'pcs',
            
            -- Supplier info
            supplier_id UUID,
            supplier_name TEXT,
            supplier_product_code TEXT,
            
            -- OCR and image data
            image_url TEXT,
            ocr_data JSONB,
            
            -- Metadata
            tags TEXT[],
            notes TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS products_user_idx ON app_d84fcb9242_products(user_id);
        CREATE INDEX IF NOT EXISTS products_category_idx ON app_d84fcb9242_products(category);
        CREATE INDEX IF NOT EXISTS products_supplier_idx ON app_d84fcb9242_products(supplier_id);
        CREATE INDEX IF NOT EXISTS products_sku_idx ON app_d84fcb9242_products(sku);
        CREATE INDEX IF NOT EXISTS products_barcode_idx ON app_d84fcb9242_products(barcode);
        CREATE INDEX IF NOT EXISTS products_active_idx ON app_d84fcb9242_products(is_active);

        -- Setup Row Level Security (RLS)
        ALTER TABLE app_d84fcb9242_products ENABLE ROW LEVEL SECURITY;
        
        -- Policy: Users can only see their own products
        CREATE POLICY "allow_read_own_products" ON app_d84fcb9242_products 
            FOR SELECT TO authenticated 
            USING ((select auth.uid()) = user_id);
        
        -- Policy: Users can insert their own products
        CREATE POLICY "allow_insert_own_products" ON app_d84fcb9242_products 
            FOR INSERT TO authenticated 
            WITH CHECK ((select auth.uid()) = user_id);
        
        -- Policy: Users can update their own products
        CREATE POLICY "allow_update_own_products" ON app_d84fcb9242_products 
            FOR UPDATE TO authenticated 
            USING ((select auth.uid()) = user_id)
            WITH CHECK ((select auth.uid()) = user_id);
        
        -- Policy: Users can delete their own products
        CREATE POLICY "allow_delete_own_products" ON app_d84fcb9242_products 
            FOR DELETE TO authenticated 
            USING ((select auth.uid()) = user_id);

        RAISE NOTICE 'Created new products table with complete price structure';
    ELSE
        -- Table exists, add missing columns if they don't exist
        
        -- Check and add unit_price column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'app_d84fcb9242_products' 
            AND column_name = 'unit_price'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE app_d84fcb9242_products ADD COLUMN unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00;
            -- Migrate existing price data to unit_price
            UPDATE app_d84fcb9242_products SET unit_price = COALESCE(price, 0.00) WHERE unit_price = 0.00;
            RAISE NOTICE 'Added unit_price column and migrated existing price data';
        END IF;

        -- Check and add discounted_price column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'app_d84fcb9242_products' 
            AND column_name = 'discounted_price'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE app_d84fcb9242_products ADD COLUMN discounted_price DECIMAL(10,2);
            RAISE NOTICE 'Added discounted_price column';
        END IF;

        -- Check and add discount_amount column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'app_d84fcb9242_products' 
            AND column_name = 'discount_amount'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE app_d84fcb9242_products ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;
            RAISE NOTICE 'Added discount_amount column';
        END IF;

        -- Check and add discount_percent column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'app_d84fcb9242_products' 
            AND column_name = 'discount_percent'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE app_d84fcb9242_products ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0.00;
            RAISE NOTICE 'Added discount_percent column';
        END IF;

        -- Check and add currency column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'app_d84fcb9242_products' 
            AND column_name = 'currency'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE app_d84fcb9242_products ADD COLUMN currency TEXT DEFAULT 'EUR';
            RAISE NOTICE 'Added currency column';
        END IF;

        -- Check and add vat_rate column
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'app_d84fcb9242_products' 
            AND column_name = 'vat_rate'
        ) INTO column_exists;
        
        IF NOT column_exists THEN
            ALTER TABLE app_d84fcb9242_products ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 22.00;
            RAISE NOTICE 'Added vat_rate column';
        END IF;

        RAISE NOTICE 'Updated existing products table with new price structure columns';
    END IF;
END $$;

-- Create or update the trigger function for updated_at (outside the DO block)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create the trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON app_d84fcb9242_products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON app_d84fcb9242_products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;