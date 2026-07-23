-- Migration Script for Existing Supabase Databases
-- Run this in the Supabase SQL Editor to update an existing database instance.

-- 1. Enable required extensions for password hashing and UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add missing metadata columns to public.ec_documents if they don't exist
ALTER TABLE public.ec_documents ADD COLUMN IF NOT EXISTS markdown_storage_path TEXT;
ALTER TABLE public.ec_documents ADD COLUMN IF NOT EXISTS converter_version TEXT;

-- 3. Create the EC Analysis Queue Table
CREATE TABLE IF NOT EXISTS public.ec_analysis_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.ec_documents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row-Level Security (RLS) on the Queue Table
ALTER TABLE public.ec_analysis_queue ENABLE ROW LEVEL SECURITY;

-- 5. Set up Queue Row-Level Security (RLS) Policies
DROP POLICY IF EXISTS "Allow users to read their own queue items" ON public.ec_analysis_queue;
CREATE POLICY "Allow users to read their own queue items"
    ON public.ec_analysis_queue FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow users to insert their own queue items" ON public.ec_analysis_queue;
CREATE POLICY "Allow users to insert their own queue items"
    ON public.ec_analysis_queue FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow users to update their own queue items" ON public.ec_analysis_queue;
CREATE POLICY "Allow users to update their own queue items"
    ON public.ec_analysis_queue FOR UPDATE
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow admins full access to queue items" ON public.ec_analysis_queue;
CREATE POLICY "Allow admins full access to queue items"
    ON public.ec_analysis_queue FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 6. Set up the update trigger for ec_analysis_queue
DROP TRIGGER IF EXISTS update_ec_analysis_queue_updated_at ON public.ec_analysis_queue;
CREATE TRIGGER update_ec_analysis_queue_updated_at 
    BEFORE UPDATE ON public.ec_analysis_queue 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Update the ec_documents status check constraint to support intermediate worker states
ALTER TABLE public.ec_documents DROP CONSTRAINT IF EXISTS ec_documents_status_check;
ALTER TABLE public.ec_documents ADD CONSTRAINT ec_documents_status_check 
    CHECK (status IN ('queued', 'downloading', 'converting', 'extracting', 'analysing', 'summarising', 'generating_report', 'deep_analysis', 'complete', 'error'));

-- 8. Update ec_audit_log action check constraint to include 'login'
ALTER TABLE public.ec_audit_log DROP CONSTRAINT IF EXISTS ec_audit_log_action_check;
ALTER TABLE public.ec_audit_log ADD CONSTRAINT ec_audit_log_action_check 
    CHECK (action IN (
        'upload', 'login', 'analysis_start', 'analysis_complete', 'analysis_error', 
        'report_view', 'report_download', 'report_print', 
        'subscription_created', 'subscription_expired', 'account_deleted'
    ));

-- 9. Seed Test Accounts into auth.users and public.profiles
-- Insert Free Tier Test User
DO $$
DECLARE
    free_uid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'test.free@ec-app.in') THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (
            free_uid,
            '00000000-0000-0000-0000-000000000000',
            'test.free@ec-app.in',
            crypt('TestFree@2025', gen_salt('bf')),
            NOW(),
            'authenticated',
            'authenticated',
            '+919000000001',
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{"name": "Free Tester"}',
            NOW(),
            NOW()
        );

        INSERT INTO public.profiles (id, phone, name, role, subscription_status, is_test_account)
        VALUES (free_uid, '+919000000001', 'Free Tester', 'user', 'free', TRUE);
    END IF;
END $$;

-- Insert Premium Tier Test User
DO $$
DECLARE
    premium_uid UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'test.premium@ec-app.in') THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (
            premium_uid,
            '00000000-0000-0000-0000-000000000000',
            'test.premium@ec-app.in',
            crypt('TestPremium@2025', gen_salt('bf')),
            NOW(),
            'authenticated',
            'authenticated',
            '+919000000002',
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{"name": "Premium Tester"}',
            NOW(),
            NOW()
        );

        INSERT INTO public.profiles (id, phone, name, role, subscription_status, subscription_expires_at, is_test_account)
        VALUES (premium_uid, '+919000000002', 'Premium Tester', 'user', 'premium', NOW() + INTERVAL '1 year', TRUE);
    END IF;
END $$;

-- Insert Admin Test User
DO $$
DECLARE
    admin_uid UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ec-app.in') THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES (
            admin_uid,
            '00000000-0000-0000-0000-000000000000',
            'admin@ec-app.in',
            crypt('AdminEC@2025', gen_salt('bf')),
            NOW(),
            'authenticated',
            'authenticated',
            '+919000000003',
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{"name": "Admin User"}',
            NOW(),
            NOW()
        );

        INSERT INTO public.profiles (id, phone, name, role, subscription_status, is_test_account)
        VALUES (admin_uid, '+919000000003', 'Admin User', 'admin', 'free', TRUE);
    END IF;
END $$;

-- 10. Verification Checks
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ec_documents';

SELECT * FROM ec_analysis_queue;
