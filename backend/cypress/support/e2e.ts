// Cypress E2E support file

// Import commands
import './commands';

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  return false;
});

// Custom commands for API testing
declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<string>;
      loginAsUser(email: string, password: string): Chainable<string>;
      createTestUser(): Chainable<{ token: string; user: any }>;
      cleanupTestData(): Chainable<void>;
    }
  }
}