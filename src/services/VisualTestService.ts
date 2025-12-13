import * as fs from 'fs/promises';
import * as path from 'path';

export interface VisualTest {
    id: string;
    name: string;
    baselineImage?: string;
    latestImage?: string;
    diffImage?: string; // Optional, might be generated on frontend but we store filename if needed
    matchPercentage?: number;
    status: 'new' | 'pass' | 'fail';
    updatedAt: string;
}

const DATA_DIR = path.join(__dirname, '../../data');
const TESTS_FILE = path.join(DATA_DIR, 'visual-tests.json');
const IMAGES_DIR = path.join(DATA_DIR, 'visual-images');

export class VisualTestService {
    private async ensureDirs() {
        try { await fs.access(DATA_DIR); } catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
        try { await fs.access(IMAGES_DIR); } catch { await fs.mkdir(IMAGES_DIR, { recursive: true }); }
    }

    private async readTests(): Promise<VisualTest[]> {
        await this.ensureDirs();
        try {
            const data = await fs.readFile(TESTS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    private async writeTests(tests: VisualTest[]) {
        await this.ensureDirs();
        await fs.writeFile(TESTS_FILE, JSON.stringify(tests, null, 2));
    }

    async getAllTests(): Promise<VisualTest[]> {
        return this.readTests();
    }

    async createTest(name: string): Promise<VisualTest> {
        const tests = await this.readTests();
        const newTest: VisualTest = {
            id: crypto.randomUUID(),
            name,
            status: 'new',
            updatedAt: new Date().toISOString()
        };
        tests.push(newTest);
        await this.writeTests(tests);
        return newTest;
    }

    async updateTestStatus(id: string, status: 'pass' | 'fail', matchPercentage?: number): Promise<VisualTest> {
        const tests = await this.readTests();
        const index = tests.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Test not found');

        tests[index] = {
            ...tests[index],
            status,
            matchPercentage,
            updatedAt: new Date().toISOString()
        };
        await this.writeTests(tests);
        return tests[index];
    }

    async saveImage(testId: string, type: 'baseline' | 'latest', imageBuffer: Buffer): Promise<string> {
        await this.ensureDirs();
        const filename = `${testId}-${type}.png`;
        const filepath = path.join(IMAGES_DIR, filename);
        await fs.writeFile(filepath, imageBuffer);

        const tests = await this.readTests();
        const index = tests.findIndex(t => t.id === testId);
        if (index !== -1) {
            if (type === 'baseline') tests[index].baselineImage = filename;
            if (type === 'latest') tests[index].latestImage = filename;
            tests[index].updatedAt = new Date().toISOString();
            await this.writeTests(tests);
        }

        return filename;
    }

    async updateTest(id: string, name: string): Promise<VisualTest> {
        const tests = await this.readTests();
        const index = tests.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Test not found');

        tests[index].name = name;
        tests[index].updatedAt = new Date().toISOString();
        await this.writeTests(tests);
        return tests[index];
    }

    async deleteTest(id: string): Promise<void> {
        const tests = await this.readTests();
        const index = tests.findIndex(t => t.id === id);
        if (index === -1) return; // Idempotent

        const test = tests[index];
        // Delete associated images
        const imagesToDelete = [test.baselineImage, test.latestImage, test.diffImage].filter(Boolean);
        for (const img of imagesToDelete) {
            try {
                if (img) await fs.unlink(path.join(IMAGES_DIR, img));
            } catch (e) {
                console.error(`Failed to delete image ${img}:`, e);
            }
        }

        tests.splice(index, 1);
        await this.writeTests(tests);
    }

    async promoteLatestToBaseline(testId: string): Promise<void> {
        const tests = await this.readTests();
        const index = tests.findIndex(t => t.id === testId);
        if (index === -1) throw new Error('Test not found');

        const test = tests[index];
        if (!test.latestImage) throw new Error('No latest image to promote');

        // Copy latest to baseline filename (or just update reference, but copying is safer for history)
        const latestPath = path.join(IMAGES_DIR, test.latestImage);
        const baselineFilename = `${testId}-baseline-${Date.now()}.png`;
        const baselinePath = path.join(IMAGES_DIR, baselineFilename);

        try {
            await fs.copyFile(latestPath, baselinePath);
            test.baselineImage = baselineFilename;
            test.status = 'pass'; // Reset status after promotion
            test.matchPercentage = 100;
            test.updatedAt = new Date().toISOString();
            await this.writeTests(tests);
        } catch (error) {
            console.error('Error promoting image:', error);
            throw new Error('Failed to promote image');
        }
    }

    getImagePath(filename: string): string {
        return path.join(IMAGES_DIR, filename);
    }
}

export const visualTestService = new VisualTestService();
