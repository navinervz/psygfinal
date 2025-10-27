describe('Admin Panel E2E Tests', () => {
  const adminEmail = Cypress.env('ADMIN_EMAIL');
  const adminPassword = Cypress.env('ADMIN_PASSWORD');
  let adminToken: string;

  before(() => {
    // Login as admin and get token
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: {
        email: adminEmail,
        password: adminPassword,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      adminToken = response.body.accessToken;
    });
  });

  describe('Admin Dashboard', () => {
    it('should access admin dashboard with valid token', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/dashboard',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.data.stats).to.exist;
        expect(response.body.data.stats.totalUsers).to.be.a('number');
      });
    });

    it('should deny access without admin token', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/dashboard',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('Article Management', () => {
    let articleId: string;

    it('should create new article', () => {
      const articleData = {
        title: 'مقاله تست Cypress',
        slug: 'cypress-test-article',
        excerpt: 'این مقاله برای تست E2E ایجاد شده است',
        content: 'محتوای کامل مقاله تست که باید حداقل 100 کاراکتر باشد تا validation را پاس کند و در سیستم ذخیره شود.',
        category: 'تست',
        readTime: 5,
        keywords: ['تست', 'cypress', 'e2e'],
        metaDescription: 'مقاله تست برای Cypress E2E',
        isPublished: false,
      };

      cy.request({
        method: 'POST',
        url: '/api/admin/articles',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: articleData,
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.success).to.be.true;
        expect(response.body.article.title).to.eq(articleData.title);
        articleId = response.body.article.id;
      });
    });

    it('should update article', () => {
      cy.request({
        method: 'PUT',
        url: `/api/admin/articles/${articleId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: {
          title: 'مقاله تست Cypress - ویرایش شده',
          readTime: 7,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should publish article', () => {
      cy.request({
        method: 'POST',
        url: `/api/admin/articles/${articleId}/publish`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should verify article is visible in public API', () => {
      cy.request({
        method: 'GET',
        url: '/api/articles/cypress-test-article',
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.article.isPublished).to.be.true;
      });
    });

    it('should delete article', () => {
      cy.request({
        method: 'DELETE',
        url: `/api/admin/articles/${articleId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });
  });

  describe('Price Management', () => {
    it('should get current prices', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/prices',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.prices).to.exist;
        expect(response.body.prices.USDT).to.be.a('number');
      });
    });

    it('should manually update prices', () => {
      cy.request({
        method: 'POST',
        url: '/api/admin/prices/update',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should get price service status', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/prices/service/status',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.serviceStatus).to.exist;
      });
    });
  });

  describe('Alert System', () => {
    it('should test alert system', () => {
      cy.request({
        method: 'POST',
        url: '/api/admin/alerts/test',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.results).to.exist;
      });
    });

    it('should send manual alert', () => {
      cy.request({
        method: 'POST',
        url: '/api/admin/alerts',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: {
          severity: 'INFO',
          title: 'تست Cypress',
          message: 'این یک پیام تست از Cypress است',
          metadata: { source: 'cypress-e2e' },
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should get alert configuration', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/alerts/config',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.config).to.exist;
        expect(response.body.config.thresholds).to.exist;
      });
    });
  });

  describe('Reports', () => {
    it('should generate sales report', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/reports/sales',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.report.type).to.eq('sales');
      });
    });

    it('should generate revenue report', () => {
      cy.request({
        method: 'GET',
        url: '/api/admin/reports/revenue',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.report.type).to.eq('revenue');
      });
    });
  });
});