-- Create API Collections Table
CREATE TABLE IF NOT EXISTS api_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create API Requests Table
CREATE TABLE IF NOT EXISTS api_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES api_collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    method TEXT NOT NULL, -- GET, POST, PUT, DELETE, etc.
    url TEXT NOT NULL,
    headers JSONB DEFAULT '{}'::jsonb,
    params JSONB DEFAULT '{}'::jsonb, -- Query Params
    body TEXT, -- Request Body (JSON string or raw text)
    auth JSONB DEFAULT '{}'::jsonb, -- Auth config
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE api_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Policies (Open for now based on current project pattern, can be restricted later)
CREATE POLICY "Enable all access for authenticated users" ON api_collections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all access for authenticated users" ON api_requests FOR ALL USING (auth.role() = 'authenticated');
