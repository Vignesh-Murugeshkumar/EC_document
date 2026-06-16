-- Seed Test Accounts into auth.users and public.profiles
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
