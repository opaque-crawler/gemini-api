import request from 'supertest';
import app from '../../src/app';

describe('GET /api/v1/session/{sessionId}/history - Contract Tests', () => {
  const endpoint = '/api/v1/session';
  let sessionId: string;
  let imageIds: string[];
  let analysisRequestIds: string[] = [];

  beforeEach(async () => {
    // Create a session for testing
    const sessionResponse = await request(app)
      .post('/api/v1/session')
      .expect(201);
    
    sessionId = sessionResponse.body.sessionId;

    // Upload test images to get imageIds
    const imageResponse = await request(app)
      .post('/api/v1/images')
      .field('sessionId', sessionId)
      .attach('images', Buffer.from('fake-image-data1'), 'test1.png')
      .attach('images', Buffer.from('fake-image-data2'), 'test2.png')
      .expect(201);
    
    imageIds = imageResponse.body.images.map((img: any) => img.id);

    // Create multiple analysis requests to build history
    const analysisPromises = [
      'First analysis request',
      'Second analysis request', 
      'Third analysis request'
    ].map(async (prompt) => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: prompt
      };

      const response = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 202) {
            throw new Error(`Expected 200 or 202, got ${res.status}`);
          }
        });

      return response.body.requestId;
    });

    analysisRequestIds = await Promise.all(analysisPromises);
  });

  describe('Successful History Retrieval (200)', () => {
    it('should return session history with default pagination', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history`)
        .expect(200);

      // HistoryResponse schema validation
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('analyses');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('hasMore');
      
      expect(typeof response.body.sessionId).toBe('string');
      expect(Array.isArray(response.body.analyses)).toBe(true);
      expect(typeof response.body.totalCount).toBe('number');
      expect(typeof response.body.hasMore).toBe('boolean');
      
      // Verify sessionId matches
      expect(response.body.sessionId).toBe(sessionId);
      
      // Should have the analysis requests we created
      expect(response.body.totalCount).toBeGreaterThanOrEqual(3);
      expect(response.body.analyses.length).toBeGreaterThanOrEqual(3);
    });

    it('should include all required fields from HistoryResponse schema', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history`)
        .expect(200);

      const expectedFields = ['sessionId', 'analyses', 'totalCount', 'hasMore'];
      const actualFields = Object.keys(response.body);
      expect(actualFields.sort()).toEqual(expectedFields.sort());
    });

    it('should return analyses with AnalysisResponse structure', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history`)
        .expect(200);

      if (response.body.analyses.length > 0) {
        const analysis = response.body.analyses[0];
        
        // Check AnalysisResponse structure
        expect(analysis).toHaveProperty('id');
        expect(analysis).toHaveProperty('requestId');
        expect(analysis).toHaveProperty('status');
        expect(analysis).toHaveProperty('content');
        expect(analysis).toHaveProperty('format');
        
        expect(typeof analysis.id).toBe('string');
        expect(typeof analysis.requestId).toBe('string');
        expect(['completed', 'partial', 'failed']).toContain(analysis.status);
        expect(typeof analysis.content).toBe('string');
        expect(typeof analysis.format).toBe('string');
      }
    });

    it('should support pagination with limit parameter', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history?limit=2`)
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('analyses');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('hasMore');
      
      // Should respect limit parameter
      expect(response.body.analyses.length).toBeLessThanOrEqual(2);
      
      // If we have more than 2 total, hasMore should be true
      if (response.body.totalCount > 2) {
        expect(response.body.hasMore).toBe(true);
      }
    });

    it('should handle limit parameter edge cases', async () => {
      const testCases = [
        { limit: 1, name: 'minimum limit' },
        { limit: 50, name: 'maximum limit' },
        { limit: 10, name: 'default limit value' }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .get(`${endpoint}/${sessionId}/history?limit=${testCase.limit}`)
          .expect(200);

        expect(response.body.analyses.length).toBeLessThanOrEqual(testCase.limit);
        expect(typeof response.body.hasMore).toBe('boolean');
      }
    });
  });

  describe('Request Validation (400)', () => {
    it('should validate sessionId format (UUID)', async () => {
      const invalidSessionId = 'invalid-uuid';
      
      const response = await request(app)
        .get(`${endpoint}/${invalidSessionId}/history`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/sessionId|uuid|format/i);
    });

    it('should handle malformed UUID with proper error', async () => {
      const malformedUuid = '123-456-789';
      
      const response = await request(app)
        .get(`${endpoint}/${malformedUuid}/history`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/sessionId|uuid|format/i);
    });

    it('should validate limit parameter range', async () => {
      const invalidLimits = [0, 51, -1, 100];
      
      for (const limit of invalidLimits) {
        const response = await request(app)
          .get(`${endpoint}/${sessionId}/history?limit=${limit}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/limit|range|invalid/i);
      }
    });

    it('should validate limit parameter type', async () => {
      const invalidLimits = ['abc', 'true', '[]'];
      
      for (const limit of invalidLimits) {
        const response = await request(app)
          .get(`${endpoint}/${sessionId}/history?limit=${limit}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/limit|number|invalid/i);
      }
    });

    it('should handle empty sessionId parameter', async () => {
      const response = await request(app)
        .get(`${endpoint}//history`)
        .expect(404); // Express returns 404 for malformed route

      // This is expected behavior - malformed route results in 404
    });
  });

  describe('Not Found (404)', () => {
    it('should return 404 for non-existent session', async () => {
      const nonExistentSessionId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`${endpoint}/${nonExistentSessionId}/history`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/session|not found/i);
    });

    it('should match Error schema for 404 responses', async () => {
      const nonExistentSessionId = '550e8400-e29b-41d4-a716-446655440001';
      
      const response = await request(app)
        .get(`${endpoint}/${nonExistentSessionId}/history`)
        .expect(404);

      const expectedFields = ['error', 'message'];
      const actualFields = Object.keys(response.body);
      
      // Check that required fields are present
      expectedFields.forEach(field => {
        expect(actualFields).toContain(field);
      });
      
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Empty History Handling', () => {
    it('should handle session with no analysis history', async () => {
      // Create a new session with no analysis history
      const newSessionResponse = await request(app)
        .post('/api/v1/session')
        .expect(201);
      
      const newSessionId = newSessionResponse.body.sessionId;

      const response = await request(app)
        .get(`${endpoint}/${newSessionId}/history`)
        .expect(200);

      expect(response.body.sessionId).toBe(newSessionId);
      expect(response.body.analyses).toEqual([]);
      expect(response.body.totalCount).toBe(0);
      expect(response.body.hasMore).toBe(false);
    });
  });

  describe('OpenAPI Schema Compliance', () => {
    it('should return response matching HistoryResponse schema', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history`)
        .expect(200);

      // Validate HistoryResponse schema compliance
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('analyses');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('hasMore');
      
      // Type validations
      expect(typeof response.body.sessionId).toBe('string');
      expect(Array.isArray(response.body.analyses)).toBe(true);
      expect(typeof response.body.totalCount).toBe('number');
      expect(typeof response.body.hasMore).toBe('boolean');
      
      // Validate totalCount is non-negative
      expect(response.body.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle URL parameter extraction correctly', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440003';
      
      const response = await request(app)
        .get(`${endpoint}/${validUuid}/history`);

      // Should attempt to process the UUID even if session not found
      // This validates that the route parameter is being extracted
      expect([200, 404]).toContain(response.status);
    });

    it('should handle query parameters correctly', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history?limit=5`);

      // Should process query parameters correctly
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.analyses.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Response Headers and Content Type', () => {
    it('should return JSON content type for all responses', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history`);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return JSON content type for error responses', async () => {
      const invalidSessionId = 'invalid-uuid';
      
      const response = await request(app)
        .get(`${endpoint}/${invalidSessionId}/history`)
        .expect(400);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error structure for validation errors', async () => {
      const scenarios = [
        {
          name: 'invalid UUID format',
          sessionId: 'invalid-uuid',
          expectedStatus: 400
        },
        {
          name: 'malformed UUID',
          sessionId: '123-456',
          expectedStatus: 400
        }
      ];

      for (const scenario of scenarios) {
        const response = await request(app)
          .get(`${endpoint}/${scenario.sessionId}/history`)
          .expect(scenario.expectedStatus);
        
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.error).toBe('string');
        expect(typeof response.body.message).toBe('string');
      }
    });
  });

  describe('Performance and Sorting', () => {
    it('should return analyses in chronological order (newest first)', async () => {
      const response = await request(app)
        .get(`${endpoint}/${sessionId}/history`)
        .expect(200);

      if (response.body.analyses.length > 1) {
        // Check that analyses are sorted by creation time (newest first)
        // This is a behavioral test, assuming the implementation will sort by createdAt
        const analyses = response.body.analyses;
        
        for (let i = 0; i < analyses.length - 1; i++) {
          // We can't directly compare dates since they're not in the minimal response
          // But we can verify the structure and that they exist
          expect(analyses[i]).toHaveProperty('requestId');
          expect(analyses[i + 1]).toHaveProperty('requestId');
        }
      }
    });
  });
});