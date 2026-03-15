-- Migration: Add vat_breakdown column to invoices table
-- Created: 2025-01-02

BEGIN;

-- Add vat_breakdown column to store VAT breakdown data
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_invoices' 
        AND column_name = 'vat_breakdown'
    ) THEN
        ALTER TABLE app_43909_invoices ADD COLUMN vat_breakdown JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN app_43909_invoices.vat_breakdown IS 'VAT breakdown by rate: [{rate: number, taxableAmount: number, vatAmount: number}]';
    END IF;
END $$;

COMMIT;