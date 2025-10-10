import request from 'supertest';
import app from '../../src/app';

describe('GET /api/v1/export/{requestId} - Contract Tests', () => {
  const endpoint = '/api/v1/export';
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
      prompt: 'Test analysis for export functionality'
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

  describe('Successful Export (200)', () => {
    it('should export analysis result as JSON (default format)', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}`)
        .expect(200);

      // Should return JSON format by default
      expect(response.headers['content-type']).toMatch(/application\/json/);
      
      // Should match AnalysisResponse schema
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

    it('should export analysis result as JSON when explicitly requested', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=json`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('requestId');
      expect(response.body.requestId).toBe(requestId);
    });

    it('should export analysis result as Markdown', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=markdown`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/markdown/);
      expect(typeof response.text).toBe('string');
      expect(response.text.length).toBeGreaterThan(0);
      
      // Markdown should contain some structured content
      expect(response.text).toMatch(/analysis|result|content/i);
    });

    it('should export analysis result as plain text', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=txt`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(typeof response.text).toBe('string');
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should include proper headers for file download', async () => {
      const formats = [
        { format: 'json', contentType: 'application/json', extension: 'json' },
        { format: 'markdown', contentType: 'text/markdown', extension: 'md' },
        { format: 'txt', contentType: 'text/plain', extension: 'txt' }
      ];

      for (const formatTest of formats) {
        const response = await request(app)
          .get(`${endpoint}/${requestId}?format=${formatTest.format}`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(new RegExp(formatTest.contentType));
        
        // Should have content-disposition header for download
        if (formatTest.format !== 'json') {
          expect(response.headers['content-disposition']).toMatch(/attachment/);
          expect(response.headers['content-disposition']).toMatch(new RegExp(`\\.${formatTest.extension}`));
        }
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
      expect(response.body.message).toMatch(/requestId|uuid|format/i);
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

    it('should validate format parameter values', async () => {
      const invalidFormats = ['pdf', 'xml', 'html', 'csv'];
      
      for (const format of invalidFormats) {
        const response = await request(app)
          .get(`${endpoint}/${requestId}?format=${format}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/format|invalid|supported/i);
      }
    });

    it('should handle empty requestId parameter', async () => {
      const response = await request(app)
        .get(`${endpoint}/`)
        .expect(404); // Express returns 404 for missing route parameter

      // This is expected behavior - missing parameter results in different route
    });
  });

  describe('Not Found (404)', () => {
    it('should return 404 for non-existent analysis request', async () => {
      const nonExistentRequestId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`${endpoint}/${nonExistentRequestId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/analysis|request|not found/i);
    });

    it('should match Error schema for 404 responses', async () => {
      const nonExistentRequestId = '550e8400-e29b-41d4-a716-446655440001';
      
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

  describe('Format-Specific Content Tests', () => {
    it('should return valid JSON structure for JSON format', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=json`)
        .expect(200);

      // Should be valid JSON
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
      
      // Should match AnalysisResponse schema
      const expectedFields = ['id', 'requestId', 'status', 'content', 'format'];
      const actualFields = Object.keys(response.body);
      expect(actualFields.sort()).toEqual(expectedFields.sort());
    });

    it('should return properly formatted Markdown content', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=markdown`)
        .expect(200);

      const content = response.text;
      
      // Should contain markdown formatting
      expect(content).toMatch(/^#|##|###/m); // Headers
      expect(content).toMatch(/\*\*.*\*\*|\*.*\*/); // Bold or italic
      expect(content).toContain('Analysis Result'); // Expected title
    });

    it('should return clean plain text content', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=txt`)
        .expect(200);

      const content = response.text;
      
      // Should not contain markdown or HTML formatting
      expect(content).not.toMatch(/<[^>]*>/); // No HTML tags
      expect(content).not.toMatch(/\*\*|\*|#|`/); // No markdown syntax
      expect(content).toMatch(/analysis|result/i); // Should contain content
    });
  });

  describe('Query Parameter Handling', () => {
    it('should handle case-insensitive format parameter', async () => {
      const formats = ['JSON', 'Json', 'MARKDOWN', 'Markdown', 'TXT', 'Txt'];
      
      for (const format of formats) {
        const response = await request(app)
          .get(`${endpoint}/${requestId}?format=${format}`);

        // Should accept case-insensitive formats
        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          // Should process the format correctly
          const lowerFormat = format.toLowerCase();
          if (lowerFormat === 'json') {
            expect(response.headers['content-type']).toMatch(/application\/json/);
          } else if (lowerFormat === 'markdown') {
            expect(response.headers['content-type']).toMatch(/text\/markdown/);
          } else if (lowerFormat === 'txt') {
            expect(response.headers['content-type']).toMatch(/text\/plain/);
          }
        }
      }
    });

    it('should ignore unknown query parameters', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=json&unknown=value&extra=param`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body.requestId).toBe(requestId);
    });
  });

  describe('OpenAPI Schema Compliance', () => {
    it('should return correct content-type headers per OpenAPI spec', async () => {
      const formatTests = [
        { format: 'json', expectedType: 'application/json' },
        { format: 'markdown', expectedType: 'text/markdown' },
        { format: 'txt', expectedType: 'text/plain' }
      ];

      for (const test of formatTests) {
        const response = await request(app)
          .get(`${endpoint}/${requestId}?format=${test.format}`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(new RegExp(test.expectedType));
      }
    });

    it('should handle URL parameter extraction correctly', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440003';
      
      const response = await request(app)
        .get(`${endpoint}/${validUuid}`);

      // Should attempt to process the UUID even if not found
      // This validates that the route parameter is being extracted
      expect([200, 404]).toContain(response.status);
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

  describe('Content Length and Performance', () => {
    it('should return appropriate content-length headers', async () => {
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=json`)
        .expect(200);

      // Should have content-length header
      expect(response.headers['content-length']).toBeDefined();
      expect(parseInt(response.headers['content-length'] || '0')).toBeGreaterThan(0);
    });

    it('should handle format parameter efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`${endpoint}/${requestId}?format=markdown`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Should respond quickly (under 1 second for mock data)
      expect(responseTime).toBeLessThan(1000);
      expect(response.text.length).toBeGreaterThan(0);
    });
  });
});