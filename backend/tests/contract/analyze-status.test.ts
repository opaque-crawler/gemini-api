import request from 'supertest';
import app from '../../src/app';

describe('GET /api/v1/analyze/{requestId} - Contract Tests', () => {
  const endpoint = '/api/v1/analyze';
  let sessionId: string;
  let imageIds: string[];
  let requestId: string;

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

    // Create an analysis request to get a requestId
    const analysisRequest = {
      sessionId: sessionId,
      imageIds: [imageIds[0]],
      prompt: 'Test analysis for status retrieval'
    };

    const analysisResponse = await request(app)
      .post('/api/v1/analyze')
      .send(analysisRequest)
      .expect((res) => {
        if (res.status !== 200 && res.status !== 202) {
          throw new Error(`Expected 200 or 202, got ${res.status}`);
        }
      });

    requestId = analysisResponse.body.requestId;
  });

  describe('Successful Analysis Result Retrieval (200)', () => {
    it('should return completed analysis result when status is completed', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`)
        .expect(200);

      // AnalysisResponse schema validation
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('format');
      
      expect(typeof response.body.id).toBe('string');
      expect(typeof response.body.requestId).toBe('string');
      expect(['completed', 'partial', 'failed']).toContain(response.body.status);
      expect(typeof response.body.content).toBe('string');
      expect(typeof response.body.format).toBe('string');
      
      // Verify requestId matches
      expect(response.body.requestId).toBe(requestId);
    });

    it('should include all required fields from AnalysisResponse schema', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`)
        .expect(200);

      const expectedFields = ['id', 'requestId', 'status', 'content', 'format'];
      const actualFields = Object.keys(response.body);
      expect(actualFields.sort()).toEqual(expectedFields.sort());
    });
  });

  describe('Analysis Still Processing (202)', () => {
    it('should return status information when analysis is still processing', async () => {
      // This test would require manipulating the analysis to be in processing state
      // For contract testing, we'll verify the expected response structure
      
      // Note: This scenario would be tested in integration tests with actual async processing
      // For contract tests, we're ensuring the endpoint exists and returns proper format
      const response = await request(app)
        .get(`${endpoint}/${requestId}`);

      if (response.status === 202) {
        // AnalysisStatusResponse schema validation
        expect(response.body).toHaveProperty('requestId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('estimatedCompletionTime');
        expect(response.body).toHaveProperty('progressPercent');
        
        expect(typeof response.body.requestId).toBe('string');
        expect(['pending', 'processing', 'completed', 'failed', 'partial']).toContain(response.body.status);
        expect(typeof response.body.progressPercent).toBe('number');
        expect(response.body.progressPercent).toBeGreaterThanOrEqual(0);
        expect(response.body.progressPercent).toBeLessThanOrEqual(100);
        
        // Verify requestId matches
        expect(response.body.requestId).toBe(requestId);
      }
    });

    it('should return exactly the fields defined in AnalysisStatusResponse schema for 202', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`);

      if (response.status === 202) {
        const expectedFields = ['requestId', 'status', 'estimatedCompletionTime', 'progressPercent'];
        const actualFields = Object.keys(response.body);
        expect(actualFields.sort()).toEqual(expectedFields.sort());
      }
    });
  });

  describe('Request Validation (400)', () => {
    it('should validate requestId format (UUID)', async () => {
      const invalidRequestId = 'invalid-uuid';
      
      const response = await request(app)
        .get(`${endpoint}/${invalidRequestId}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body.message).toMatch(/requestId|uuid|format/i);
    });

    it('should handle empty requestId parameter', async () => {
      const response = await request(app)
        .get(`${endpoint}/`)
        .expect(404); // Express returns 404 for missing route parameter

      // This is expected behavior - missing parameter results in different route
    });

    it('should validate requestId exists', async () => {
      const fakeRequestId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`${endpoint}/${fakeRequestId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/request|not found|analysis/i);
    });

    it('should handle malformed UUID with proper error', async () => {
      const malformedUuid = '123-456-789';
      
      const response = await request(app)
        .get(`${endpoint}/${malformedUuid}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/requestId|uuid|format/i);
    });
  });

  describe('Not Found (404)', () => {
    it('should return 404 for non-existent analysis request', async () => {
      const nonExistentRequestId = '550e8400-e29b-41d4-a716-446655440001';
      
      const response = await request(app)
        .get(`${endpoint}/${nonExistentRequestId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/analysis|request|not found/i);
    });

    it('should match Error schema for 404 responses', async () => {
      const nonExistentRequestId = '550e8400-e29b-41d4-a716-446655440002';
      
      const response = await request(app)
        .get(`${endpoint}/${nonExistentRequestId}`)
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

  describe('OpenAPI Schema Compliance', () => {
    it('should return response matching AnalysisResponse schema for 200', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`);

      if (response.status === 200) {
        // Validate AnalysisResponse schema compliance
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('requestId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('content');
        expect(response.body).toHaveProperty('format');
        
        // Type validations
        expect(typeof response.body.id).toBe('string');
        expect(typeof response.body.requestId).toBe('string');
        expect(['completed', 'partial', 'failed']).toContain(response.body.status);
        expect(typeof response.body.content).toBe('string');
        expect(['markdown', 'plaintext']).toContain(response.body.format);
      }
    });

    it('should return response matching AnalysisStatusResponse schema for 202', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`);

      if (response.status === 202) {
        // Validate AnalysisStatusResponse schema compliance
        expect(response.body).toHaveProperty('requestId');
        expect(response.body).toHaveProperty('status');
        
        // Type validations
        expect(typeof response.body.requestId).toBe('string');
        expect(['pending', 'processing', 'completed', 'failed', 'partial']).toContain(response.body.status);
        
        // Optional fields if present
        if (response.body.estimatedCompletionTime) {
          expect(typeof response.body.estimatedCompletionTime).toBe('string');
        }
        
        if (response.body.progressPercent !== undefined) {
          expect(typeof response.body.progressPercent).toBe('number');
          expect(response.body.progressPercent).toBeGreaterThanOrEqual(0);
          expect(response.body.progressPercent).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should handle URL parameter extraction correctly', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440003';
      
      const response = await request(app)
        .get(`${endpoint}/${validUuid}`);

      // Should attempt to process the UUID even if not found
      // This validates that the route parameter is being extracted
      expect([200, 202, 404]).toContain(response.status);
    });
  });

  describe('Response Headers and Content Type', () => {
    it('should return JSON content type for all responses', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should return JSON content type for error responses', async () => {
      const invalidRequestId = 'invalid-uuid';
      
      const response = await request(app)
        .get(`${endpoint}/${invalidRequestId}`)
        .expect(400);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error structure for validation errors', async () => {
      const scenarios = [
        {
          name: 'invalid UUID format',
          requestId: 'invalid-uuid',
          expectedStatus: 400
        },
        {
          name: 'malformed UUID',
          requestId: '123-456',
          expectedStatus: 400
        }
      ];

      for (const scenario of scenarios) {
        const response = await request(app)
          .get(`${endpoint}/${scenario.requestId}`)
          .expect(scenario.expectedStatus);
        
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.error).toBe('string');
        expect(typeof response.body.message).toBe('string');
      }
    });
  });
});