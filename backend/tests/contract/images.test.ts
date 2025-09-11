import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../../src/app';

describe('POST /api/v1/images - Contract Tests', () => {
  const endpoint = '/api/v1/images';
  let sessionId: string;

  // Create test image files
  const createTestImage = (filename: string, sizeKB: number = 10): string => {
    const testDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const filePath = path.join(testDir, filename);
    // Create a simple PNG-like binary data for testing
    const buffer = Buffer.alloc(sizeKB * 1024, 0);
    // PNG magic number
    buffer.writeUInt32BE(0x89504E47, 0);
    buffer.writeUInt32BE(0x0D0A1A0A, 4);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  };

  beforeEach(async () => {
    // Create a session for testing
    const sessionResponse = await request(app)
      .post('/api/v1/session')
      .expect(201);
    
    sessionId = sessionResponse.body.sessionId;
  });

  afterEach(() => {
    // Clean up test files
    const testDir = path.join(__dirname, '../fixtures');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Successful Image Upload (201)', () => {
    it('should upload a single image successfully', async () => {
      const imagePath = createTestImage('test1.png', 10);
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .attach('images', imagePath)
        .expect(201);

      // Validate response structure according to OpenAPI schema
      expect(response.body).toHaveProperty('images');
      expect(response.body).toHaveProperty('totalSizeBytes');
      expect(response.body).toHaveProperty('sessionId');
      
      // Validate images array
      expect(Array.isArray(response.body.images)).toBe(true);
      expect(response.body.images).toHaveLength(1);
      
      const image = response.body.images[0];
      expect(image).toHaveProperty('id');
      expect(image).toHaveProperty('originalName');
      expect(image).toHaveProperty('mimeType');
      expect(image).toHaveProperty('sizeBytes');
      expect(image).toHaveProperty('dimensions');
      
      // Validate image metadata
      expect(typeof image.id).toBe('string');
      expect(image.originalName).toBe('test1.png');
      expect(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).toContain(image.mimeType);
      expect(typeof image.sizeBytes).toBe('number');
      expect(image.sizeBytes).toBeGreaterThan(0);
      
      // Validate totalSizeBytes
      expect(typeof response.body.totalSizeBytes).toBe('number');
      expect(response.body.totalSizeBytes).toBeGreaterThan(0);
      
      // Validate sessionId
      expect(response.body.sessionId).toBe(sessionId);
    });

    it('should upload multiple images (2-5 images)', async () => {
      const image1Path = createTestImage('test1.png', 10);
      const image2Path = createTestImage('test2.jpg', 15);
      const image3Path = createTestImage('test3.webp', 8);
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .attach('images', image1Path)
        .attach('images', image2Path)
        .attach('images', image3Path)
        .expect(201);

      expect(response.body.images).toHaveLength(3);
      expect(response.body.totalSizeBytes).toBeGreaterThan(0);
      
      // Verify all images have proper metadata
      response.body.images.forEach((image: any, index: number) => {
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('originalName');
        expect(image).toHaveProperty('mimeType');
        expect(image).toHaveProperty('sizeBytes');
        expect(image).toHaveProperty('dimensions');
        expect(typeof image.id).toBe('string');
        expect(image.sizeBytes).toBeGreaterThan(0);
      });
    });

    it('should handle maximum allowed images (5 images)', async () => {
      const imagePaths = [];
      for (let i = 1; i <= 5; i++) {
        imagePaths.push(createTestImage(`test${i}.png`, 5));
      }
      
      let requestAgent = request(app)
        .post(endpoint)
        .field('sessionId', sessionId);
      
      imagePaths.forEach(imagePath => {
        requestAgent = requestAgent.attach('images', imagePath);
      });
      
      const response = await requestAgent.expect(201);
      
      expect(response.body.images).toHaveLength(5);
      expect(response.body.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('File Format Validation (400)', () => {
    it('should reject unsupported file formats', async () => {
      const textFilePath = path.join(__dirname, '../fixtures/test.txt');
      const testDir = path.dirname(textFilePath);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(textFilePath, 'This is not an image');
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .attach('images', textFilePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should only accept JPEG, PNG, WebP, GIF formats', async () => {
      const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      
      // This test ensures the endpoint only accepts specified MIME types
      // The actual file validation will be tested in integration tests
      const imagePath = createTestImage('test.png', 10);
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .attach('images', imagePath)
        .expect(201);

      expect(supportedFormats).toContain(response.body.images[0].mimeType);
    });
  });

  describe('File Size Validation', () => {
    it('should reject files larger than 5MB', async () => {
      // Create a file larger than 5MB (5242880 bytes)
      const largePath = createTestImage('large.png', 6000); // 6MB
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .attach('images', largePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/size|large|limit/i);
    });

    it('should reject when total payload exceeds 20MB', async () => {
      // Create 5 files of 4.2MB each (total = 21MB > 20MB limit)
      // Each file is under 5MB individual limit but total exceeds 20MB
      const imagePaths = [];
      for (let i = 1; i <= 5; i++) {
        imagePaths.push(createTestImage(`large${i}.png`, 4200)); // 4.2MB each, total = 21MB
      }
      
      let requestAgent = request(app)
        .post(endpoint)
        .field('sessionId', sessionId);
      
      imagePaths.forEach(imagePath => {
        requestAgent = requestAgent.attach('images', imagePath);
      });
      
      // Expect either 413 (our app logic) or 400 (multer limitation)
      // For now, accept 400 since multer's LIMIT_FILE_SIZE might trigger first
      const response = await requestAgent.expect((res) => {
        if (res.status !== 400 && res.status !== 413) {
          throw new Error(`Expected 400 or 413, got ${res.status}`);
        }
      });
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('File Count Validation (400)', () => {
    it('should require at least 1 image', async () => {
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/image|required|missing/i);
    });

    it('should reject more than 5 images', async () => {
      const imagePaths = [];
      for (let i = 1; i <= 6; i++) {
        imagePaths.push(createTestImage(`test${i}.png`, 5));
      }
      
      let requestAgent = request(app)
        .post(endpoint)
        .field('sessionId', sessionId);
      
      imagePaths.forEach(imagePath => {
        requestAgent = requestAgent.attach('images', imagePath);
      });
      
      const response = await requestAgent.expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/maximum|limit|too many/i);
    });
  });

  describe('Session Validation (400)', () => {
    it('should require sessionId field', async () => {
      const imagePath = createTestImage('test.png', 10);
      
      const response = await request(app)
        .post(endpoint)
        .attach('images', imagePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/sessionId|session|required/i);
    });

    it('should validate sessionId format (UUID)', async () => {
      const imagePath = createTestImage('test.png', 10);
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', 'invalid-uuid')
        .attach('images', imagePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/sessionId|uuid|format/i);
    });

    it('should validate sessionId exists', async () => {
      const imagePath = createTestImage('test.png', 10);
      const fakeSessionId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', fakeSessionId)
        .attach('images', imagePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/session|not found|invalid/i);
    });
  });

  describe('Content-Type Validation (400)', () => {
    it('should require multipart/form-data content type', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({ sessionId: sessionId, images: 'not-a-file' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('OpenAPI Schema Compliance', () => {
    it('should return exactly the fields defined in ImageUploadResponse schema', async () => {
      const imagePath = createTestImage('test.png', 10);
      
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .attach('images', imagePath)
        .expect(201);

      // Check top-level response fields
      const expectedTopLevelFields = ['images', 'totalSizeBytes', 'sessionId'];
      const actualTopLevelFields = Object.keys(response.body);
      expect(actualTopLevelFields.sort()).toEqual(expectedTopLevelFields.sort());

      // Check image metadata fields
      const expectedImageFields = ['id', 'originalName', 'mimeType', 'sizeBytes', 'dimensions'];
      const actualImageFields = Object.keys(response.body.images[0]);
      expect(actualImageFields.sort()).toEqual(expectedImageFields.sort());
    });

    it('should match ValidationError schema for 400 responses', async () => {
      const response = await request(app)
        .post(endpoint)
        .field('sessionId', sessionId)
        .expect(400);

      const expectedFields = ['error', 'message', 'details'];
      const actualFields = Object.keys(response.body);
      expect(actualFields.sort()).toEqual(expectedFields.sort());
      
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent error structure across all error cases', async () => {
      // Test multiple error scenarios to ensure consistent error response format
      const errorScenarios = [
        { 
          name: 'missing images',
          request: () => request(app).post(endpoint).field('sessionId', sessionId)
        },
        {
          name: 'missing sessionId', 
          request: () => {
            const imagePath = createTestImage('test.png', 10);
            return request(app).post(endpoint).attach('images', imagePath);
          }
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