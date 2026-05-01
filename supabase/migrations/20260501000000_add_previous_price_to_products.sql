-- Migration: add previous_price column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS previous_price numeric;
