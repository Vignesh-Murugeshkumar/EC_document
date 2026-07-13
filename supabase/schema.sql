-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    preferred_language TEXT DEFAULT 'en',
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium')),
    subscription_expires_at TIMESTAMPTZ,
    is_test_account BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create EC Documents Table
CREATE TABLE IF NOT EXISTS public.ec_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    page_count INT NOT NULL,
    sha256_hash TEXT,
    analysis_mode TEXT DEFAULT 'auto' CHECK (analysis_mode IN ('standard', 'multi_agent', 'auto')),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'extracting', 'analysing', 'summarising', 'generating_report', 'complete', 'error')),
    error_code TEXT,
    error_message TEXT,
    health_score INT,
    analysis_results JSONB, -- Stores the structured findings (transactions, ownership_chain, anomalies, summary)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on EC Documents
ALTER TABLE public.ec_documents ENABLE ROW LEVEL SECURITY;

-- 3. Create Audit Log Table
CREATE TABLE IF NOT EXISTS public.ec_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        'upload', 'analysis_start', 'analysis_complete', 'analysis_error', 
        'report_view', 'report_download', 'report_print', 
        'subscription_created', 'subscription_expired', 'account_deleted'
    )),
    document_id UUID REFERENCES public.ec_documents(id) ON DELETE SET NULL,
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Audit Log
ALTER TABLE public.ec_audit_log ENABLE ROW LEVEL SECURITY;

-- 4. Enable Realtime Replication
-- Add ec_documents to supabase_realtime publication to enable real-time status updates
alter publication supabase_realtime add table public.ec_documents;

-- 5. Row-Level Security (RLS) Policies

-- Profiles Policies
CREATE POLICY "Allow users to read their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Allow admins full access to profiles"
    ON public.profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- EC Documents Policies
CREATE POLICY "Allow users to read their own documents"
    ON public.ec_documents FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Allow users to insert their own documents"
    ON public.ec_documents FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow users to update their own documents"
    ON public.ec_documents FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Allow admins full access to documents"
    ON public.ec_documents FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Audit Log Policies
CREATE POLICY "Allow users to read their own audit logs"
    ON public.ec_audit_log FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Allow system/users to insert audit logs"
    ON public.ec_audit_log FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Allow admins full access to audit logs"
    ON public.ec_audit_log FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 6. Trigger to Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_ec_documents_updated_at BEFORE UPDATE ON public.ec_documents FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

