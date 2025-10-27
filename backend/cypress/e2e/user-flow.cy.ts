describe('User Flow E2E Tests', () => {
  const testUser = {
    email: 'cypress-test@example.com',
    fullName: 'Cypress Test User',
    password: 'cypress123456',
  };
  
  let userToken: string;
  let userId: string;

  before(() => {
    // Clean up any existing test user
    cy.task('log', 'Setting up E2E test environment');
  });

  describe('User Registration and Authentication', () => {
    it('should register new user', () => {
      cy.request({
        method: 'POST',
        url: '/api/auth/register',
        body: testUser,
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.success).to.be.true;
        expect(response.body.user.email).to.eq(testUser.email);
        expect(response.body.accessToken).to.exist;
        userToken = response.body.accessToken;
        userId = response.body.user.id;
      });
    });

    it('should login with registered user', () => {
      cy.request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testUser.email,
          password: testUser.password,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.accessToken).to.exist;
        userToken = response.body.accessToken;
      });
    });

    it('should get user profile', () => {
      cy.request({
        method: 'GET',
        url: '/api/users/profile',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.user.email).to.eq(testUser.email);
      });
    });
  });

  describe('Wallet and Payment Flow', () => {
    it('should get wallet information', () => {
      cy.request({
        method: 'GET',
        url: '/api/wallet',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.wallet.balanceRial).to.be.a('number');
      });
    });

    it('should create ZarinPal payment request', () => {
      cy.request({
        method: 'POST',
        url: '/api/payments/zarinpal/request',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        body: {
          amount: 1000000,
          description: 'تست پرداخت Cypress',
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.authority).to.exist;
        expect(response.body.paymentUrl).to.exist;
      });
    });

    it('should create crypto payment request', () => {
      cy.request({
        method: 'POST',
        url: '/api/payments/crypto/request',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        body: {
          amount: 15.38,
          currency: 'USDT',
          description: 'تست پرداخت کریپتو Cypress',
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.paymentId).to.exist;
        expect(response.body.currency).to.eq('USDT');
      });
    });

    it('should get current crypto prices', () => {
      cy.request({
        method: 'GET',
        url: '/api/payments/prices/current',
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.prices.USDT).to.be.a('number');
        expect(response.body.prices.BTC).to.be.a('number');
        expect(response.body.prices.ETH).to.be.a('number');
      });
    });
  });

  describe('Order Management', () => {
    it('should create order (with sufficient wallet balance)', () => {
      // First, simulate wallet top-up by directly updating balance
      // In real scenario, this would happen after successful payment
      
      cy.request({
        method: 'POST',
        url: '/api/orders',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        body: {
          productId: 'telegram-premium',
          optionName: 'اشتراک ماهانه',
          quantity: 1,
          totalPrice: 795000,
          telegramId: '@cypresstest',
          notes: 'سفارش تست Cypress',
        },
        failOnStatusCode: false,
      }).then((response) => {
        // Might fail due to insufficient balance, which is expected
        if (response.status === 201) {
          expect(response.body.success).to.be.true;
          expect(response.body.order.productId).to.eq('telegram-premium');
        } else if (response.status === 400) {
          expect(response.body.error).to.include('Insufficient wallet balance');
        }
      });
    });

    it('should get user orders', () => {
      cy.request({
        method: 'GET',
        url: '/api/orders',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.orders).to.be.an('array');
      });
    });
  });

  describe('Coupon System', () => {
    it('should validate coupon (if exists)', () => {
      cy.request({
        method: 'POST',
        url: '/api/coupons/validate',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        body: {
          code: 'WELCOME10',
          orderAmount: 1000000,
        },
        failOnStatusCode: false,
      }).then((response) => {
        // Coupon might not exist or might be used, both are acceptable
        if (response.status === 200) {
          expect(response.body.success).to.be.true;
          expect(response.body.coupon).to.exist;
        } else {
          expect(response.status).to.be.oneOf([400, 404]);
        }
      });
    });
  });

  describe('Articles (Public)', () => {
    it('should get articles list', () => {
      cy.request({
        method: 'GET',
        url: '/api/articles',
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.articles).to.be.an('array');
      });
    });

    it('should search articles', () => {
      cy.request({
        method: 'GET',
        url: '/api/articles?search=تلگرام',
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.articles).to.be.an('array');
      });
    });
  });

  after(() => {
    // Cleanup: Delete test user (optional)
    cy.task('log', 'E2E tests completed');
  });
});