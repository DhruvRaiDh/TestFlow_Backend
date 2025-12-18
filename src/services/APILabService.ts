import { supabase } from '../lib/supabase';

export class APILabService {

    // --- Collections ---
    async getCollections(projectId: string) {
        const { data, error } = await supabase
            .from('api_collections')
            .select('*, api_requests(*)') // Embed requests
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }); // Collections order

        if (error) throw new Error(error.message);

        // Sort requests within collections by name or created_at if needed
        return data?.map(c => ({
            ...c,
            items: c.api_requests // Alias for UI tree
        })) || [];
    }

    async createCollection(name: string, projectId: string) {
        const { data, error } = await supabase
            .from('api_collections')
            .insert({ name, project_id: projectId })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    }

    async deleteCollection(id: string) {
        const { error } = await supabase
            .from('api_collections')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    }

    // --- Requests ---
    async createRequest(collectionId: string, name: string, method: string = 'GET', url: string = '') {
        const { data, error } = await supabase
            .from('api_requests')
            .insert({ collection_id: collectionId, name, method, url })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    }

    async updateRequest(id: string, updates: any) {
        const { data, error } = await supabase
            .from('api_requests')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data;
    }

    async deleteRequest(id: string) {
        const { error } = await supabase
            .from('api_requests')
            .delete()
            .eq('id', id);
        if (error) throw new Error(error.message);
    }
}

export const apiLabService = new APILabService();
