import request from 'supertest';
import app from '../../src/app';

describe('Integration Test: Basic Multi-Image Analysis', () => {
  let sessionId: string;
  let imageIds: string[];
  let requestId: string;

  beforeEach(async () => {
    // Create a session for testing
    const sessionResponse = await request(app)
      .post('/api/v1/session')
      .expect(201);
    
    sessionId = sessionResponse.body.sessionId;
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
  });

  describe('Complete Multi-Image Analysis Workflow', () => {
    it('should successfully complete the entire workflow from image upload to analysis results', async () => {
      // Step 1: Upload multiple test images
      const imageUploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data-1'), 'test-image-1.png')
        .attach('images', Buffer.from('fake-image-data-2'), 'test-image-2.jpg')
        .attach('images', Buffer.from('fake-image-data-3'), 'test-image-3.webp')
        .expect(201);

      // Validate image upload response
      expect(imageUploadResponse.body).toHaveProperty('images');
      expect(Array.isArray(imageUploadResponse.body.images)).toBe(true);
      expect(imageUploadResponse.body.images.length).toBe(3);
      
      imageIds = imageUploadResponse.body.images.map((img: any) => img.id);
      expect(imageIds).toHaveLength(3);
      
      // Validate each uploaded image
      imageIds.forEach((imageId, index) => {
        expect(typeof imageId).toBe('string');
        expect(imageId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        
        const image = imageUploadResponse.body.images[index];
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('originalName');
        expect(image).toHaveProperty('sizeBytes');
        expect(image).toHaveProperty('mimeType');
        expect(image).toHaveProperty('dimensions');
      });

      // Step 2: Submit analysis request with multiple images
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds, // All three images
        prompt: 'Analyze these images and describe what you see in each one. Compare and contrast the visual elements across all images.'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          if (res.status !== 200 && res.status !== 202) {
            throw new Error(`Expected 200 or 202, got ${res.status}`);
          }
        });

      // Validate analysis response
      expect(analysisResponse.body).toHaveProperty('requestId');
      expect(typeof analysisResponse.body.requestId).toBe('string');
      expect(analysisResponse.body.requestId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      
      requestId = analysisResponse.body.requestId;

      if (analysisResponse.status === 202) {
        // If processing asynchronously, validate status response
        expect(analysisResponse.body).toHaveProperty('status');
        expect(['pending', 'processing']).toContain(analysisResponse.body.status);
        expect(analysisResponse.body).toHaveProperty('estimatedCompletionTime');
        expect(analysisResponse.body).toHaveProperty('progressPercent');
      }

      // Step 3: Poll for analysis completion (with timeout)
      let analysisResult: any;
      let attempts = 0;
      const maxAttempts = 20; // 20 seconds timeout
      
      do {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
        
        const statusResponse = await request(app)
          .get(`/api/v1/analyze/${requestId}`)
          .expect((res) => {
            if (res.status !== 200 && res.status !== 202) {
              throw new Error(`Expected 200 or 202, got ${res.status}`);
            }
          });

        if (statusResponse.status === 200) {
          analysisResult = statusResponse.body;
          break;
        } else if (statusResponse.status === 202) {
          // Still processing
          expect(statusResponse.body).toHaveProperty('requestId');
          expect(statusResponse.body).toHaveProperty('status');
          expect(['pending', 'processing']).toContain(statusResponse.body.status);
        }
      } while (attempts < maxAttempts);

      // Validate final analysis result
      expect(analysisResult).toBeDefined();
      expect(analysisResult).toHaveProperty('id');
      expect(analysisResult).toHaveProperty('requestId');
      expect(analysisResult).toHaveProperty('status');
      expect(analysisResult).toHaveProperty('content');
      expect(analysisResult).toHaveProperty('format');
      
      expect(typeof analysisResult.id).toBe('string');
      expect(analysisResult.requestId).toBe(requestId);
      expect(['completed', 'partial']).toContain(analysisResult.status);
      expect(typeof analysisResult.content).toBe('string');
      expect(analysisResult.content.length).toBeGreaterThan(0);
      expect(['markdown', 'plaintext']).toContain(analysisResult.format);

      // Step 4: Verify session history includes the analysis
      const historyResponse = await request(app)
        .get(`/api/v1/session/${sessionId}/history`)
        .expect(200);

      expect(historyResponse.body).toHaveProperty('sessionId');
      expect(historyResponse.body).toHaveProperty('analyses');
      expect(historyResponse.body).toHaveProperty('totalCount');
      expect(historyResponse.body).toHaveProperty('hasMore');
      
      expect(historyResponse.body.sessionId).toBe(sessionId);
      expect(historyResponse.body.totalCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(historyResponse.body.analyses)).toBe(true);
      expect(historyResponse.body.analyses.length).toBeGreaterThanOrEqual(1);
      
      // Find our analysis in the history
      const ourAnalysis = historyResponse.body.analyses.find(
        (analysis: any) => analysis.requestId === requestId
      );
      expect(ourAnalysis).toBeDefined();
      expect(ourAnalysis.status).toBe(analysisResult.status);

      // Step 5: Test export functionality for all formats
      const exportFormats = ['json', 'markdown', 'txt'];
      
      for (const format of exportFormats) {
        const exportResponse = await request(app)
          .get(`/api/v1/export/${requestId}?format=${format}`)
          .expect(200);

        if (format === 'json') {
          expect(exportResponse.headers['content-type']).toMatch(/application\/json/);
          expect(exportResponse.body).toHaveProperty('requestId');
          expect(exportResponse.body.requestId).toBe(requestId);
        } else if (format === 'markdown') {
          expect(exportResponse.headers['content-type']).toMatch(/text\/markdown/);
          expect(exportResponse.headers['content-disposition']).toMatch(/attachment/);
          expect(exportResponse.headers['content-disposition']).toMatch(/\.md/);
          expect(typeof exportResponse.text).toBe('string');
          expect(exportResponse.text.length).toBeGreaterThan(0);
        } else if (format === 'txt') {
          expect(exportResponse.headers['content-type']).toMatch(/text\/plain/);
          expect(exportResponse.headers['content-disposition']).toMatch(/attachment/);
          expect(exportResponse.headers['content-disposition']).toMatch(/\.txt/);
          expect(typeof exportResponse.text).toBe('string');
          expect(exportResponse.text.length).toBeGreaterThan(0);
        }
      }
    }, 30000); // 30 second timeout for the entire workflow

    it('should handle analysis of different image formats (PNG, JPEG, WebP)', async () => {
      // Upload images with different formats
      const imageUploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-png-data'), 'test.png')
        .attach('images', Buffer.from('fake-jpeg-data'), 'test.jpeg')
        .attach('images', Buffer.from('fake-webp-data'), 'test.webp')
        .expect(201);

      imageIds = imageUploadResponse.body.images.map((img: any) => img.id);
      
      // Verify different MIME types are handled
      const images = imageUploadResponse.body.images;
      expect(images[0].mimeType).toBe('image/png');
      expect(images[1].mimeType).toBe('image/jpeg');
      expect(images[2].mimeType).toBe('image/webp');

      // Submit analysis request
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds,
        prompt: 'Analyze the format and characteristics of these different image types.'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      expect(analysisResponse.body).toHaveProperty('requestId');
      requestId = analysisResponse.body.requestId;
      
      // The analysis should be accepted regardless of image format diversity
      expect(typeof requestId).toBe('string');
    });

    it('should handle large prompts with multi-image analysis', async () => {
      // Upload test images
      const imageUploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data-1'), 'image1.png')
        .attach('images', Buffer.from('fake-image-data-2'), 'image2.png')
        .expect(201);

      imageIds = imageUploadResponse.body.images.map((img: any) => img.id);

      // Create a comprehensive prompt (close to 2000 character limit)
      const largePrompt = `
        Please provide a detailed analysis of these images. I want you to examine:
        
        1. Visual composition - analyze the arrangement of elements, use of space, balance, and focal points
        2. Color palette - describe the dominant colors, color harmony, temperature, and emotional impact
        3. Lighting conditions - assess the direction, quality, and mood created by the lighting
        4. Subject matter - identify and describe all visible objects, people, or scenes
        5. Technical quality - evaluate sharpness, exposure, contrast, and overall image quality
        6. Artistic style - determine if there are any particular artistic movements or styles represented
        7. Contextual information - infer the setting, time period, or circumstances of the image
        8. Comparative analysis - how do these images relate to each other thematically or visually
        9. Emotional impact - what feelings or moods do these images evoke
        10. Potential use cases - suggest appropriate contexts where these images might be effectively used
        
        Please be thorough and provide specific details for each image while also drawing connections between them.
        Focus on both individual characteristics and collective themes that emerge from viewing them together.
      `.trim();

      expect(largePrompt.length).toBeLessThan(2000); // Ensure we're within limits
      expect(largePrompt.length).toBeGreaterThan(1000); // Ensure it's substantial

      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds,
        prompt: largePrompt
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      expect(analysisResponse.body).toHaveProperty('requestId');
      requestId = analysisResponse.body.requestId;
      
      // Should handle large prompts successfully
      expect(typeof requestId).toBe('string');
    });

    it('should maintain session state across multiple analysis requests', async () => {
      // First analysis
      const imageUploadResponse1 = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data-1'), 'first.png')
        .expect(201);

      const imageIds1 = imageUploadResponse1.body.images.map((img: any) => img.id);

      const analysisResponse1 = await request(app)
        .post('/api/v1/analyze')
        .send({
          sessionId: sessionId,
          imageIds: imageIds1,
          prompt: 'First analysis request'
        })
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      const requestId1 = analysisResponse1.body.requestId;

      // Second analysis (same session)
      const imageUploadResponse2 = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data-2'), 'second.png')
        .expect(201);

      const imageIds2 = imageUploadResponse2.body.images.map((img: any) => img.id);

      const analysisResponse2 = await request(app)
        .post('/api/v1/analyze')
        .send({
          sessionId: sessionId,
          imageIds: imageIds2,
          prompt: 'Second analysis request'
        })
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      const requestId2 = analysisResponse2.body.requestId;

      // Verify both requests are different
      expect(requestId1).not.toBe(requestId2);

      // Check session history contains both
      const historyResponse = await request(app)
        .get(`/api/v1/session/${sessionId}/history`)
        .expect(200);

      expect(historyResponse.body.totalCount).toBeGreaterThanOrEqual(2);
      
      const requestIds = historyResponse.body.analyses.map((analysis: any) => analysis.requestId);
      expect(requestIds).toContain(requestId1);
      expect(requestIds).toContain(requestId2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      // Upload test images for error scenarios
      const imageUploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data'), 'test.png')
        .expect(201);

      imageIds = imageUploadResponse.body.images.map((img: any) => img.id);
    });

    it('should handle analysis timeout gracefully', async () => {
      // This test verifies the system handles long-running analysis
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds,
        prompt: 'Perform a very detailed analysis that might take some time to complete.'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      requestId = analysisResponse.body.requestId;

      // Even if analysis takes time, the initial response should be valid
      expect(typeof requestId).toBe('string');
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should handle invalid image references in analysis request', async () => {
      const fakeImageId = '550e8400-e29b-41d4-a716-446655440000';
      
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: [fakeImageId], // Non-existent image ID
        prompt: 'Analyze this non-existent image'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect(400);

      expect(analysisResponse.body).toHaveProperty('error');
      expect(analysisResponse.body).toHaveProperty('message');
      expect(analysisResponse.body.message).toMatch(/image.*not found|invalid.*image/i);
    });

    it('should handle mixed valid and invalid image references', async () => {
      const fakeImageId = '550e8400-e29b-41d4-a716-446655440001';
      const mixedImageIds = [imageIds[0], fakeImageId]; // One valid, one invalid
      
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: mixedImageIds,
        prompt: 'Analyze these mixed images'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect(400);

      expect(analysisResponse.body).toHaveProperty('error');
      expect(analysisResponse.body).toHaveProperty('message');
      expect(analysisResponse.body.message).toMatch(/image.*not found|invalid.*image/i);
    });

    it('should handle session cleanup after workflow completion', async () => {
      // Complete a full workflow
      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds,
        prompt: 'Quick analysis for cleanup test'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      requestId = analysisResponse.body.requestId;

      // Session should still be valid and accessible
      const historyResponse = await request(app)
        .get(`/api/v1/session/${sessionId}/history`)
        .expect(200);

      expect(historyResponse.body.sessionId).toBe(sessionId);
      expect(historyResponse.body.totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle maximum allowed images (5 images) efficiently', async () => {
      const startTime = Date.now();

      // Upload maximum allowed images
      const imageUploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data-1'), 'image1.png')
        .attach('images', Buffer.from('fake-image-data-2'), 'image2.png')
        .attach('images', Buffer.from('fake-image-data-3'), 'image3.png')
        .attach('images', Buffer.from('fake-image-data-4'), 'image4.png')
        .attach('images', Buffer.from('fake-image-data-5'), 'image5.png')
        .expect(201);

      const uploadTime = Date.now() - startTime;
      expect(uploadTime).toBeLessThan(3000); // Upload should complete within 3 seconds

      imageIds = imageUploadResponse.body.images.map((img: any) => img.id);
      expect(imageIds).toHaveLength(5);

      const analysisStartTime = Date.now();

      const analysisRequest = {
        sessionId: sessionId,
        imageIds: imageIds,
        prompt: 'Analyze all five images and provide comprehensive comparison across all of them.'
      };

      const analysisResponse = await request(app)
        .post('/api/v1/analyze')
        .send(analysisRequest)
        .expect((res) => {
          expect([200, 202]).toContain(res.status);
        });

      const analysisRequestTime = Date.now() - analysisStartTime;
      expect(analysisRequestTime).toBeLessThan(1000); // Request acceptance should be fast

      requestId = analysisResponse.body.requestId;
      expect(typeof requestId).toBe('string');
    });

    it('should maintain performance with concurrent session operations', async () => {
      // Create multiple operations on the same session
      const operations = [];

      // Upload images
      const imageUploadResponse = await request(app)
        .post('/api/v1/images')
        .field('sessionId', sessionId)
        .attach('images', Buffer.from('fake-image-data-1'), 'concurrent1.png')
        .attach('images', Buffer.from('fake-image-data-2'), 'concurrent2.png')
        .expect(201);

      imageIds = imageUploadResponse.body.images.map((img: any) => img.id);

      // Start analysis
      operations.push(
        request(app)
          .post('/api/v1/analyze')
          .send({
            sessionId: sessionId,
            imageIds: [imageIds[0]],
            prompt: 'First concurrent analysis'
          })
      );

      // Check session history while analysis might be running
      operations.push(
        request(app)
          .get(`/api/v1/session/${sessionId}/history`)
      );

      // Start another analysis
      operations.push(
        request(app)
          .post('/api/v1/analyze')
          .send({
            sessionId: sessionId,
            imageIds: [imageIds[1]],
            prompt: 'Second concurrent analysis'
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      // All operations should complete reasonably quickly
      expect(totalTime).toBeLessThan(5000); // 5 seconds for all concurrent operations

      // Verify all operations succeeded
      expect([200, 202]).toContain(results[0]?.status); // First analysis
      expect(results[1]?.status).toBe(200); // History check
      expect([200, 202]).toContain(results[2]?.status); // Second analysis
    });
  });
});