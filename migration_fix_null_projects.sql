-- Clean up or migrate Data with NULL project_id

-- OPTION 1: Delete them (simplest, guarantees no errors)
DELETE FROM public.schedules WHERE project_id IS NULL;
DELETE FROM public.test_datasets WHERE project_id IS NULL;
DELETE FROM public.api_collections WHERE project_id IS NULL;

-- OPTION 2: Backfill with a specific Project ID (if you know your main project ID)
-- UPDATE public.schedules SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
-- UPDATE public.test_datasets SET project_id = 'YOUR-PROJECT-UUID' WHERE project_id IS NULL;
