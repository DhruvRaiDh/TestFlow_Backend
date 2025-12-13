import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Helper to write to log file for debugging
const logErrorToFile = (message: string, error: any) => {
    const logPath = path.join(__dirname, '../../ai_debug.log');
    const timestamp = new Date().toISOString();

    let errorDetails = '';
    if (error instanceof Error) {
        errorDetails = error.stack || error.message;
    } else {
        errorDetails = JSON.stringify(error);
    }

    const logEntry = `\n[${timestamp}] ${message}\nError: ${errorDetails}\n-------------------\n`;

    try {
        fs.appendFileSync(logPath, logEntry);
    } catch (e) {
        console.error("Failed to write to log file:", e);
    }
};

const logResponseToFile = (message: string, content: string) => {
    const logPath = path.join(__dirname, '../../ai_debug.log');
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] ${message}\nContent Preview: ${content.substring(0, 500)}...\n-------------------\n`;
    try {
        fs.appendFileSync(logPath, logEntry);
    } catch (e) {
        console.error("Failed to write to log file:", e);
    }
};

export class GenAIService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`[GenAIService] Initializing with API Key present: ${!!apiKey}`);

        if (!apiKey) {
            console.error('[GenAIService] FATAL: GEMINI_API_KEY is missing in environment variables!');
            // Initialize with dummy key to prevent crash on startup
            this.genAI = new GoogleGenerativeAI('dummy_key');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }

        // Using gemini-1.5-flash as the standard stable model
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ]
        });
        console.log(`[GenAIService] Active Model: gemini-1.5-flash`);
    }

    async generateTestCases(requirements: string): Promise<string> {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("AI Service is not configured (Missing GEMINI_API_KEY).");
        }

        const prompt = `
        Act as a QA Engineer. Based on the following requirements, generate a list of structured test cases.
        For each test case, provide:
        - Test Scenario
        - Pre-conditions
        - Test Steps
        - Expected Result

        Requirements:
        "${requirements}"

        Format the output as a Markdown list.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logErrorToFile("generateTestCases Failed", error);
            console.error("Error generating test cases:", error);
            throw new Error(`Failed to generate test cases: ${(error as Error).message}`);
        }
    }

    async summarizeBug(description: string): Promise<{
        title: string;
        description: string;
        stepsToReproduce: string;
        expectedResult: string;
        actualResult: string;
        severity: string;
        priority: string;
    }> {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("AI Service is not configured (Missing GEMINI_API_KEY).");
        }

        const prompt = `
        Act as a QA Lead. Analyze the following verbose bug description/logs and generate a structured Bug Report.
        
        Bug Input:
        "${description}"

        Output format (JSON only):
        {
            "title": "Concise and Descriptive Bug Title",
            "description": "Professional summary of the issue",
            "stepsToReproduce": "Numbered list of reproduction steps inferred from input (e.g. 1. Step one 2. Step two)",
            "expectedResult": "What should happen",
            "actualResult": "What is actually happening",
            "severity": "Critical | High | Medium | Low",
            "priority": "P1 | P2 | P3 | P4"
        }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON from potential markdown code blocks
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(text);
        } catch (error) {
            logErrorToFile("summarizeBug Failed", error);
            console.error("Error summarizing bug:", error);
            throw new Error(`Failed to summarize bug: ${(error as Error).message}`);
        }
    }

    async generateStructuredTestCase(prompt: string): Promise<any> {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("AI Service is not configured (Missing GEMINI_API_KEY).");
        }

        const systemPrompt = `
        Act as a Senior QA Automation Engineer.
        Your task is to generate a comprehensive SINGLE Test Case based on the user's description.
        You must strictly output VALID JSON that matches the following structure. Do not include markdown formatting or backticks.

        JSON Structure:
        {
            "module": "Suggest a module name based on context (e.g., Login, Checkout)",
            "testCaseId": "TC_AI_001", 
            "testScenario": "Brief one-line summary of the test",
            "testCaseDescription": "Detailed purpose of the test",
            "preConditions": "Numbered list of prerequisites (e.g., 1. User exists)",
            "testSteps": "Numbered list of steps (e.g., 1. Go to login page 2. Enter creds)",
            "testData": "Any user/input data needed (e.g. valid credentials)",
            "expectedResult": "Final success state description",
            "actualResult": "",
            "status": "Not Executed",
            "comments": "Generated by AI"
        }

        Rules:
        1. 'preConditions' and 'testSteps' MUST be plain text numbered lists. DO NOT use HTML tags like <ul> or <ol>.
        2. 'testCaseId' should be a placeholder like TC_GEN_01.
        
        User Prompt: "${prompt}"
        `;

        try {
            const result = await this.model.generateContent(systemPrompt);
            const response = await result.response;
            const text = response.text();

            // Clean up: find JSON start/end
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd + 1);
                return JSON.parse(jsonStr);
            }
            return JSON.parse(text);

        } catch (error) {
            logErrorToFile("generateStructuredTestCase Failed", error);
            console.error("Error generating structured test case:", error);
            throw new Error(`Failed to generate test case: ${(error as Error).message}`);
        }
    }

    async generateBulkTestCases(prompt: string): Promise<any[]> {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("AI Service is not configured (Missing GEMINI_API_KEY).");
        }

        console.log("--> BACKEND: GenAIService generating BULK test cases, prompt len:", prompt.length);

        const systemPrompt = `
        Act as a Principal QA Engineer.
        Your task is to generate an EXHAUSTIVE and COMPREHENSIVE suite of test cases based on the user's detailed flow description.
        
        GOAL: Generate as many test cases as logically possible (target 20+ if the logic allows).
        OUTPUT FORMAT:
        You must strictly output a VALID JSON ARRAY of objects. 
        Do not include markdown formatting, backticks, or any explanation text outside the JSON.
        
        Each object in the array must match:
        {
            "module": "Inferred Module Name",
            "testCaseId": "TC_AI_AUTO_01", 
            "testScenario": "Summary of the test",
            "testCaseDescription": "Detailed purpose",
            "preConditions": "Numbered list (e.g. 1. Condition One)",
            "testSteps": "Numbered list (e.g. 1. Step One)",
            "testData": "Input data required",
            "expectedResult": "Expected outcome",
            "actualResult": "",
            "status": "Not Executed",
            "comments": "Auto-generated Type: [Type e.g., Negative/Edge]"
        }

        User Flow Description: "${prompt}"
        `;

        try {
            const result = await this.model.generateContent(systemPrompt);
            const response = await result.response;
            const text = response.text();

            console.log("--> BACKEND: AI Response Length:", text.length);
            logResponseToFile("generateBulkTestCases Response", text);

            // Extract JSON Array
            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd + 1);
                return JSON.parse(jsonStr);
            }

            // Fallback
            return JSON.parse(text);

        } catch (error) {
            logErrorToFile("generateBulkTestCases Failed", error);
            console.error("Error generating bulk test cases:", error);
            throw new Error(`Failed to generate bulk test cases: ${(error as Error).message}`);
        }
    }
}

export const genAIService = new GenAIService();
