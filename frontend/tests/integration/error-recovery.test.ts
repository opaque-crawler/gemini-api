describe('Integration Test: Error Recovery', () => {
  beforeEach(() => {
    // Navigate to the application
    cy.visit('http://localhost:3000');
  });

  describe('Network Error Recovery', () => {
    it('should handle network interruption during file upload', () => {
      // Mock network failure for upload
      cy.intercept('POST', '/api/v1/images', {
        forceNetworkError: true
      }).as('uploadNetworkError');
      
      // Try to upload a file
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('test-image-data'),
        fileName: 'network-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Should show network error
      cy.wait('@uploadNetworkError');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Network error');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Please check your connection');
      
      // Restore network and retry
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'test-image-id',
            filename: 'network-test.jpg',
            sizeBytes: 15,
            status: 'uploaded'
          }],
          totalSizeBytes: 15
        }
      }).as('uploadSuccess');
      
      cy.get('[data-testid="retry-upload-button"]').click();
      cy.wait('@uploadSuccess');
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
    });

    it('should handle network interruption during analysis', () => {
      // First upload an image successfully
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'analysis-test-id',
            filename: 'analysis-test.jpg',
            sizeBytes: 15,
            status: 'uploaded'
          }]
        }
      });
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('analysis-test-data'),
        fileName: 'analysis-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      
      // Mock network failure for analysis
      cy.intercept('POST', '/api/v1/analyze', {
        forceNetworkError: true
      }).as('analysisNetworkError');
      
      cy.get('[data-testid="prompt-input"]').type('Analyze this image with network error test');
      cy.get('[data-testid="analyze-button"]').click();
      
      // Should show network error
      cy.wait('@analysisNetworkError');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Analysis failed');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Network error occurred');
      
      // Restore network and retry
      cy.intercept('POST', '/api/v1/analyze', {
        statusCode: 202,
        body: {
          requestId: 'analysis-request-id',
          status: 'processing'
        }
      });
      
      cy.intercept('GET', '/api/v1/analyze/analysis-request-id', {
        statusCode: 200,
        body: {
          requestId: 'analysis-request-id',
          status: 'completed',
          result: {
            analysis: 'This is a test analysis result after network recovery.',
            confidence: 0.95
          }
        }
      });
      
      cy.get('[data-testid="retry-analysis-button"]').click();
      cy.get('[data-testid="analysis-status"]', { timeout: 10000 }).should('contain.text', 'completed');
    });

    it('should handle intermittent network connectivity', () => {
      // Simulate intermittent network issues
      let requestCount = 0;
      cy.intercept('POST', '/api/v1/session', (req) => {
        requestCount++;
        if (requestCount === 1) {
          req.reply({ forceNetworkError: true });
        } else {
          req.reply({
            statusCode: 201,
            body: { sessionId: 'recovered-session-id' }
          });
        }
      }).as('sessionRequest');
      
      // Reload page to trigger session creation
      cy.reload();
      
      // Should automatically retry and succeed
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      cy.get('[data-testid="session-id"]').should('contain.text', 'recovered-session-id');
    });
  });

  describe('API Error Recovery', () => {
    it('should handle 500 server errors gracefully', () => {
      // Mock server error
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 500,
        body: { error: 'internal_server_error', message: 'Server encountered an error' }
      }).as('serverError');
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('server-error-test'),
        fileName: 'server-error.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.wait('@serverError');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Server error');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Please try again later');
      
      // Show retry option
      cy.get('[data-testid="retry-button"]').should('be.visible');
      
      // Fix server and retry
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'recovered-image-id',
            filename: 'server-error.jpg',
            sizeBytes: 17,
            status: 'uploaded'
          }]
        }
      });
      
      cy.get('[data-testid="retry-button"]').click();
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
    });

    it('should handle validation errors with clear messaging', () => {
      // Mock validation error
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 400,
        body: {
          error: 'validation_error',
          message: 'File size exceeds maximum limit',
          details: ['File size: 6000000 bytes, limit: 5242880 bytes']
        }
      });
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('x'.repeat(6000000)),
        fileName: 'too-large.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Should show clear validation error
      cy.get('[data-testid="error-notification"]').should('contain.text', 'File size exceeds maximum limit');
      cy.get('[data-testid="error-details"]').should('contain.text', '6000000 bytes');
      
      // Should not show retry button for validation errors
      cy.get('[data-testid="retry-button"]').should('not.exist');
      
      // Should allow user to upload a different file
      cy.get('[data-testid="dismiss-error"]').click();
      cy.get('[data-testid="error-notification"]').should('not.be.visible');
    });

    it('should handle authentication errors', () => {
      // Mock auth error
      cy.intercept('POST', '/api/v1/analyze', {
        statusCode: 401,
        body: { error: 'unauthorized', message: 'Session expired' }
      });
      
      // Upload image first
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'auth-test-id',
            filename: 'auth-test.jpg',
            sizeBytes: 15,
            status: 'uploaded'
          }]
        }
      });
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('auth-test-data'),
        fileName: 'auth-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Test authentication error');
      cy.get('[data-testid="analyze-button"]').click();
      
      // Should show auth error and auto-refresh session
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Session expired');
      cy.get('[data-testid="notification"]').should('contain.text', 'Creating new session');
      
      // Should automatically retry with new session
      cy.intercept('POST', '/api/v1/analyze', {
        statusCode: 202,
        body: { requestId: 'new-session-analysis', status: 'processing' }
      });
      
      cy.get('[data-testid="analysis-status"]').should('contain.text', 'processing');
    });

    it('should handle rate limiting errors with backoff', () => {
      // Mock rate limit error
      cy.intercept('POST', '/api/v1/analyze', {
        statusCode: 429,
        body: {
          error: 'rate_limit_exceeded',
          message: 'Too many requests',
          retryAfter: 5
        }
      }).as('rateLimitError');
      
      // Upload image first
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'rate-limit-test-id',
            filename: 'rate-limit-test.jpg',
            sizeBytes: 15,
            status: 'uploaded'
          }]
        }
      });
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('rate-limit-test'),
        fileName: 'rate-limit-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Test rate limiting');
      cy.get('[data-testid="analyze-button"]').click();
      
      cy.wait('@rateLimitError');
      
      // Should show rate limit error with countdown
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Too many requests');
      cy.get('[data-testid="retry-countdown"]').should('contain.text', 'Retry in 5 seconds');
      
      // Should disable retry button during countdown
      cy.get('[data-testid="retry-button"]').should('be.disabled');
      
      // Mock successful retry after wait
      cy.intercept('POST', '/api/v1/analyze', {
        statusCode: 202,
        body: { requestId: 'rate-limit-recovery', status: 'processing' }
      });
      
      // Wait for countdown and auto-retry
      cy.get('[data-testid="retry-countdown"]', { timeout: 6000 }).should('not.be.visible');
      cy.get('[data-testid="analysis-status"]').should('contain.text', 'processing');
    });
  });

  describe('Client-Side Error Recovery', () => {
    it('should handle JavaScript errors gracefully', () => {
      // Inject error into window to simulate JS error
      cy.window().then((win) => {
        win.onerror = cy.stub().as('errorHandler');
      });
      
      // Trigger an action that might cause JS error
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('js-error-test'),
        fileName: 'js-error-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Application should continue to function
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      
      // Error should be logged but not break the app
      cy.get('[data-testid="app-container"]').should('be.visible');
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
    });

    it('should handle memory constraints gracefully', () => {
      // Try to upload multiple very large files to test memory handling
      const largeFileCount = 5;
      
      for (let i = 0; i < largeFileCount; i++) {
        cy.get('[data-testid="file-input"]').selectFile({
          contents: Cypress.Buffer.alloc(1024 * 1024), // 1MB each
          fileName: `large-file-${i}.jpg`,
          mimeType: 'image/jpeg'
        });
        
        // Should either succeed or show appropriate error
        cy.get('body').then(($body) => {
          if ($body.find('[data-testid="error-notification"]').length > 0) {
            // Memory error occurred - this is acceptable
            cy.get('[data-testid="error-notification"]').should('contain.text', 'memory');
          } else {
            // Upload succeeded
            cy.get('[data-testid="uploaded-images"]').should('contain.text', `${i + 1} image`);
          }
        });
      }
      
      // Application should remain responsive
      cy.get('[data-testid="app-container"]').should('be.visible');
    });

    it('should handle localStorage quota exceeded', () => {
      // Fill localStorage to trigger quota exceeded
      cy.window().then((win) => {
        try {
          // Try to fill localStorage
          const bigData = 'x'.repeat(1024 * 1024); // 1MB string
          for (let i = 0; i < 10; i++) {
            win.localStorage.setItem(`bigData${i}`, bigData);
          }
        } catch (e) {
          // Quota exceeded - this is what we want to test
        }
      });
      
      // Try to save session data
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('localStorage-test'),
        fileName: 'localStorage-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Should handle gracefully, possibly with warning
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="warning-notification"]').length > 0) {
          cy.get('[data-testid="warning-notification"]').should('contain.text', 'storage');
        }
      });
      
      // App should continue to work
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
    });
  });

  describe('Retry Mechanisms', () => {
    it('should implement exponential backoff for retries', () => {
      let attemptCount = 0;
      const timestamps: number[] = [];
      
      cy.intercept('POST', '/api/v1/images', (req) => {
        timestamps.push(Date.now());
        attemptCount++;
        
        if (attemptCount <= 3) {
          req.reply({ statusCode: 500, body: { error: 'temporary_error' } });
        } else {
          req.reply({
            statusCode: 201,
            body: {
              images: [{
                id: 'backoff-test-id',
                filename: 'backoff-test.jpg',
                sizeBytes: 15,
                status: 'uploaded'
              }]
            }
          });
        }
      }).as('backoffTest');
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('backoff-test'),
        fileName: 'backoff-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Should eventually succeed
      cy.get('[data-testid="uploaded-images"]', { timeout: 30000 }).should('contain.text', '1 image uploaded');
      
      // Verify exponential backoff timing (approximately)
      cy.then(() => {
        expect(timestamps).to.have.length.at.least(4);
        if (timestamps.length >= 3) {
          const delay1 = timestamps[1] - timestamps[0];
          const delay2 = timestamps[2] - timestamps[1];
          // Second delay should be longer than first (exponential backoff)
          expect(delay2).to.be.greaterThan(delay1);
        }
      });
    });

    it('should limit maximum retry attempts', () => {
      let attemptCount = 0;
      
      cy.intercept('POST', '/api/v1/analyze', (req) => {
        attemptCount++;
        req.reply({ statusCode: 500, body: { error: 'persistent_error' } });
      }).as('persistentError');
      
      // Upload image first
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'retry-limit-test',
            filename: 'retry-limit.jpg',
            sizeBytes: 15,
            status: 'uploaded'
          }]
        }
      });
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('retry-limit-test'),
        fileName: 'retry-limit.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Test retry limits');
      cy.get('[data-testid="analyze-button"]').click();
      
      // Should eventually give up and show permanent error
      cy.get('[data-testid="error-notification"]', { timeout: 30000 }).should('contain.text', 'Unable to complete');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Please try again later');
      
      // Should have made maximum attempts (e.g., 5)
      cy.then(() => {
        expect(attemptCount).to.be.at.most(5);
      });
    });

    it('should provide manual retry option for failed operations', () => {
      // Mock failure
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 503,
        body: { error: 'service_unavailable', message: 'Service temporarily unavailable' }
      }).as('serviceUnavailable');
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('manual-retry-test'),
        fileName: 'manual-retry.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.wait('@serviceUnavailable');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Service temporarily unavailable');
      cy.get('[data-testid="manual-retry-button"]').should('be.visible');
      
      // Fix service
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'manual-retry-success',
            filename: 'manual-retry.jpg',
            sizeBytes: 18,
            status: 'uploaded'
          }]
        }
      });
      
      // Manual retry should work
      cy.get('[data-testid="manual-retry-button"]').click();
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
    });
  });

  describe('User Experience During Errors', () => {
    it('should maintain application state during errors', () => {
      // Set up initial state
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('state-test-1'),
        fileName: 'state-test-1.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      cy.get('[data-testid="prompt-input"]').type('Initial prompt text');
      
      // Trigger error in unrelated operation
      cy.intercept('GET', '/api/v1/health', {
        statusCode: 500,
        body: { error: 'health_check_failed' }
      });
      
      // Trigger health check
      cy.request({ url: 'http://localhost:3001/api/v1/health', failOnStatusCode: false });
      
      // Application state should be preserved
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      cy.get('[data-testid="prompt-input"]').should('have.value', 'Initial prompt text');
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
    });

    it('should provide clear progress indication during recovery', () => {
      // Mock slow recovery
      cy.intercept('POST', '/api/v1/images', (req) => {
        // Delay response to simulate slow recovery
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(req.reply({
              statusCode: 201,
              body: {
                images: [{
                  id: 'slow-recovery-test',
                  filename: 'slow-recovery.jpg',
                  sizeBytes: 15,
                  status: 'uploaded'
                }]
              }
            }));
          }, 3000);
        });
      }).as('slowRecovery');
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('slow-recovery-test'),
        fileName: 'slow-recovery.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Should show progress indicators
      cy.get('[data-testid="upload-progress"]').should('be.visible');
      cy.get('[data-testid="upload-status"]').should('contain.text', 'Uploading');
      
      cy.wait('@slowRecovery');
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      cy.get('[data-testid="upload-progress"]').should('not.be.visible');
    });

    it('should allow cancellation of failed operations', () => {
      // Mock long-running failed operation
      cy.intercept('POST', '/api/v1/analyze', (req) => {
        // Never resolve to simulate stuck operation
        return new Promise(() => {});
      }).as('stuckOperation');
      
      // Upload image first
      cy.intercept('POST', '/api/v1/images', {
        statusCode: 201,
        body: {
          images: [{
            id: 'cancel-test-id',
            filename: 'cancel-test.jpg',
            sizeBytes: 15,
            status: 'uploaded'
          }]
        }
      });
      
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('cancel-test'),
        fileName: 'cancel-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Test cancellation');
      cy.get('[data-testid="analyze-button"]').click();
      
      // Should show cancel option for long-running operation
      cy.get('[data-testid="cancel-button"]', { timeout: 5000 }).should('be.visible');
      cy.get('[data-testid="cancel-button"]').click();
      
      // Should return to ready state
      cy.get('[data-testid="analysis-status"]').should('contain.text', 'cancelled');
      cy.get('[data-testid="analyze-button"]').should('be.enabled');
    });
  });
});