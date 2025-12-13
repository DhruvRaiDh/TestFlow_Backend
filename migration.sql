-- 1. Add user_id column to all tables
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.recorded_scripts ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.execution_reports ADD COLUMN IF NOT EXISTS user_id text;

-- 2. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON public.recorded_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.execution_reports(user_id);

-- 3. Update RLS Policies
-- First, drop existing public policies
DROP POLICY IF EXISTS "Public projects access" ON public.projects;
DROP POLICY IF EXISTS "Public scripts access" ON public.recorded_scripts;
DROP POLICY IF EXISTS "Public reports access" ON public.execution_reports;

-- Create new policies that enforce user isolation
-- Note: We use a permissive policy for now to allow the backend (Service Role) to manage data,
-- but for Frontend (Anon) access via Supabase Client directly, these policies would apply.
-- Since our app goes through our own Backend API (which uses Service Role), these RLS policies
-- mainly protect against direct Supabase client access if you were using it that way.

CREATE POLICY "Users can only see their own projects" ON public.projects
    FOR ALL USING (user_id = auth.uid()::text OR user_id IS NULL); -- Allow NULL temporarily for migration

CREATE POLICY "Users can only see their own scripts" ON public.recorded_scripts
    FOR ALL USING (user_id = auth.uid()::text OR user_id IS NULL);

CREATE POLICY "Users can only see their own reports" ON public.execution_reports
    FOR ALL USING (user_id = auth.uid()::text OR user_id IS NULL);
