import request from 'supertest';
import app from '../../src/app';

describe('GET /api/v1/health - Contract Tests', () => {
  describe('OpenAPI Schema Compliance', () => {
    it('should return exactly the fields specified in OpenAPI schema', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)
        .expect('Content-Type', /json/);

      // OpenAPI schema specifies only these fields
      const expectedFields = ['status', 'timestamp', 'version'];
      const actualFields = Object.keys(response.body);

      // Check that response has exactly the expected fields (no more, no less)
      expect(actualFields.sort()).toEqual(expectedFields.sort());
    });

    it('should have status field with enum value "healthy"', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(typeof response.body.status).toBe('string');
    });

    it('should have timestamp field in ISO date-time format', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(typeof response.body.timestamp).toBe('string');
      
      // Validate ISO 8601 date-time format
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(response.body.timestamp).toMatch(timestampRegex);
      
      // Ensure it's a valid date
      const date = new Date(response.body.timestamp);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should have version field as string', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.version).toBeDefined();
      expect(typeof response.body.version).toBe('string');
      expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic versioning
    });

    it('should not include additional fields beyond OpenAPI specification', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Ensure no extra fields (like 'system') are present
      const allowedFields = ['status', 'timestamp', 'version'];
      const extraFields = Object.keys(response.body).filter(
        field => !allowedFields.includes(field)
      );

      expect(extraFields).toHaveLength(0);
    });
  });

  describe('HTTP Response Validation', () => {
    it('should return 200 status code', async () => {
      await request(app)
        .get('/api/v1/health')
        .expect(200);
    });

    it('should return JSON content type', async () => {
      await request(app)
        .get('/api/v1/health')
        .expect('Content-Type', /application\/json/);
    });

    it('should respond within acceptable time (< 100ms)', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Response Body Structure', () => {
    it('should have all required properties', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });

    it('should have properties with correct types', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(typeof response.body.status).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.version).toBe('string');
    });
  });

  describe('API Consistency', () => {
    it('should return consistent response across multiple calls', async () => {
      const responses = await Promise.all([
        request(app).get('/api/v1/health'),
        request(app).get('/api/v1/health'),
        request(app).get('/api/v1/health')
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
        expect(response.body.version).toBe('0.1.0');
      });

      // Timestamps should be different (requests at different times)
      const timestamps = responses.map(r => r.body.timestamp);
      expect(new Set(timestamps).size).toBeGreaterThan(1);
    });

    it('should maintain stable version across requests', async () => {
      const response1 = await request(app).get('/api/v1/health');
      const response2 = await request(app).get('/api/v1/health');

      expect(response1.body.version).toBe(response2.body.version);
      expect(response1.body.status).toBe(response2.body.status);
    });
  });
});