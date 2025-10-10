/// <reference types="cypress" />

describe('Integration Test: Comparative Analysis UI Workflow', () => {
  beforeEach(() => {
    // Visit the main page
    cy.visit('http://localhost:3000');
    
    // Wait for the application to load
    cy.get('[data-testid="app-container"]', { timeout: 10000 }).should('be.visible');
  });

  describe('Multi-Image Upload and Comparative Analysis', () => {
    it('should allow users to upload multiple images and perform comparative analysis', () => {
      // Step 1: Upload multiple images for comparison
      const testImages = [
        'cypress/fixtures/test-image-1.jpg',
        'cypress/fixtures/test-image-2.png',
        'cypress/fixtures/test-image-3.webp'
      ];

      // Check if image upload component is present
      cy.get('[data-testid="image-upload-area"]').should('be.visible');
      
      // Upload multiple images
      testImages.forEach((imagePath, index) => {
        cy.get('[data-testid="file-input"]').selectFile(imagePath, { force: true });
        
        // Verify image preview appears
        cy.get(`[data-testid="image-preview-${index}"]`, { timeout: 5000 })
          .should('be.visible')
          .should('contain.text', `test-image-${index + 1}`);
      });

      // Verify all images are uploaded
      cy.get('[data-testid="uploaded-images-list"]')
        .should('be.visible')
        .children()
        .should('have.length', 3);

      // Step 2: Enter comparative analysis prompt
      const comparativePrompt = 'Compare and contrast these three images. Identify similarities and differences in composition, color palette, subject matter, and visual style. Provide detailed analysis for each image and explain how they relate to each other.';
      
      cy.get('[data-testid="prompt-input"]')
        .should('be.visible')
        .clear()
        .type(comparativePrompt);

      // Verify character count is displayed
      cy.get('[data-testid="character-count"]')
        .should('be.visible')
        .should('contain.text', `${comparativePrompt.length}/2000`);

      // Step 3: Submit analysis request
      cy.get('[data-testid="analyze-button"]')
        .should('be.visible')
        .and('not.be.disabled')
        .click();

      // Verify loading state is shown
      cy.get('[data-testid="loading-spinner"]', { timeout: 1000 })
        .should('be.visible');

      // Verify loading message
      cy.get('[data-testid="loading-message"]')
        .should('be.visible')
        .should('contain.text', 'Analyzing images...');

      // Step 4: Wait for analysis results
      cy.get('[data-testid="analysis-results"]', { timeout: 15000 })
        .should('be.visible');

      // Verify results contain comparative analysis
      cy.get('[data-testid="analysis-content"]')
        .should('be.visible')
        .should('contain.text', 'comparison')
        .or('contain.text', 'similarities')
        .or('contain.text', 'differences');

      // Step 5: Verify export options are available
      cy.get('[data-testid="export-options"]')
        .should('be.visible');

      // Test different export formats
      const exportFormats = ['JSON', 'Markdown', 'Plain Text'];
      exportFormats.forEach(format => {
        cy.get(`[data-testid="export-${format.toLowerCase().replace(' ', '-')}"]`)
          .should('be.visible')
          .and('contain.text', format);
      });

      // Step 6: Test export functionality
      cy.get('[data-testid="export-markdown"]').click();
      
      // Verify download initiated (check for download success or notification)
      cy.get('[data-testid="export-success-notification"]', { timeout: 5000 })
        .should('be.visible')
        .should('contain.text', 'Export completed');
    });

    it('should handle image comparison with different formats and sizes', () => {
      // Upload images with different formats
      const mixedFormatImages = [
        'cypress/fixtures/large-image.jpg',    // Large JPEG
        'cypress/fixtures/small-image.png',    // Small PNG
        'cypress/fixtures/medium-image.webp'   // Medium WebP
      ];

      mixedFormatImages.forEach((imagePath, index) => {
        cy.get('[data-testid="file-input"]').selectFile(imagePath, { force: true });
        
        // Verify each image is processed correctly regardless of format/size
        cy.get(`[data-testid="image-preview-${index}"]`, { timeout: 5000 })
          .should('be.visible');
          
        // Check if file format is displayed
        cy.get(`[data-testid="image-info-${index}"]`)
          .should('be.visible')
          .should('contain.text', 'Format:');
      });

      // Enter format-specific comparative prompt
      const formatPrompt = 'Analyze the technical aspects of these images including file formats, quality, and visual characteristics. Compare how different formats affect the image presentation.';
      
      cy.get('[data-testid="prompt-input"]')
        .clear()
        .type(formatPrompt);

      cy.get('[data-testid="analyze-button"]').click();

      // Verify analysis handles mixed formats correctly
      cy.get('[data-testid="analysis-results"]', { timeout: 15000 })
        .should('be.visible');

      cy.get('[data-testid="analysis-content"]')
        .should('contain.text', 'format')
        .or('contain.text', 'quality')
        .or('contain.text', 'technical');
    });

    it('should support iterative comparative analysis refinement', () => {
      // Initial upload and analysis
      cy.get('[data-testid="file-input"]').selectFile([
        'cypress/fixtures/test-image-1.jpg',
        'cypress/fixtures/test-image-2.png'
      ], { force: true });

      const initialPrompt = 'Provide a basic comparison of these two images.';
      cy.get('[data-testid="prompt-input"]').type(initialPrompt);
      cy.get('[data-testid="analyze-button"]').click();

      // Wait for initial results
      cy.get('[data-testid="analysis-results"]', { timeout: 15000 })
        .should('be.visible');

      // Refine the analysis with more specific prompt
      const refinedPrompt = 'Focus specifically on the color composition and lighting differences between these images. Provide detailed technical analysis.';
      
      cy.get('[data-testid="prompt-input"]')
        .clear()
        .type(refinedPrompt);

      cy.get('[data-testid="analyze-button"]').click();

      // Verify refined analysis
      cy.get('[data-testid="analysis-results"]', { timeout: 15000 })
        .should('be.visible');

      // Check if results are more detailed/specific
      cy.get('[data-testid="analysis-content"]')
        .should('contain.text', 'color')
        .or('contain.text', 'lighting')
        .or('contain.text', 'technical');

      // Verify history shows both analyses
      cy.get('[data-testid="analysis-history"]')
        .should('be.visible')
        .children()
        .should('have.length.at.least', 2);
    });
  });

  describe('User Experience and Validation', () => {
    it('should provide real-time validation feedback during image upload', () => {
      // Test file size validation
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/oversized-image.jpg', { force: true });
      
      // Verify size validation message
      cy.get('[data-testid="upload-error"]', { timeout: 3000 })
        .should('be.visible')
        .should('contain.text', 'exceeds maximum size');

      // Test unsupported format
      cy.get('[data-testid="file-input"]').selectFile('cypress/fixtures/unsupported.bmp', { force: true });
      
      // Verify format validation message
      cy.get('[data-testid="upload-error"]', { timeout: 3000 })
        .should('be.visible')
        .should('contain.text', 'unsupported format');

      // Test maximum image count
      const maxImages = Array.from({ length: 6 }, (_, i) => `cypress/fixtures/test-image-${i + 1}.jpg`);
      
      cy.get('[data-testid="file-input"]').selectFile(maxImages, { force: true });
      
      // Verify max count validation
      cy.get('[data-testid="upload-error"]', { timeout: 3000 })
        .should('be.visible')
        .should('contain.text', 'maximum of 5 images');
    });

    it('should provide prompt validation and suggestions', () => {
      // Upload test images first
      cy.get('[data-testid="file-input"]').selectFile([
        'cypress/fixtures/test-image-1.jpg',
        'cypress/fixtures/test-image-2.png'
      ], { force: true });

      // Test empty prompt validation
      cy.get('[data-testid="analyze-button"]').click();
      
      cy.get('[data-testid="prompt-error"]')
        .should('be.visible')
        .should('contain.text', 'prompt is required');

      // Test prompt length validation
      const longPrompt = 'A'.repeat(2001);
      cy.get('[data-testid="prompt-input"]').type(longPrompt);
      
      cy.get('[data-testid="character-count"]')
        .should('contain.text', '2001/2000')
        .and('have.class', 'error');

      cy.get('[data-testid="prompt-error"]')
        .should('be.visible')
        .should('contain.text', 'exceeds maximum length');

      // Test prompt suggestions for comparative analysis
      cy.get('[data-testid="prompt-input"]').clear();
      
      cy.get('[data-testid="suggestion-comparative"]')
        .should('be.visible')
        .click();

      cy.get('[data-testid="prompt-input"]')
        .should('contain.value', 'Compare and contrast');
    });

    it('should handle network errors gracefully', () => {
      // Upload test images
      cy.get('[data-testid="file-input"]').selectFile([
        'cypress/fixtures/test-image-1.jpg',
        'cypress/fixtures/test-image-2.png'
      ], { force: true });

      cy.get('[data-testid="prompt-input"]').type('Test analysis for error handling');

      // Mock network failure
      cy.intercept('POST', '/api/v1/analyze', { forceNetworkError: true }).as('networkError');

      cy.get('[data-testid="analyze-button"]').click();

      // Verify error handling
      cy.get('[data-testid="error-message"]', { timeout: 10000 })
        .should('be.visible')
        .should('contain.text', 'network error');

      // Verify retry option is available
      cy.get('[data-testid="retry-button"]')
        .should('be.visible')
        .should('contain.text', 'Retry');

      // Test retry functionality
      cy.intercept('POST', '/api/v1/analyze', { fixture: 'analysis-response.json' }).as('retrySuccess');
      
      cy.get('[data-testid="retry-button"]').click();

      cy.get('[data-testid="analysis-results"]', { timeout: 15000 })
        .should('be.visible');
    });
  });

  describe('Accessibility and Responsive Design', () => {
    it('should be fully accessible with keyboard navigation', () => {
      // Test keyboard navigation through upload interface
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'file-input');

      // Navigate to prompt input with keyboard
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'prompt-input');

      // Navigate to analyze button
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-testid', 'analyze-button');

      // Test Enter key activation
      cy.focused().type('{enter}');
      
      // Should show validation error (no files uploaded)
      cy.get('[data-testid="upload-error"]')
        .should('be.visible');
    });

    it('should work correctly on mobile viewport', () => {
      cy.viewport('iphone-x');

      // Verify mobile-responsive layout
      cy.get('[data-testid="image-upload-area"]')
        .should('be.visible')
        .should('have.css', 'width')
        .and('match', /^(100%|[0-9]+px)$/);

      // Test mobile file upload (typically uses camera/gallery picker)
      cy.get('[data-testid="mobile-upload-button"]')
        .should('be.visible')
        .click();

      // Verify mobile-optimized interface elements
      cy.get('[data-testid="prompt-input"]')
        .should('be.visible')
        .should('have.attr', 'placeholder')
        .and('contain', 'comparison');

      // Test mobile export options
      cy.get('[data-testid="mobile-export-menu"]')
        .should('be.visible');
    });

    it('should provide proper ARIA labels and screen reader support', () => {
      // Check upload area accessibility
      cy.get('[data-testid="image-upload-area"]')
        .should('have.attr', 'aria-label')
        .and('contain', 'upload');

      // Check prompt input accessibility
      cy.get('[data-testid="prompt-input"]')
        .should('have.attr', 'aria-describedby')
        .should('have.attr', 'aria-label');

      // Check button accessibility
      cy.get('[data-testid="analyze-button"]')
        .should('have.attr', 'aria-label')
        .and('contain', 'analyze');

      // Check results accessibility
      cy.get('[data-testid="file-input"]').selectFile([
        'cypress/fixtures/test-image-1.jpg',
        'cypress/fixtures/test-image-2.png'
      ], { force: true });

      cy.get('[data-testid="prompt-input"]').type('Test accessibility');
      cy.get('[data-testid="analyze-button"]').click();

      cy.get('[data-testid="analysis-results"]', { timeout: 15000 })
        .should('have.attr', 'role', 'region')
        .should('have.attr', 'aria-label')
        .and('contain', 'results');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large images efficiently', () => {
      const startTime = Date.now();

      // Upload large images
      cy.get('[data-testid="file-input"]').selectFile([
        'cypress/fixtures/large-image-5mb.jpg',
        'cypress/fixtures/large-image-4mb.png'
      ], { force: true });

      // Verify upload completes within reasonable time
      cy.get('[data-testid="upload-progress"]', { timeout: 10000 })
        .should('be.visible');

      cy.get('[data-testid="uploaded-images-list"]', { timeout: 15000 })
        .children()
        .should('have.length', 2);

      // Verify performance metrics
      cy.window().then((win) => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(15000); // Should complete within 15 seconds
      });
    });

    it('should optimize image display and thumbnails', () => {
      cy.get('[data-testid="file-input"]').selectFile([
        'cypress/fixtures/test-image-1.jpg',
        'cypress/fixtures/test-image-2.png',
        'cypress/fixtures/test-image-3.webp'
      ], { force: true });

      // Verify thumbnail generation
      cy.get('[data-testid="image-thumbnail-0"]')
        .should('be.visible')
        .should('have.attr', 'src')
        .and('contain', 'data:image');

      // Verify lazy loading for large lists
      cy.get('[data-testid="image-preview-0"]')
        .should('have.attr', 'loading', 'lazy');

      // Test image optimization indicators
      cy.get('[data-testid="image-size-optimized"]')
        .should('be.visible')
        .should('contain.text', 'Optimized');
    });
  });
});