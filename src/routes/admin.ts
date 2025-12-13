import express from 'express';
import fs from 'fs';
import path from 'path';

export const adminRoutes = express.Router();

const rolesPath = path.join(__dirname, '../../data/roles.json');
const projectsPath = path.join(__dirname, '../../data/projects.json');

// Helper to read JSON safely
const readJson = (filePath: string, defaultVal: any) => {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return defaultVal;
};

// GET /api/admin/users - List all users (from roles.json)
adminRoutes.get('/users', (req, res) => {
    try {
        const roles = readJson(rolesPath, {});
        // Convert to array for frontend
        const users = Object.entries(roles).map(([email, role]) => ({
            email,
            role
        }));
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/stats - System stats
adminRoutes.get('/stats', (req, res) => {
    try {
        const roles = readJson(rolesPath, {});
        const projects = readJson(projectsPath, []);

        // Calculate stats
        const stats = {
            totalUsers: Object.keys(roles).length,
            totalProjects: projects.length,
            systemStatus: 'Operational',
            version: '1.0.0'
        };
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
