import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

if (apiKey) {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({
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
    } catch (error) {
        console.error("Failed to initialize Gemini AI:", error);
    }
} else {
    console.warn("GEMINI_API_KEY is not set in backend/.env. AI features will be disabled.");
}

export class GenAIService {
    async generateTestCases(requirements: string): Promise<string> {
        if (!model) {
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
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Error generating test cases:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
        if (!model) {
            throw new Error("AI Service is not configured (Missing GEMINI_API_KEY).");
        }

        console.log("--> BACKEND: GenAIService received description:", description);

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
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON from potential markdown code blocks
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(text);
        } catch (error) {
            console.error("Error summarizing bug:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            throw new Error(`Failed to summarize bug: ${(error as Error).message}`);
        }
    }
    async generateStructuredTestCase(prompt: string): Promise<any> {
        if (!model) {
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
            const result = await model.generateContent(systemPrompt);
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
            console.error("Error generating structured test case:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            throw new Error(`Failed to generate test case: ${(error as Error).message}`);
        }
    }

    async generateBulkTestCases(prompt: string): Promise<any[]> {
        if (!model) {
            throw new Error("AI Service is not configured (Missing GEMINI_API_KEY).");
        }

        console.log("--> BACKEND: GenAIService generating BULK test cases for prompt length:", prompt.length);

        const systemPrompt = `
        Act as a Principal QA Engineer.
        Your task is to generate an EXHAUSTIVE and COMPREHENSIVE suite of test cases based on the user's detailed flow description.
        
        GOAL: Generate as many test cases as logically possible (target 20+ if the logic allows).
        COVERAGE: You must cover:
        1. Positive Flow (Happy Path)
        2. Negative Flow (Invalid inputs, errors)
        3. Boundary Value Analysis (Min/Max limits)
        4. Edge Cases (Network loss, timeouts, empty states)
        5. Security Scenarios (SQLi, XSS, Permission checks) - only if relevant to input.
        
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

        Rules:
        1. 'preConditions' and 'testSteps' MUST be plain text numbered lists. DO NOT use HTML tags.
        2. 'testCaseId' should increment (TC_AI_001, TC_AI_002...).
        3. BE THOROUGH. Do not simplify.

        User Flow Description: "${prompt}"
        `;

        try {
            // Increase token limit or allow long response if model supports config here
            // Note: gemini-2.5-flash is fast but ensure prompt is clear on "JSON ONLY"
            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            const text = response.text();

            console.log("--> BACKEND: AI Response Length:", text.length);

            // Extract JSON Array
            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = text.substring(jsonStart, jsonEnd + 1);
                return JSON.parse(jsonStr);
            }

            // Fallback if no brackets found (unlikely with strict prompt)
            return JSON.parse(text);

        } catch (error) {
            console.error("Error generating bulk test cases:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
            throw new Error(`Failed to generate bulk test cases: ${(error as Error).message}`);
        }
    }
}

export const genAIService = new GenAIService();
