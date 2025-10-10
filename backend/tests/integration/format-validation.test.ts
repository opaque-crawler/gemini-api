import request from 'supertest';
import app from '../../src/app';

describe('Integration Test: File Format Validation', () => {
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

  describe('Supported File Format Validation', () => {
    it('should accept JPEG files', async () => {
      // Create a minimal JPEG file header
      const jpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xD9
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'test.jpg')
        .expect(201);

      expect(response.body).toHaveProperty('images');
      expect(Array.isArray(response.body.images)).toBe(true);
      expect(response.body.images.length).toBe(1);
      expect(response.body.images[0]).toHaveProperty('mimeType');
      expect(response.body.images[0].mimeType).toBe('image/jpeg');
      expect(response.body.images[0]).toHaveProperty('originalName');
      expect(response.body.images[0].originalName).toBe('test.jpg');
    });

    it('should accept PNG files', async () => {
      // Create a minimal PNG file header
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
        0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', pngBuffer, 'test.png')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/png');
      expect(response.body.images[0].originalName).toBe('test.png');
    });

    it('should accept WebP files', async () => {
      // Create a minimal WebP file header
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        0x56, 0x50, 0x38, 0x20, 0x0E, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', webpBuffer, 'test.webp')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/webp');
      expect(response.body.images[0].originalName).toBe('test.webp');
    });

    it('should accept GIF files', async () => {
      // Create a minimal GIF file header
      const gifBuffer = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x21, 0xF9, 0x04, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x00, 0x02, 0x02, 0x04, 0x01, 0x00, 0x3B
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', gifBuffer, 'test.gif')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/gif');
      expect(response.body.images[0].originalName).toBe('test.gif');
    });

    it('should accept multiple files with different formats', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'image1.jpg')
        .attach('images', pngBuffer, 'image2.png')
        .attach('images', webpBuffer, 'image3.webp')
        .expect(201);

      expect(response.body.images.length).toBe(3);
      
      const mimeTypes = response.body.images.map((img: any) => img.mimeType);
      expect(mimeTypes).toContain('image/jpeg');
      expect(mimeTypes).toContain('image/png');
      expect(mimeTypes).toContain('image/webp');
    });
  });

  describe('Unsupported File Format Rejection', () => {
    it('should reject BMP files', async () => {
      // Create a BMP file header
      const bmpBuffer = Buffer.from([
        0x42, 0x4D, 0x1E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1A, 0x00,
        0x00, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x18, 0x00, 0x00, 0x00, 0xFF, 0x00
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', bmpBuffer, 'test.bmp')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('validation_error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/unsupported file format.*image\/x-ms-bmp/i);
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details[0]).toMatch(/only jpeg, png, webp.*gif.*supported/i);
    });

    it('should reject TIFF files', async () => {
      // Create a TIFF file header
      const tiffBuffer = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01,
        0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', tiffBuffer, 'test.tiff')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format.*image\/tiff/i);
    });

    it('should reject text files with image extensions', async () => {
      const textBuffer = Buffer.from('This is just plain text, not an image');
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', textBuffer, 'fake-image.jpg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format.*text\/plain/i);
    });

    it('should reject PDF files', async () => {
      // Create a PDF file header
      const pdfBuffer = Buffer.from([
        0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC4, 0xE5,
        0xF2, 0xE5, 0xEB, 0xA7, 0xF3, 0xA0, 0xD0, 0xC4, 0xC6
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', pdfBuffer, 'document.pdf')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format.*application\/pdf/i);
    });

    it('should reject SVG files', async () => {
      const svgBuffer = Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <rect width="100" height="100" fill="red" />
        </svg>
      `);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', svgBuffer, 'test.svg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format.*image\/svg/i);
    });

    it('should reject all files in mixed upload when one is unsupported', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      const bmpBuffer = Buffer.from([0x42, 0x4D, 0x1E, 0x00, 0x00, 0x00]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'valid.jpg')
        .attach('images', bmpBuffer, 'invalid.bmp')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format/i);
    });
  });

  describe('File Extension vs MIME Type Validation', () => {
    it('should validate based on MIME type, not file extension', async () => {
      // JPEG content with PNG extension
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'misnamed.png')
        .expect(201);

      // Should be accepted as JPEG based on MIME type detection
      expect(response.body.images[0].mimeType).toBe('image/jpeg');
      expect(response.body.images[0].originalName).toBe('misnamed.png');
    });

    it('should reject files with correct extension but wrong MIME type', async () => {
      // Text content with image extension
      const textBuffer = Buffer.from('Not an image');
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', textBuffer, 'fake.jpg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format.*text\/plain/i);
    });

    it('should handle files with no extension but valid MIME type', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'noextension')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/jpeg');
      expect(response.body.images[0].originalName).toBe('noextension');
    });
  });

  describe('Error Messages and Response Format', () => {
    it('should provide detailed error information for unsupported formats', async () => {
      const bmpBuffer = Buffer.from([0x42, 0x4D, 0x1E, 0x00]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', bmpBuffer, 'test.bmp')
        .expect(400);

      // Verify error response structure
      expect(response.body).toEqual({
        error: 'validation_error',
        message: expect.stringMatching(/unsupported file format.*bmp/i),
        details: expect.arrayContaining([
          expect.stringMatching(/only jpeg, png, webp.*gif.*supported/i)
        ])
      });

      // Verify response headers
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should provide clear error message for multiple unsupported files', async () => {
      const bmpBuffer = Buffer.from([0x42, 0x4D]);
      const tiffBuffer = Buffer.from([0x49, 0x49, 0x2A, 0x00]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', bmpBuffer, 'file1.bmp')
        .attach('images', tiffBuffer, 'file2.tiff')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format/i);
      expect(response.body.details[0]).toMatch(/only jpeg, png, webp.*gif.*supported/i);
    });

    it('should maintain consistent error format across different unsupported types', async () => {
      const unsupportedFormats = [
        { buffer: Buffer.from([0x42, 0x4D]), filename: 'test.bmp' },
        { buffer: Buffer.from('plain text'), filename: 'test.txt' },
        { buffer: Buffer.from([0x25, 0x50, 0x44, 0x46]), filename: 'test.pdf' }
      ];

      for (const format of unsupportedFormats) {
        const response = await request(app)
          .post('/api/v1/images')
          .field('sessionId', sessionId)
          .attach('images', format.buffer, format.filename)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('details');
        expect(response.body.error).toBe('validation_error');
        expect(response.body.message).toMatch(/unsupported file format/i);
        expect(Array.isArray(response.body.details)).toBe(true);
      }
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle very small files with valid headers', async () => {
      // Minimal valid JPEG (just SOI and EOI markers)
      const minimalJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xD9]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', minimalJpeg, 'minimal.jpg')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/jpeg');
      expect(response.body.images[0].sizeBytes).toBe(4);
    });

    it('should handle files with mixed case extensions', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'TEST.JPG')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/jpeg');
      expect(response.body.images[0].originalName).toBe('TEST.JPG');
    });

    it('should handle files with special characters in names', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'test-图片_image (1).jpg')
        .expect(201);

      expect(response.body.images[0].mimeType).toBe('image/jpeg');
      expect(response.body.images[0].originalName).toBe('test-图片_image (1).jpg');
    });

    it('should reject files that might be malicious executables', async () => {
      // EXE file header
      const exeBuffer = Buffer.from([
        0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
        0xFF, 0xFF, 0x00, 0x00, 0xB8, 0x00, 0x00, 0x00
      ]);
      
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', exeBuffer, 'malicious.jpg')
        .expect(400);

      expect(response.body.error).toBe('validation_error');
      expect(response.body.message).toMatch(/unsupported file format.*application\/x-msdownload/i);
    });

    it('should handle corrupted image headers gracefully', async () => {
      // Corrupted JPEG header (missing proper markers)
      const corruptedBuffer = Buffer.from([0xFF, 0xD8, 0x00, 0x00, 0x00, 0x00]);
      
      // This should either be rejected or accepted based on MIME detection
      // The important thing is it doesn't crash the server
      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', corruptedBuffer, 'corrupted.jpg');

      // Should return either 200/201 (if accepted) or 400 (if rejected)
      expect([200, 201, 400]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
      } else {
        expect(response.body).toHaveProperty('images');
      }
    });
  });

  describe('Performance and Concurrent Uploads', () => {
    it('should validate multiple different formats efficiently', async () => {
      const startTime = Date.now();

      // Create buffers for all supported formats
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50]);
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'test1.jpg')
        .attach('images', pngBuffer, 'test2.png')
        .attach('images', webpBuffer, 'test3.webp')
        .attach('images', gifBuffer, 'test4.gif')
        .expect(201);

      const endTime = Date.now();
      const validationTime = endTime - startTime;

      expect(response.body.images.length).toBe(4);
      expect(validationTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should fail fast on unsupported format without processing others', async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xD9]);
      const bmpBuffer = Buffer.from([0x42, 0x4D, 0x1E, 0x00]); // Unsupported

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', jpegBuffer, 'valid.jpg')
        .attach('images', bmpBuffer, 'invalid.bmp')
        .expect(400);

      const endTime = Date.now();
      const failureTime = endTime - startTime;

      expect(response.body.error).toBe('validation_error');
      expect(failureTime).toBeLessThan(1000); // Should fail quickly
    });
  });
});