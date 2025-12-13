-- Create project_pages table
CREATE TABLE IF NOT EXISTS public.project_pages (
    id text PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id text,
    name text NOT NULL,
    date text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Create daily_data table
CREATE TABLE IF NOT EXISTS public.daily_data (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id text,
    date text NOT NULL,
    "testCases" jsonb DEFAULT '[]'::jsonb,
    bugs jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(project_id, date)
);

-- Enable RLS
ALTER TABLE public.project_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_data ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can only see their own pages" ON public.project_pages
    FOR ALL USING (user_id = auth.uid()::text OR user_id IS NULL);

CREATE POLICY "Users can only see their own daily data" ON public.daily_data
    FOR ALL USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pages_project_id ON public.project_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON public.project_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_project_id ON public.daily_data(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_user_id ON public.daily_data(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_date ON public.daily_data(date);
