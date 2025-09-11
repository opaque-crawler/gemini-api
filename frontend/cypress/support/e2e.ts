// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands');

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from
  // failing the test on uncaught exceptions
  return false;
});

// Add custom commands type definitions
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to upload files via drag and drop
       * @example cy.uploadFiles(['image1.jpg', 'image2.png'])
       */
      uploadFiles(files: string[]): Chainable<Element>;
      
      /**
       * Custom command to wait for image analysis to complete
       * @example cy.waitForAnalysis()
       */
      waitForAnalysis(): Chainable<Element>;
    }
  }
}