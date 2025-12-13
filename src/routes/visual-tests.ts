import { Router } from 'express';
import { visualTestService } from '../services/VisualTestService';
import * as fs from 'fs/promises';

const router = Router();

// List all tests
router.get('/tests', async (req, res) => {
    try {
        const tests = await visualTestService.getAllTests();
        res.json(tests);
    } catch (error) {
        console.error('Error loading visual tests:', error);
        res.status(500).json({ error: 'Failed to load visual tests' });
    }
});

// Create new test
router.post('/tests', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const test = await visualTestService.createTest(name);
        res.status(201).json(test);
    } catch (error) {
        console.error('Error creating visual test:', error);
        res.status(500).json({ error: 'Failed to create visual test' });
    }
});

// Update test details
router.put('/tests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const updated = await visualTestService.updateTest(id, name);
        res.json(updated);
    } catch (error) {
        console.error('Error updating visual test:', error);
        res.status(500).json({ error: 'Failed to update visual test' });
    }
});

// Delete test
router.delete('/tests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await visualTestService.deleteTest(id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting visual test:', error);
        res.status(500).json({ error: 'Failed to delete visual test' });
    }
});

// Update test status (from frontend analysis)
router.put('/tests/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, matchPercentage } = req.body;
        const updated = await visualTestService.updateTestStatus(id, status, matchPercentage);
        res.json(updated);
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Promote latest to baseline
router.post('/tests/:id/promote', async (req, res) => {
    try {
        const { id } = req.params;
        await visualTestService.promoteLatestToBaseline(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error promoting:', error);
        res.status(500).json({ error: 'Failed to promote' });
    }
});

// Upload image (simplistic approach: expects raw body with Content-Type header)
// Client should send blob directly.
router.post('/upload/:testId/:type', async (req, res) => {
    try {
        const { testId, type } = req.params;
        if (type !== 'baseline' && type !== 'latest') {
            return res.status(400).json({ error: 'Invalid type' });
        }

        // Collect raw buffer
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
            const buffer = Buffer.concat(chunks);
            const filename = await visualTestService.saveImage(testId, type as 'baseline' | 'latest', buffer);
            res.json({ filename });
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Serve images
router.get('/images/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = visualTestService.getImagePath(filename);
        const file = await fs.readFile(filepath);
        res.setHeader('Content-Type', 'image/png');
        res.send(file);
    } catch (error) {
        res.status(404).send('Image not found');
    }
});

export { router as visualTestRouter };
