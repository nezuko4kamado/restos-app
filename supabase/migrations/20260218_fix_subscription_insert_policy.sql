-- Migration: Add INSERT policy for user_subscriptions so authenticated users can create their own record
-- This is needed when the auth trigger fails to create the record on signup

-- Allow authenticated users to insert their own subscription record
CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);