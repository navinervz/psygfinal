import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '@/config/environment';

/**
 * Swagger/OpenAPI configuration
 */
export const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PSYGStore API',
      version: '1.0.0',
      description: 'Complete API documentation for PSYGStore backend',
      contact: {
        name: 'PSYGStore Support',
        email: 'support@psygstore.com',
        url: 'https://t.me/Psygsupport',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: config.app.baseUrl,
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication',
        },
        adminAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token with admin privileges',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            walletBalanceRial: { type: 'number' },
            walletBalanceCrypto: { type: 'number' },
            authType: { type: 'string', enum: ['EMAIL', 'WEB3'] },
            isAdmin: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            productId: { type: 'string' },
            optionName: { type: 'string' },
            quantity: { type: 'number' },
            totalPrice: { type: 'number' },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Article: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            excerpt: { type: 'string' },
            content: { type: 'string' },
            category: { type: 'string' },
            readTime: { type: 'number' },
            isPublished: { type: 'boolean' },
            publishedAt: { type: 'string', format: 'date-time' },
          },
        },
        Coupon: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            type: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
            value: { type: 'number' },
            minAmount: { type: 'number' },
            usageLimit: { type: 'number' },
            isActive: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            statusCode: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  retryAfter: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'User management and profile operations',
      },
      {
        name: 'Orders',
        description: 'Order management and tracking',
      },
      {
        name: 'Payments',
        description: 'Payment processing and wallet management',
      },
      {
        name: 'Articles',
        description: 'Article and blog management',
      },
      {
        name: 'Coupons',
        description: 'Coupon and discount management',
      },
      {
        name: 'Prices',
        description: 'Cryptocurrency price management',
      },
      {
        name: 'Admin',
        description: 'Administrative operations (admin only)',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/controllers/admin/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);