"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
// Load test environment variables
(0, dotenv_1.config)({ path: '.env.test' });
// Set test environment defaults
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
// Extend Jest timeout for integration tests
jest.setTimeout(30000);
// Global test setup
beforeAll(() => {
    // Global setup for all tests
});
afterAll(() => {
    // Global cleanup for all tests
});
// Mock external services in test environment
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        generateContent: jest.fn(),
        models: {
            generateContent: jest.fn()
        }
    }))
}));
//# sourceMappingURL=setup.js.map