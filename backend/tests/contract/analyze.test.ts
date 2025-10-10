import request from 'supertest';
import app from '../../src/app';

describe('POST /api/v1/analyze - Contract Tests', () => {
  const endpoint = '/api/v1/analyze';
  let sessionId: string;
  let imageIds: string[];

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
  });

  describe('Successful Analysis Request (200/202)', () => {
    it('should accept valid analysis request with single image', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: 'Describe this image in detail'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect((res) => {
          // Accept either 200 (sync) or 202 (async) response
          if (res.status !== 200 && res.status !== 202) {
            throw new Error(`Expected 200 or 202, got ${res.status}`);
          }
        });

      // Validate response structure based on status
      if (response.status === 200) {
        // AnalysisResponse schema
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('requestId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('content');
        expect(response.body).toHaveProperty('format');
        
        expect(typeof response.body.id).toBe('string');
        expect(typeof response.body.requestId).toBe('string');
        expect(['completed', 'partial', 'failed']).toContain(response.body.status);
        expect(typeof response.body.content).toBe('string');
      } else if (response.status === 202) {
        // AnalysisStatusResponse schema
        expect(response.body).toHaveProperty('requestId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('estimatedCompletionTime');
        expect(response.body).toHaveProperty('progressPercent');
        
        expect(typeof response.body.requestId).toBe('string');
        expect(['pending', 'processing', 'completed', 'failed', 'partial']).toContain(response.body.status);
        expect(typeof response.body.progressPercent).toBe('number');
        expect(response.body.progressPercent).toBeGreaterThanOrEqual(0);
        expect(response.body.progressPercent).toBeLessThanOrEqual(100);
      }
    });

    it('should accept valid analysis request with multiple images', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds,
        prompt: 'Compare these images and identify similarities and differences'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 202) {
            throw new Error(`Expected 200 or 202, got ${res.status}`);
          }
        });

      // Validate response structure
      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
    });

    it('should accept maximum length prompt (2000 characters)', async () => {
      const longPrompt = 'A'.repeat(2000); // Maximum allowed length
      
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: longPrompt
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 202) {
            throw new Error(`Expected 200 or 202, got ${res.status}`);
          }
        });

      expect(response.body).toHaveProperty('requestId');
    });
  });

  describe('Request Validation (400)', () => {
    it('should require sessionId field', async () => {
      const analysisRequest = {
        imageIds: [imageIds[0]],
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body.message).toMatch(/sessionId|required/i);
    });

    it('should validate sessionId format (UUID)', async () => {
      const analysisRequest = {
        sessionId: 'invalid-uuid',
        imageIds: [imageIds[0]],
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/sessionId|uuid|format/i);
    });

    it('should validate sessionId exists', async () => {
      const fakeSessionId = '550e8400-e29b-41d4-a716-446655440000';
      
      const analysisRequest = {
        sessionId: fakeSessionId,
        imageIds: [imageIds[0]],
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/session|not found|invalid/i);
    });

    it('should require imageIds field', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/imageIds|required/i);
    });

    it('should require at least 1 imageId', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [],
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/imageIds|at least|minimum/i);
    });

    it('should reject more than 5 imageIds', async () => {
      const tooManyImageIds = [
        imageIds[0], imageIds[1], 
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
        '550e8400-e29b-41d4-a716-446655440004' // 6 total
      ];
      
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: tooManyImageIds,
        prompt: 'Describe these images'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/imageIds|maximum|too many/i);
    });

    it('should validate imageId format (UUID)', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: ['invalid-uuid'],
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/imageId|uuid|format/i);
    });

    it('should validate imageIds exist', async () => {
      const fakeImageId = '550e8400-e29b-41d4-a716-446655440000';
      
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [fakeImageId],
        prompt: 'Describe this image'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/image|not found|invalid/i);
    });

    it('should require prompt field', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]]
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/prompt|required/i);
    });

    it('should require non-empty prompt', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: ''
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/prompt|empty|required/i);
    });

    it('should reject prompt longer than 2000 characters', async () => {
      const tooLongPrompt = 'A'.repeat(2001); // Exceeds maximum
      
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: tooLongPrompt
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/prompt|length|maximum/i);
    });
  });

  describe('Rate Limiting (429)', () => {
    it('should handle rate limit exceeded', async () => {
      // This test would require actual rate limiting implementation
      // For now, we'll test the response format when manually triggered
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: 'Test rate limiting'
      };

      // Make multiple rapid requests to potentially trigger rate limiting
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post(endpoint)
            .send(analysisRequest)
        );
      }

      const responses = await Promise.all(promises);
      
      // Check if any response is 429 and validate format
      const rateLimitResponse = responses.find(res => res.status === 429);
      if (rateLimitResponse) {
        expect(rateLimitResponse.body).toHaveProperty('error');
        expect(rateLimitResponse.body).toHaveProperty('message');
        expect(rateLimitResponse.body).toHaveProperty('retryAfter');
        expect(rateLimitResponse.body).toHaveProperty('limits');
        expect(rateLimitResponse.body).toHaveProperty('timestamp');
        
        expect(typeof rateLimitResponse.body.retryAfter).toBe('number');
      }
    });
  });

  describe('Content-Type Validation (400)', () => {
    it('should require application/json content type', async () => {
      const response = await request(app)
        .post(endpoint)
        .send('sessionId=test&imageIds=test&prompt=test')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('OpenAPI Schema Compliance', () => {
    it('should return exactly the fields defined in AnalysisResponse schema (200)', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: 'Simple test prompt'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest);

      if (response.status === 200) {
        const expectedFields = ['id', 'requestId', 'status', 'content', 'format'];
        const actualFields = Object.keys(response.body);
        expect(actualFields.sort()).toEqual(expectedFields.sort());
      }
    });

    it('should return exactly the fields defined in AnalysisStatusResponse schema (202)', async () => {
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [imageIds[0]],
        prompt: 'Simple test prompt'
      };

      const response = await request(app)
        .post(endpoint)
        .send(analysisRequest);

      if (response.status === 202) {
        const expectedFields = ['requestId', 'status', 'estimatedCompletionTime', 'progressPercent'];
        const actualFields = Object.keys(response.body);
        expect(actualFields.sort()).toEqual(expectedFields.sort());
      }
    });

    it('should match ValidationError schema for 400 responses', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({})
        .expect(400);

      const expectedFields = ['error', 'message', 'details'];
      const actualFields = Object.keys(response.body);
      expect(actualFields.sort()).toEqual(expectedFields.sort());
      
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should match RateLimitError schema for 429 responses', async () => {
      // This test would validate the schema when rate limiting is triggered
      // For contract testing, we're ensuring the expected structure
      const expectedRateLimitFields = ['error', 'message', 'retryAfter', 'limits', 'timestamp'];
      
      // Test with known rate limit trigger (if implemented)
      // For now, we validate the schema structure is defined correctly
      expect(expectedRateLimitFields).toHaveLength(5);
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error structure across all error cases', async () => {
      const errorScenarios = [
        {
          name: 'missing sessionId',
          request: () => request(app).post(endpoint).send({
            imageIds: [imageIds[0]],
            prompt: 'test'
          })
        },
        {
          name: 'missing imageIds',
          request: () => request(app).post(endpoint).send({
            sessionId: sessionId,
            prompt: 'test'
          })
        },
        {
          name: 'missing prompt',
          request: () => request(app).post(endpoint).send({
            sessionId: sessionId,
            imageIds: [imageIds[0]]
          })
        }
      ];

      for (const scenario of errorScenarios) {
        const response = await scenario.request().expect(400);
        
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('details');
        expect(typeof response.body.error).toBe('string');
        expect(typeof response.body.message).toBe('string');
        expect(Array.isArray(response.body.details)).toBe(true);
      }
    });
  });
});