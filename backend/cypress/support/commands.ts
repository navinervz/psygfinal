// Custom Cypress commands for PSYGStore E2E testing

Cypress.Commands.add('loginAsAdmin', () => {
  const adminEmail = Cypress.env('ADMIN_EMAIL');
  const adminPassword = Cypress.env('ADMIN_PASSWORD');

  return cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: adminEmail,
      password: adminPassword,
    },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.success).to.be.true;
    return response.body.accessToken;
  });
});

Cypress.Commands.add('loginAsUser', (email: string, password: string) => {
  return cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.success).to.be.true;
    return response.body.accessToken;
  });
});

Cypress.Commands.add('createTestUser', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    fullName: 'Cypress Test User',
    password: 'cypress123456',
  };

  return cy.request({
    method: 'POST',
    url: '/api/auth/register',
    body: testUser,
  }).then((response) => {
    expect(response.status).to.eq(201);
    expect(response.body.success).to.be.true;
    return {
      token: response.body.accessToken,
      user: response.body.user,
    };
  });
});

Cypress.Commands.add('cleanupTestData', () => {
  // This would require admin privileges to clean up test data
  cy.loginAsAdmin().then((adminToken) => {
    // Clean up test articles, users, etc.
    cy.request({
      method: 'POST',
      url: '/api/admin/system/cleanup',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      failOnStatusCode: false,
    });
  });
});