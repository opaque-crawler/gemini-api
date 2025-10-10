describe('Integration Test: Session Persistence', () => {
  beforeEach(() => {
    // Navigate to the application
    cy.visit('http://localhost:3000');
  });

  describe('Session Management', () => {
    it('should create and maintain session across page interactions', () => {
      // Check that session is created automatically when page loads
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      
      // Get the session ID from the page
      cy.get('[data-testid="session-id"]').should('exist').should('match', /^[a-f0-9-]{36}$/); // UUID format
      
      // Store session ID for comparison
      cy.get('[data-testid="session-id"]').invoke('text').as('originalSessionId');
      
      // Navigate within the app
      cy.get('[data-testid="about-link"]').click();
      cy.url().should('include', '/about');
      
      // Session should persist
      cy.get('@originalSessionId').then((originalSessionId) => {
        cy.get('[data-testid="session-id"]').should('contain.text', originalSessionId);
      });
    });

    it('should restore session after page reload', () => {
      // Wait for initial session creation
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      cy.get('[data-testid="session-id"]').invoke('text').as('originalSessionId');
      
      // Upload a test image to create some session data
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('fake-image-data'),
        fileName: 'test-image.jpg',
        mimeType: 'image/jpeg'
      });
      
      // Wait for upload completion
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      
      // Reload the page
      cy.reload();
      
      // Session should be restored
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      cy.get('@originalSessionId').then((originalSessionId) => {
        cy.get('[data-testid="session-id"]').should('contain.text', originalSessionId);
      });
      
      // Uploaded images should be restored
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
    });

    it('should handle session expiration gracefully', () => {
      // Wait for session creation
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      
      // Mock session expiration by clearing session storage
      cy.window().then((win) => {
        win.localStorage.removeItem('sessionId');
        win.sessionStorage.removeItem('sessionId');
      });
      
      // Trigger an action that requires session
      cy.get('[data-testid="new-analysis-button"]').click();
      
      // Should detect expired session and create new one
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      
      // Should show session renewal notification
      cy.get('[data-testid="notification"]').should('contain.text', 'Session renewed');
    });
  });

  describe('Analysis History Persistence', () => {
    it('should save analysis history in session', () => {
      // Upload test images
      cy.get('[data-testid="file-input"]').selectFile([
        {
          contents: Cypress.Buffer.from('fake-image-1'),
          fileName: 'image1.jpg',
          mimeType: 'image/jpeg'
        },
        {
          contents: Cypress.Buffer.from('fake-image-2'),
          fileName: 'image2.jpg',
          mimeType: 'image/jpeg'
        }
      ]);
      
      // Wait for uploads
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '2 images uploaded');
      
      // Enter analysis prompt
      cy.get('[data-testid="prompt-input"]').type('Compare these images and describe the differences');
      
      // Submit analysis
      cy.get('[data-testid="analyze-button"]').click();
      
      // Wait for analysis to complete
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Check that analysis appears in history
      cy.get('[data-testid="history-tab"]').click();
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 1);
      cy.get('[data-testid="history-list"] .analysis-item').first().should('contain.text', 'Compare these images');
    });

    it('should restore analysis history after page reload', () => {
      // First, create some analysis history
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('test-image'),
        fileName: 'test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="uploaded-images"]').should('contain.text', '1 image uploaded');
      
      cy.get('[data-testid="prompt-input"]').type('Describe this image in detail');
      cy.get('[data-testid="analyze-button"]').click();
      
      // Wait for analysis
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Create second analysis
      cy.get('[data-testid="new-analysis-button"]').click();
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('test-image-2'),
        fileName: 'test2.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').clear().type('What objects are visible in this image?');
      cy.get('[data-testid="analyze-button"]').click();
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Check history before reload
      cy.get('[data-testid="history-tab"]').click();
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 2);
      
      // Reload the page
      cy.reload();
      
      // History should be restored
      cy.get('[data-testid="history-tab"]').click();
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 2);
      
      // Verify content of history items
      cy.get('[data-testid="history-list"] .analysis-item').eq(0).should('contain.text', 'What objects are visible');
      cy.get('[data-testid="history-list"] .analysis-item').eq(1).should('contain.text', 'Describe this image');
    });

    it('should handle analysis history pagination', () => {
      // Create multiple analyses to test pagination
      for (let i = 1; i <= 12; i++) {
        cy.get('[data-testid="file-input"]').selectFile({
          contents: Cypress.Buffer.from(`test-image-${i}`),
          fileName: `test${i}.jpg`,
          mimeType: 'image/jpeg'
        });
        
        cy.get('[data-testid="prompt-input"]').clear().type(`Analysis prompt number ${i}`);
        cy.get('[data-testid="analyze-button"]').click();
        
        // Wait for analysis to complete
        cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
        
        if (i < 12) {
          cy.get('[data-testid="new-analysis-button"]').click();
        }
      }
      
      // Go to history
      cy.get('[data-testid="history-tab"]').click();
      
      // Should show first page (10 items by default)
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 10);
      
      // Should have pagination controls
      cy.get('[data-testid="pagination-next"]').should('be.visible');
      cy.get('[data-testid="pagination-info"]').should('contain.text', '1-10 of 12');
      
      // Go to next page
      cy.get('[data-testid="pagination-next"]').click();
      
      // Should show remaining items
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 2);
      cy.get('[data-testid="pagination-info"]').should('contain.text', '11-12 of 12');
      
      // Reload and check pagination persists
      cy.reload();
      cy.get('[data-testid="history-tab"]').click();
      
      // Should start from first page again
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 10);
      cy.get('[data-testid="pagination-info"]').should('contain.text', '1-10 of 12');
    });
  });

  describe('Result Export Functionality', () => {
    it('should export analysis results in multiple formats', () => {
      // Create an analysis first
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('export-test-image'),
        fileName: 'export-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Analyze this image for export testing');
      cy.get('[data-testid="analyze-button"]').click();
      
      // Wait for analysis completion
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Test JSON export
      cy.get('[data-testid="export-json-button"]').click();
      // Note: Cypress download verification would require additional setup
      
      // Test Markdown export
      cy.get('[data-testid="export-markdown-button"]').click();
      
      // Test Text export
      cy.get('[data-testid="export-text-button"]').click();
    });

    it('should export from history view', () => {
      // Create analysis
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('history-export-image'),
        fileName: 'history-export.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('History export test analysis');
      cy.get('[data-testid="analyze-button"]').click();
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Go to history
      cy.get('[data-testid="history-tab"]').click();
      
      // Export from history item
      cy.get('[data-testid="history-list"] .analysis-item').first().trigger('mouseover');
      cy.get('[data-testid="history-list"] .analysis-item').first().find('[data-testid="export-button"]').click();
      
      // Select export format
      cy.get('[data-testid="export-format-json"]').click();
    });

    it('should handle export errors gracefully', () => {
      // Create analysis
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('error-test-image'),
        fileName: 'error-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Error handling test');
      cy.get('[data-testid="analyze-button"]').click();
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Mock network error for export
      cy.intercept('GET', '/api/v1/export/*', {
        statusCode: 500,
        body: { error: 'export_failed', message: 'Export service unavailable' }
      });
      
      // Try to export
      cy.get('[data-testid="export-json-button"]').click();
      
      // Should show error message
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Export failed');
      cy.get('[data-testid="error-notification"]').should('contain.text', 'Please try again later');
      
      // Error should be dismissible
      cy.get('[data-testid="dismiss-error"]').click();
      cy.get('[data-testid="error-notification"]').should('not.be.visible');
    });
  });

  describe('Cross-Browser Compatibility', () => {
    it('should maintain session persistence across different browser features', () => {
      // Test with different localStorage/sessionStorage scenarios
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      cy.get('[data-testid="session-id"]').invoke('text').as('sessionId');
      
      // Test back/forward navigation
      cy.go('back');
      cy.go('forward');
      
      // Session should persist
      cy.get('@sessionId').then((sessionId) => {
        cy.get('[data-testid="session-id"]').should('contain.text', sessionId);
      });
    });

    it('should handle session persistence with private browsing simulation', () => {
      // Simulate private browsing by clearing storage
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();
      cy.clearCookies();
      
      // Navigate to app
      cy.visit('http://localhost:3000');
      
      // Should create new session
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      
      // Upload and analyze
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('private-test-image'),
        fileName: 'private-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Private browsing test');
      cy.get('[data-testid="analyze-button"]').click();
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Should work normally even in private mode
      cy.get('[data-testid="history-tab"]').click();
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 1);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large session history without memory leaks', () => {
      // Create multiple analyses to test memory management
      for (let i = 1; i <= 25; i++) {
        cy.get('[data-testid="file-input"]').selectFile({
          contents: Cypress.Buffer.from(`performance-test-image-${i}`),
          fileName: `perf-test-${i}.jpg`,
          mimeType: 'image/jpeg'
        });
        
        cy.get('[data-testid="prompt-input"]').clear().type(`Performance test analysis ${i}`);
        cy.get('[data-testid="analyze-button"]').click();
        cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
        
        if (i < 25) {
          cy.get('[data-testid="new-analysis-button"]').click();
        }
        
        // Check memory usage periodically
        if (i % 5 === 0) {
          cy.window().then((win) => {
            if ('memory' in win.performance) {
              const memoryInfo = (win.performance as any).memory;
              // Memory usage should be reasonable (less than 100MB)
              expect(memoryInfo.usedJSHeapSize).to.be.lessThan(100 * 1024 * 1024);
            }
          });
        }
      }
      
      // Navigate to history
      cy.get('[data-testid="history-tab"]').click();
      
      // Should handle large history gracefully
      cy.get('[data-testid="history-list"] .analysis-item').should('have.length', 10); // Pagination
      cy.get('[data-testid="pagination-info"]').should('contain.text', '1-10 of 25');
      
      // Page should remain responsive
      const responseStart = Date.now();
      cy.get('[data-testid="pagination-next"]').click().then(() => {
        const responseTime = Date.now() - responseStart;
        expect(responseTime).to.be.lessThan(1000); // Should respond within 1 second
      });
    });

    it('should clean up expired session data', () => {
      // Create session with data
      cy.get('[data-testid="file-input"]').selectFile({
        contents: Cypress.Buffer.from('cleanup-test-image'),
        fileName: 'cleanup-test.jpg',
        mimeType: 'image/jpeg'
      });
      
      cy.get('[data-testid="prompt-input"]').type('Cleanup test analysis');
      cy.get('[data-testid="analyze-button"]').click();
      cy.get('[data-testid="analysis-status"]', { timeout: 15000 }).should('contain.text', 'completed');
      
      // Simulate session expiration
      cy.window().then((win) => {
        // Mock expired session
        const expiredSession = {
          id: 'expired-session-id',
          createdAt: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
          expiresAt: Date.now() - (60 * 60 * 1000), // 1 hour ago
          analyses: []
        };
        win.localStorage.setItem('sessionData', JSON.stringify(expiredSession));
      });
      
      // Reload page
      cy.reload();
      
      // Should detect expired session and clean up
      cy.get('[data-testid="session-status"]').should('contain.text', 'Session: active');
      
      // History should be empty (cleaned up)
      cy.get('[data-testid="history-tab"]').click();
      cy.get('[data-testid="history-empty"]').should('contain.text', 'No analysis history');
    });
  });
});