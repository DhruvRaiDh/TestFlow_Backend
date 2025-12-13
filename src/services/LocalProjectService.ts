import * as fs from 'fs/promises';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

export interface Project {
    id: string;
    name: string;
    description: string;
    user_id?: string;
    createdAt: string;
    updatedAt: string;
}

interface ProjectData {
    customPages: any[];
    dailyData: any[];
    scripts: any[];
}

const DATA_DIR = path.join(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

export class LocalProjectService {
    private async ensureDataDir() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    private async readProjectsFile(): Promise<{ projects: Project[] }> {
        await this.ensureDataDir();
        try {
            const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                return { projects: [] };
            }
            throw error;
        }
    }

    private async writeProjectsFile(data: { projects: Project[] }) {
        await this.ensureDataDir();
        await fs.writeFile(PROJECTS_FILE, JSON.stringify(data, null, 2));
    }

    private getProjectDataFilePath(projectId: string): string {
        return path.join(DATA_DIR, `project-${projectId}-data.json`);
    }

    private async readProjectData(projectId: string): Promise<ProjectData> {
        const filePath = this.getProjectDataFilePath(projectId);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                return { customPages: [], dailyData: [], scripts: [] };
            }
            throw error;
        }
    }

    private async writeProjectData(projectId: string, data: ProjectData) {
        const filePath = this.getProjectDataFilePath(projectId);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    async getAllProjects(userId: string): Promise<Project[]> {
        const data = await this.readProjectsFile();
        return data.projects
            .filter(p => p.user_id === userId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    async getProjectById(id: string, userId: string): Promise<Project | null> {
        const data = await this.readProjectsFile();
        const project = data.projects.find(p => p.id === id);
        if (!project || project.user_id !== userId) return null;
        return project;
    }

    async createProject(name: string, description: string, userId: string, id?: string): Promise<Project> {
        const data = await this.readProjectsFile();
        const newProject: Project = {
            id: id || crypto.randomUUID(),
            name,
            description,
            user_id: userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        data.projects.push(newProject);
        await this.writeProjectsFile(data);

        // Initialize empty data file
        await this.writeProjectData(newProject.id, { customPages: [], dailyData: [], scripts: [] });

        return newProject;
    }


    async updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project> {
        const data = await this.readProjectsFile();
        const index = data.projects.findIndex(p => p.id === id);

        if (index === -1) throw new Error('Project not found');
        if (data.projects[index].user_id !== userId) throw new Error('Unauthorized');

        const updatedProject = {
            ...data.projects[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        data.projects[index] = updatedProject;
        await this.writeProjectsFile(data);
        return updatedProject;
    }

    async deleteProject(id: string, userId: string): Promise<void> {
        const data = await this.readProjectsFile();
        const project = data.projects.find(p => p.id === id);

        if (!project) return; // Idempotent
        if (project.user_id !== userId) throw new Error('Unauthorized');

        const filteredProjects = data.projects.filter(p => p.id !== id);
        await this.writeProjectsFile({ projects: filteredProjects });

        // Also delete data file
        try {
            await fs.unlink(this.getProjectDataFilePath(id));
        } catch (e) {
            console.error('Error deleting project data file:', e);
        }
    }

    // --- Sub-resources methods ---

    async getProjectPages(projectId: string, userId: string): Promise<any[]> {
        const data = await this.readProjectData(projectId);
        return data.customPages || [];
    }

    async createProjectPage(projectId: string, pageData: any, userId: string): Promise<any> {
        const data = await this.readProjectData(projectId);
        const newPage = { ...pageData, id: pageData.id || crypto.randomUUID() }; // Ensure ID
        data.customPages.push(newPage);
        await this.writeProjectData(projectId, data);
        return newPage;
    }

    async updateProjectPage(projectId: string, pageId: string, updates: any, userId: string): Promise<any> {
        const data = await this.readProjectData(projectId);
        const index = data.customPages.findIndex(p => p.id === pageId);

        if (index !== -1) {
            data.customPages[index] = { ...data.customPages[index], ...updates };
            await this.writeProjectData(projectId, data);
            return data.customPages[index];
        }
        return null;
    }

    async deleteProjectPage(projectId: string, pageId: string, userId: string): Promise<void> {
        const data = await this.readProjectData(projectId);
        const initialLength = data.customPages.length;
        data.customPages = data.customPages.filter(p => p.id !== pageId);

        if (data.customPages.length !== initialLength) {
            await this.writeProjectData(projectId, data);
        }
    }

    async getDailyData(projectId: string, userId: string, date?: string): Promise<any[]> {
        const data = await this.readProjectData(projectId);
        if (date) {
            return data.dailyData.filter(d => d.date === date);
        }
        return data.dailyData || [];
    }

    async createDailyData(projectId: string, dataPayload: any, userId: string): Promise<any> {
        const data = await this.readProjectData(projectId);
        data.dailyData.push(dataPayload);
        await this.writeProjectData(projectId, data);
        return dataPayload;
    }

    async updateDailyData(projectId: string, date: string, updates: any, userId: string): Promise<any> {
        const data = await this.readProjectData(projectId);
        const index = data.dailyData.findIndex(d => d.date === date);

        if (index !== -1) {
            data.dailyData[index] = { ...data.dailyData[index], ...updates };
        } else {
            // If not found, create it (upsert behavior often expected)
            data.dailyData.push({ date, ...updates });
        }

        await this.writeProjectData(projectId, data);
        return data.dailyData.find(d => d.date === date);
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

export const localProjectService = new LocalProjectService();
