import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

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
      generateContent: jest.fn(),
    },
  })),
}));

export {};
