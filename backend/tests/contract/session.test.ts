import request from 'supertest';
import app from '../../src/app';

describe('POST /api/v1/session - Contract Tests', () => {
  describe('OpenAPI Schema Compliance', () => {
    it('should return 201 status code for session creation', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201)
        .expect('Content-Type', /json/);
    });

    it('should return exactly the fields specified in OpenAPI schema', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      // OpenAPI schema specifies exactly these fields
      const expectedFields = ['sessionId', 'createdAt', 'rateLimits'];
      const actualFields = Object.keys(response.body);

      expect(actualFields.sort()).toEqual(expectedFields.sort());
    });

    it('should have sessionId field as UUID format', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      expect(response.body.sessionId).toBeDefined();
      expect(typeof response.body.sessionId).toBe('string');
      
      // Validate UUID v4 format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(response.body.sessionId).toMatch(uuidRegex);
    });

    it('should have createdAt field in ISO date-time format', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(typeof response.body.createdAt).toBe('string');
      
      // Validate ISO 8601 date-time format
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(response.body.createdAt).toMatch(timestampRegex);
      
      // Ensure it's a valid date
      const date = new Date(response.body.createdAt);
      expect(date.getTime()).not.toBeNaN();
      
      // Should be recent (within last 5 seconds)
      const now = new Date();
      const timeDiff = now.getTime() - date.getTime();
      expect(timeDiff).toBeLessThan(5000);
    });

    it('should have rateLimits field with correct structure', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      expect(response.body.rateLimits).toBeDefined();
      expect(typeof response.body.rateLimits).toBe('object');
      
      // Should have requestsPerMinute and tokensPerMinute
      expect(response.body.rateLimits).toHaveProperty('requestsPerMinute');
      expect(response.body.rateLimits).toHaveProperty('tokensPerMinute');
    });

    it('should have requestsPerMinute with correct structure', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      const rpm = response.body.rateLimits.requestsPerMinute;
      
      expect(rpm).toBeDefined();
      expect(typeof rpm).toBe('object');
      expect(rpm).toHaveProperty('limit');
      expect(rpm).toHaveProperty('remaining');
      expect(rpm).toHaveProperty('resetAt');
      
      expect(typeof rpm.limit).toBe('number');
      expect(typeof rpm.remaining).toBe('number');
      expect(typeof rpm.resetAt).toBe('string');
      
      // Validate resetAt is ISO date-time
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(rpm.resetAt).toMatch(timestampRegex);
    });

    it('should have tokensPerMinute with correct structure', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      const tpm = response.body.rateLimits.tokensPerMinute;
      
      expect(tpm).toBeDefined();
      expect(typeof tpm).toBe('object');
      expect(tpm).toHaveProperty('limit');
      expect(tpm).toHaveProperty('remaining');
      expect(tpm).toHaveProperty('resetAt');
      
      expect(typeof tpm.limit).toBe('number');
      expect(typeof tpm.remaining).toBe('number');
      expect(typeof tpm.resetAt).toBe('string');
      
      // Validate resetAt is ISO date-time
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(tpm.resetAt).toMatch(timestampRegex);
    });
  });

  describe('Rate Limit Initialization', () => {
    it('should initialize rate limits according to environment configuration', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      const rateLimits = response.body.rateLimits;
      
      // Should match environment defaults (10 RPM, 250K TPM for Gemini Free Tier)
      expect(rateLimits.requestsPerMinute.limit).toBe(10);
      expect(rateLimits.requestsPerMinute.remaining).toBe(10);
      expect(rateLimits.tokensPerMinute.limit).toBe(250000);
      expect(rateLimits.tokensPerMinute.remaining).toBe(250000);
    });

    it('should set resetAt to next minute boundary', async () => {
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      const rateLimits = response.body.rateLimits;
      const resetTime = new Date(rateLimits.requestsPerMinute.resetAt);
      const now = new Date();
      
      // Should be in the future but within next minute
      expect(resetTime.getTime()).toBeGreaterThan(now.getTime());
      expect(resetTime.getTime() - now.getTime()).toBeLessThan(60000);
      
      // Both rate limits should have same reset time
      expect(rateLimits.requestsPerMinute.resetAt).toBe(rateLimits.tokensPerMinute.resetAt);
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs for each request', async () => {
      const responses = await Promise.all([
        request(app).post('/api/v1/session'),
        request(app).post('/api/v1/session'),
        request(app).post('/api/v1/session')
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const sessionIds = responses.map(r => r.body.sessionId);
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(3); // All should be unique
    });

    it('should maintain session ID format consistency', async () => {
      const responses = await Promise.all(
        Array(5).fill(null).map(() => request(app).post('/api/v1/session'))
      );

      responses.forEach(response => {
        expect(response.status).toBe(201);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(response.body.sessionId).toMatch(uuidRegex);
      });
    });
  });

  describe('HTTP Response Validation', () => {
    it('should return JSON content type', async () => {
      await request(app)
        .post('/api/v1/session')
        .expect('Content-Type', /application\/json/);
    });

    it('should respond within acceptable time (< 200ms)', async () => {
      const start = Date.now();
      
      await request(app)
        .post('/api/v1/session')
        .expect(201);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });

    it('should not require request body', async () => {
      // Session creation should work without any body
      await request(app)
        .post('/api/v1/session')
        .expect(201);
    });

    it('should ignore request body if provided', async () => {
      // Should work even with arbitrary body data
      await request(app)
        .post('/api/v1/session')
        .send({ arbitrary: 'data' })
        .expect(201);
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // This test will be relevant when we implement actual session storage
      // For now, we expect successful creation always
      const response = await request(app)
        .post('/api/v1/session')
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
    });
  });
});