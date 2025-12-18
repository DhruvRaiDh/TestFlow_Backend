-- Add project_id to schedules table
ALTER TABLE public.schedules 
ADD COLUMN IF NOT EXISTS project_id UUID;

-- Optional: Add foreign key if projects table exists and IDs align (assuming UUIDs)
-- ALTER TABLE public.schedules 
-- ADD CONSTRAINT fk_schedules_project 
-- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_schedules_project_id ON public.schedules(project_id);
