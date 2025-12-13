import { projectService as remoteService, Project } from './ProjectService';
import { localProjectService } from './LocalProjectService';

export class UnifiedProjectService {

    // --- Reads (Primary: Remote/Supabase) ---

    async getAllProjects(userId: string): Promise<Project[]> {
        return remoteService.getAllProjects(userId);
    }

    async getProjectById(id: string, userId: string): Promise<Project | null> {
        return remoteService.getProjectById(id, userId);
    }

    async getProjectPages(projectId: string, userId: string): Promise<any[]> {
        return remoteService.getProjectPages(projectId, userId);
    }

    async getDailyData(projectId: string, userId: string, date?: string): Promise<any[]> {
        return remoteService.getDailyData(projectId, userId, date);
    }

    async exportBugs(projectId: string, date: string, userId: string): Promise<Buffer> {
        return remoteService.exportBugs(projectId, date, userId);
    }

    async exportTestCases(projectId: string, date: string, userId: string): Promise<Buffer> {
        return remoteService.exportTestCases(projectId, date, userId);
    }

    // --- Writes (Dual-Write: Remote + Local Backup) ---

    async createProject(name: string, description: string, userId: string): Promise<Project> {
        // 1. Create in Remote (Primary Source of Truth)
        const project = await remoteService.createProject(name, description, userId);

        // 2. Backup to Local (Best Effort)
        try {
            // We pass the ID from remote to ensure consistency
            await localProjectService.createProject(name, description, userId, project.id);
        } catch (error) {
            console.error('[Unified] Local backup failed for createProject:', error);
            // We do NOT throw here, as the primary operation succeeded
        }

        return project;
    }

    async updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project> {
        const project = await remoteService.updateProject(id, updates, userId);

        try {
            await localProjectService.updateProject(id, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateProject:', error);
        }

        return project;
    }

    async deleteProject(id: string, userId: string): Promise<void> {
        await remoteService.deleteProject(id, userId);

        try {
            await localProjectService.deleteProject(id, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for deleteProject:', error);
        }
    }

    async createProjectPage(projectId: string, pageData: any, userId: string): Promise<any> {
        const page = await remoteService.createProjectPage(projectId, pageData, userId);

        try {
            // Pass the full 'page' object (which includes the new ID) as payload to local
            await localProjectService.createProjectPage(projectId, page, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for createProjectPage:', error);
        }

        return page;
    }

    async updateProjectPage(projectId: string, pageId: string, updates: any, userId: string): Promise<any> {
        const page = await remoteService.updateProjectPage(projectId, pageId, updates, userId);

        try {
            await localProjectService.updateProjectPage(projectId, pageId, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateProjectPage:', error);
        }

        return page;
    }

    async deleteProjectPage(projectId: string, pageId: string, userId: string): Promise<void> {
        await remoteService.deleteProjectPage(projectId, pageId, userId);

        try {
            await localProjectService.deleteProjectPage(projectId, pageId, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for deleteProjectPage:', error);
        }
    }

    async createDailyData(projectId: string, dataPayload: any, userId: string): Promise<any> {
        const data = await remoteService.createDailyData(projectId, dataPayload, userId);

        try {
            // Pass the full 'data' object (which includes any DB-generated fields) as payload
            await localProjectService.createDailyData(projectId, data, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for createDailyData:', error);
        }

        return data;
    }

    async updateDailyData(projectId: string, date: string, updates: any, userId: string): Promise<any> {
        const data = await remoteService.updateDailyData(projectId, date, updates, userId);

        try {
            await localProjectService.updateDailyData(projectId, date, updates, userId);
        } catch (error) {
            console.error('[Unified] Local backup failed for updateDailyData:', error);
        }

        return data;
    }
}

export const unifiedProjectService = new UnifiedProjectService();
