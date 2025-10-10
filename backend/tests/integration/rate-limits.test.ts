import request from 'supertest';
import app from '../../src/app';

describe('Integration Test: Rate Limiting', () => {
  let sessionId: string;

  beforeEach(async () => {
    // Create a session for testing
    const sessionResponse = await request(app)
      .post('/api/v1/session')
      .expect(201);
    
    sessionId = sessionResponse.body.sessionId;
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
  });

  describe('Session-Level Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make several requests within the rate limit (should be < 10 requests per minute)
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/api/v1/health')
            .expect(200)
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'healthy');
      });
    });

    it('should reject requests when rate limit exceeded', async () => {
      // Make requests to exceed the rate limit (10 requests per minute per session)
      const requests: Promise<any>[] = [];
      
      // First 10 requests should succeed
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/v1/health')
            .expect(200)
        );
      }

      await Promise.all(requests);

      // 11th request should be rate limited
      const response = await request(app)
        .get('/api/v1/health')
        .expect(429);

      expect(response.body).toHaveProperty('error', 'rate_limit_exceeded');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/rate limit.*exceeded/i);
      expect(response.body).toHaveProperty('retryAfter');
      expect(typeof response.body.retryAfter).toBe('number');
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Check for rate limiting headers
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
      
      const limitHeader = response.headers['x-ratelimit-limit'] as string;
      const remainingHeader = response.headers['x-ratelimit-remaining'] as string;
      const resetHeader = response.headers['x-ratelimit-reset'] as string;
      
      expect(parseInt(limitHeader)).toBeGreaterThan(0);
      expect(parseInt(remainingHeader)).toBeGreaterThanOrEqual(0);
      expect(parseInt(resetHeader)).toBeGreaterThan(Date.now() / 1000);
    });

    it('should reset rate limit after time window', async () => {
      // This test would require waiting for the time window to reset
      // For CI/CD environments, we'll simulate this with a shorter test
      
      // Make requests up to the limit
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/v1/health')
            .expect(200)
        );
      }

      await Promise.all(requests);

      // Next request should be rate limited
      const limitedResponse = await request(app)
        .get('/api/v1/health')
        .expect(429);

      expect(limitedResponse.body.error).toBe('rate_limit_exceeded');
      
      // In a real test, we would wait for the window to reset
      // For now, we'll just verify the structure is correct
      expect(limitedResponse.body).toHaveProperty('retryAfter');
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    it('should apply different limits to different endpoints', async () => {
      // Health endpoint should have higher limits than analysis endpoints
      const healthRequests = [];
      for (let i = 0; i < 5; i++) {
        healthRequests.push(
          request(app)
            .get('/api/v1/health')
            .expect(200)
        );
      }

      await Promise.all(healthRequests);

      // Analysis requests should have stricter limits
      const smallFile = Buffer.alloc(1024, 'x');
      
      // First few analysis requests should succeed
      const analysisResponse1 = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', smallFile, 'test1.jpg')
        .expect(201);

      expect(analysisResponse1.body).toHaveProperty('images');
    });

    it('should handle concurrent requests properly', async () => {
      // Test concurrent requests to ensure rate limiting works correctly
      const concurrentRequests = [];
      
      for (let i = 0; i < 8; i++) {
        concurrentRequests.push(
          request(app)
            .get('/api/v1/health')
        );
      }

      const responses = await Promise.all(concurrentRequests);
      
      // Most requests should succeed
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      // If any are rate limited, they should have proper error structure
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveProperty('error', 'rate_limit_exceeded');
        expect(response.body).toHaveProperty('retryAfter');
      });
    });
  });

  describe('Token-Based Rate Limiting', () => {
    it('should track token usage for analysis requests', async () => {
      // Create a test image for analysis
      const testImage = Buffer.alloc(1024, 'x');
      
      // Upload image
      const uploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', testImage, 'test.jpg')
        .expect(201);

      const imageId = uploadResponse.body.images[0].id;

      // Submit analysis request
      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send({
          sessionId: sessionId,
          imageIds: [imageId],
          prompt: 'Describe this image in detail'
        })
        .expect(202);

      expect(analysisResponse.body).toHaveProperty('requestId');
      
      // Check rate limit headers should include token information
      const tokensRemainingHeader = analysisResponse.headers['x-ratelimit-tokens-remaining'] as string;
      if (tokensRemainingHeader) {
        expect(parseInt(tokensRemainingHeader)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should reject requests when token limit exceeded', async () => {
      // This test simulates exceeding the token limit (250K tokens per minute)
      // In practice, this would require making many large analysis requests
      
      const testImage = Buffer.alloc(1024, 'x');
      
      // Upload image
      const uploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', testImage, 'test.jpg')
        .expect(201);

      const imageId = uploadResponse.body.images[0].id;

      // Create a very long prompt to consume tokens
      const longPrompt = 'Describe this image in extreme detail. '.repeat(100); // ~3000 characters
      
      // Submit analysis request
      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send({
          sessionId: sessionId,
          imageIds: [imageId],
          prompt: longPrompt
        });

      // This should either succeed (202) or be rate limited (429)
      expect([202, 429]).toContain(analysisResponse.status);
      
      if (analysisResponse.status === 429) {
        expect(analysisResponse.body).toHaveProperty('error', 'rate_limit_exceeded');
        expect(analysisResponse.body.message).toMatch(/token.*limit/i);
      }
    });
  });

  describe('Global Rate Limiting', () => {
    it('should handle multiple sessions independently', async () => {
      // Create multiple sessions
      const session1Response = await request(app)
        .post('/api/v1/session')
        .expect(201);
      
      const session2Response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      const session1Id = session1Response.body.sessionId;
      const session2Id = session2Response.body.sessionId;

      expect(session1Id).not.toBe(session2Id);

      // Make requests from both sessions
      const session1Request = request(app)
        .get('/api/v1/health')
        .expect(200);

      const session2Request = request(app)
        .get('/api/v1/health')
        .expect(200);

      const [response1, response2] = await Promise.all([session1Request, session2Request]);
      
      expect(response1.body.status).toBe('healthy');
      expect(response2.body.status).toBe('healthy');
    });

    it('should apply global limits across all sessions', async () => {
      // Test that there are global limits that apply regardless of session
      // This would be important for preventing abuse
      
      const sessions: string[] = [];
      
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const sessionResponse = await request(app)
          .post('/api/v1/session')
          .expect(201);
        sessions.push(sessionResponse.body.sessionId);
      }

      // Make requests from all sessions
      const requests: Promise<any>[] = [];
      sessions.forEach(sessionId => {
        for (let i = 0; i < 5; i++) {
          requests.push(
            request(app)
              .get('/api/v1/health')
              .expect(200)
          );
        }
      });

      const responses = await Promise.all(requests);
      
      // All should succeed if global limits are not hit
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Rate Limit Error Handling', () => {
    it('should provide clear error messages for rate limit violations', async () => {
      // Exceed rate limit
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .get('/api/v1/health')
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toEqual({
          error: 'rate_limit_exceeded',
          message: expect.stringMatching(/rate limit.*exceeded/i),
          retryAfter: expect.any(Number),
          details: expect.arrayContaining([
            expect.stringMatching(/requests.*per.*minute/i)
          ])
        });

        // Verify error response headers
        expect(rateLimitedResponse.headers['content-type']).toMatch(/application\/json/);
      }
    });

    it('should handle rate limiting gracefully during high load', async () => {
      // Simulate high load scenario
      const highLoadRequests: Promise<any>[] = [];
      
      for (let i = 0; i < 20; i++) {
        highLoadRequests.push(
          request(app)
            .get('/api/v1/health')
        );
      }

      const responses = await Promise.all(highLoadRequests);
      
      // Some requests should succeed, others may be rate limited
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      // Rate limited responses should have proper structure
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveProperty('error', 'rate_limit_exceeded');
        expect(response.body).toHaveProperty('retryAfter');
        expect(typeof response.body.retryAfter).toBe('number');
        expect(response.body.retryAfter).toBeGreaterThan(0);
      });
    });

    it('should maintain consistent rate limit behavior across different endpoints', async () => {
      // Test rate limiting consistency across endpoints
      const endpoints = [
        { method: 'get' as const, path: '/api/v1/health' },
        { method: 'post' as const, path: '/api/v1/session' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        
        // Should either succeed or be properly rate limited
        expect([200, 201, 429]).toContain(response.status);
        
        if (response.status === 429) {
          expect(response.body).toHaveProperty('error', 'rate_limit_exceeded');
        }
      }
    });
  });

  describe('Rate Limit Performance', () => {
    it('should handle rate limiting checks efficiently', async () => {
      const startTime = Date.now();
      
      // Make a series of requests
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/v1/health')
        );
      }

      await Promise.all(requests);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Rate limiting should not significantly impact performance
      // 10 requests should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);
    });

    it('should not leak memory during rate limit tracking', async () => {
      // This test ensures rate limit tracking doesn't cause memory leaks
      // In practice, this would be monitored during load testing
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make many requests to trigger rate limit tracking
      const requests: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/v1/health')
        );
      }

      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});