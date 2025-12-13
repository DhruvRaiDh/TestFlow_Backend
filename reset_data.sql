-- TRUNCATE all tables to remove all data
TRUNCATE TABLE public.execution_reports CASCADE;
TRUNCATE TABLE public.recorded_scripts CASCADE;
TRUNCATE TABLE public.daily_data CASCADE;
TRUNCATE TABLE public.project_pages CASCADE;
TRUNCATE TABLE public.projects CASCADE;

-- Note: CASCADE ensures that dependent rows in child tables are also deleted.
