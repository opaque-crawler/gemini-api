import request from 'supertest';
import app from '../../src/app';

describe('Integration Test: File Size Limits', () => {
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

  describe('Individual File Size Validation', () => {
    it('should reject files larger than 5MB', async () => {
      // Create a buffer larger than 5MB (5 * 1024 * 1024 = 5242880 bytes)
      const largefile = Buffer.alloc(5242881, 'x'); // 5MB + 1 byte
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', largefile, 'large-file.jpg')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('validation_error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/exceeds maximum size limit/i);
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details[0]).toMatch(/5242881.*5242880/);
    });

    it('should accept files exactly at 5MB limit', async () => {
      // Create a buffer exactly at 5MB limit
      const maxSizeFile = Buffer.alloc(5242880, 'x'); // Exactly 5MB
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', maxSizeFile, 'max-size-file.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('images');
      expect(Array.isArray(response.body.images)).toBe(true);
      expect(response.body.images.length).toBe(1);
      expect(response.body.images[0]).toHaveProperty('id');
      expect(response.body.images[0]).toHaveProperty('sizeBytes');
      expect(response.body.images[0].sizeBytes).toBe(5242880);
    });

    it('should accept small files well under the limit', async () => {
      const smallFile = Buffer.alloc(1024, 'x'); // 1KB file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', smallFile, 'small-file.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('images');
      expect(response.body.images.length).toBe(1);
      expect(response.body.images[0].sizeBytes).toBe(1024);
    });

    it('should reject multiple files when one exceeds the limit', async () => {
      const validFile = Buffer.alloc(1024, 'x'); // 1KB
      const oversizedFile = Buffer.alloc(5242881, 'x'); // 5MB + 1 byte
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', validFile, 'valid-file.jpg')
        .attach('images', oversizedFile, 'oversized-file.jpg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/oversized-file\.jpg.*exceeds maximum size limit/i);
      expect(response.body.details[0]).toMatch(/5242881.*5242880/);
    });
  });

  describe('Total Upload Size Validation', () => {
    it('should reject when total upload size exceeds 20MB', async () => {
      // Create 5 files of 4.1MB each (total > 20MB)
      const file41MB = Buffer.alloc(4300000, 'x'); // 4.1MB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', file41MB, 'file1.jpg')
        .attach('images', file41MB, 'file2.jpg')
        .attach('images', file41MB, 'file3.jpg')
        .attach('images', file41MB, 'file4.jpg')
        .attach('images', file41MB, 'file5.jpg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/upload size.*exceeds.*maximum.*20MB/i);
      expect(response.body.details[0]).toMatch(/21500000.*20971520/);
    });

    it('should accept when total upload size is exactly 20MB', async () => {
      // Create 4 files of exactly 5MB each (total = 20MB)
      const file5MB = Buffer.alloc(5242880, 'x'); // Exactly 5MB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', file5MB, 'file1.jpg')
        .attach('images', file5MB, 'file2.jpg')
        .attach('images', file5MB, 'file3.jpg')
        .attach('images', file5MB, 'file4.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('images');
      expect(response.body.images.length).toBe(4);
      expect(response.body).toHaveProperty('totalSizeBytes');
      expect(response.body.totalSizeBytes).toBe(20971520); // 20MB
    });

    it('should accept when total upload size is under 20MB', async () => {
      // Create 3 files of 3MB each (total = 9MB)
      const file3MB = Buffer.alloc(3145728, 'x'); // 3MB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', file3MB, 'file1.jpg')
        .attach('images', file3MB, 'file2.jpg')
        .attach('images', file3MB, 'file3.jpg')
        .expect(201);

      expect(response.body.images.length).toBe(3);
      expect(response.body.totalSizeBytes).toBe(9437184); // 9MB
    });
  });

  describe('File Count Limits', () => {
    it('should reject when uploading more than 5 images', async () => {
      const smallFile = Buffer.alloc(1024, 'x'); // 1KB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', smallFile, 'file1.jpg')
        .attach('images', smallFile, 'file2.jpg')
        .attach('images', smallFile, 'file3.jpg')
        .attach('images', smallFile, 'file4.jpg')
        .attach('images', smallFile, 'file5.jpg')
        .attach('images', smallFile, 'file6.jpg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/maximum.*5.*images/i);
      expect(response.body.details[0]).toMatch(/6.*files.*5/);
    });

    it('should accept exactly 5 images', async () => {
      const smallFile = Buffer.alloc(1024, 'x'); // 1KB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', smallFile, 'file1.jpg')
        .attach('images', smallFile, 'file2.jpg')
        .attach('images', smallFile, 'file3.jpg')
        .attach('images', smallFile, 'file4.jpg')
        .attach('images', smallFile, 'file5.jpg')
        .expect(201);

      expect(response.body.images.length).toBe(5);
    });

    it('should reject empty upload (no files)', async () => {
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/no.*files.*provided/i);
    });
  });

  describe('File Type and Size Combination', () => {
    it('should validate size for different image formats', async () => {
      // Test with different extensions but same large size
      const largeFile = Buffer.alloc(5242881, 'x'); // Over 5MB
      
      const testCases = [
        { filename: 'large.jpg', mimetype: 'image/jpeg' },
        { filename: 'large.png', mimetype: 'image/png' },
        { filename: 'large.webp', mimetype: 'image/webp' },
        { filename: 'large.gif', mimetype: 'image/gif' }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/v1/images')
          .field('sessionId', sessionId)
          .attach('images', largeFile, testCase.filename)
          .expect(400);

        expect(response.body.error).toBe('validation_error');
        expect(response.body.message).toMatch(new RegExp(`${testCase.filename}.*exceeds maximum size limit`, 'i'));
      }
    });

    it('should handle edge cases with very small files', async () => {
      // Test with minimal file sizes
      const tinyFile = Buffer.alloc(1, 'x'); // 1 byte
      const emptyFile = Buffer.alloc(0); // 0 bytes
      
      // 1 byte file should be accepted
      const response1 = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', tinyFile, 'tiny.jpg')
        .expect(201);

      expect(response1.body.images[0].sizeBytes).toBe(1);

      // Create new session for second test
      const session2Response = await request(app)
        .post('/api/v1/session')
        .expect(201);
      
      const sessionId2 = session2Response.body.sessionId;

      // 0 byte file should be handled gracefully
      const response2 = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId2)
        .attach('images', emptyFile, 'empty.jpg')
        .expect(201);

      expect(response2.body.images[0].sizeBytes).toBe(0);
    });
  });

  describe('Error Messages and Response Format', () => {
    it('should provide detailed error information for size violations', async () => {
      const oversizedFile = Buffer.alloc(10485760, 'x'); // 10MB file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', oversizedFile, 'huge-file.jpg')
        .expect(400);

      // Verify error response structure
      expect(response.body).toEqual({
        error: 'validation_error',
        message: expect.stringMatching(/huge-file\.jpg.*exceeds maximum size limit.*5MB/i),
        details: expect.arrayContaining([
          expect.stringMatching(/File size:.*10485760.*bytes.*limit:.*5242880.*bytes/)
        ])
      });

      // Verify error response headers
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should provide appropriate error for total size violation', async () => {
      // Create files that individually pass but collectively fail
      const file4MB = Buffer.alloc(4194304, 'x'); // 4MB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', file4MB, 'file1.jpg')
        .attach('images', file4MB, 'file2.jpg')
        .attach('images', file4MB, 'file3.jpg')
        .attach('images', file4MB, 'file4.jpg')
        .attach('images', file4MB, 'file5.jpg')
        .attach('images', file4MB, 'file6.jpg') // This will cause total > 20MB
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/total.*size.*24MB.*exceeds.*maximum.*20MB/i);
      expect(response.body.details[0]).toMatch(/Total size:.*25165824.*bytes.*limit:.*20971520.*bytes/);
    });

    it('should handle mixed validation errors correctly', async () => {
      // Test with both oversized individual files and too many files
      const oversizedFile = Buffer.alloc(5242881, 'x'); // Over 5MB
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', oversizedFile, 'big1.jpg')
        .attach('images', oversizedFile, 'big2.jpg')
        .attach('images', oversizedFile, 'big3.jpg')
        .attach('images', oversizedFile, 'big4.jpg')
        .attach('images', oversizedFile, 'big5.jpg')
        .attach('images', oversizedFile, 'big6.jpg')
        .expect(400);

      // Should fail on file count first (as it's checked before size)
      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/maximum.*5.*images/i);
    });
  });

  describe('Performance with Large Files', () => {
    it('should handle large file uploads efficiently', async () => {
      const startTime = Date.now();
      const file5MB = Buffer.alloc(5242880, 'x'); // 5MB file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', file5MB, 'performance-test.jpg')
        .expect(201);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.body.images[0].sizeBytes).toBe(5242880);
      
      // Upload should complete within reasonable time (5 seconds for 5MB)
      expect(uploadTime).toBeLessThan(5000);
    });

    it('should handle multiple large files within time constraints', async () => {
      const startTime = Date.now();
      const file4MB = Buffer.alloc(4194304, 'x'); // 4MB per file
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', file4MB, 'large1.jpg')
        .attach('images', file4MB, 'large2.jpg')
        .attach('images', file4MB, 'large3.jpg')
        .attach('images', file4MB, 'large4.jpg')
        .attach('images', file4MB, 'large5.jpg')
        .expect(201);

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      expect(response.body.images.length).toBe(5);
      expect(response.body.totalSizeBytes).toBe(20971520); // 20MB total
      
      // Should complete within 10 seconds for 20MB total
      expect(uploadTime).toBeLessThan(10000);
    });
  });
});