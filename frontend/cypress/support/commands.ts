// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom command for uploading files via drag and drop
Cypress.Commands.add('uploadFiles', (files: string[]) => {
  cy.get('[data-testid="image-upload-area"]').then(subject => {
    // Simulate file upload for testing
    const mockFiles = files.map(fileName => ({
      name: fileName,
      type: fileName.endsWith('.jpg') ? 'image/jpeg' : 
            fileName.endsWith('.png') ? 'image/png' :
            fileName.endsWith('.webp') ? 'image/webp' : 'image/gif',
      size: Math.random() * 1000000 + 100000, // Random size between 100KB - 1MB
    }));
    
    // Trigger the file upload event
    cy.wrap(subject).trigger('drop', {
      dataTransfer: {
        files: mockFiles,
      },
    });
  });
});

// Custom command for waiting for analysis to complete
Cypress.Commands.add('waitForAnalysis', () => {
  // Wait for loading spinner to appear and disappear
  cy.get('[data-testid="loading-spinner"]', { timeout: 2000 }).should('be.visible');
  cy.get('[data-testid="loading-spinner"]', { timeout: 30000 }).should('not.exist');
  
  // Wait for results to be displayed
  cy.get('[data-testid="analysis-results"]', { timeout: 5000 }).should('be.visible');
});

// Example of overwriting an existing command
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

export {};