# Backend Setup Guide for PSYGStore

## Quick Start (Development)

Follow these steps to get the backend running locally:

### 1. Prerequisites

Make sure you have installed:
- **Node.js 18+** (LTS)
- **MySQL 8.0+** or **MariaDB 10.6+**
- **npm** or **yarn** package manager

### 2. Setup Database

```bash
# Create a new MySQL database
mysql -u root -p
CREATE DATABASE psyg_store;
EXIT;
```

### 3. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your local settings
```

**Important .env values for development:**
```
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/psyg_store"
NODE_ENV="development"
PORT=3000
JWT_SECRET="dev-secret-key-change-in-production"
CORS_ORIGIN="http://localhost:5173"
```

### 4. Install Dependencies

```bash
cd backend
npm install
```

### 5. Setup Prisma Database

```bash
# Run Prisma migrations
npm run prisma:migrate

# Optional: Seed the database with test data
npm run prisma:seed
```

### 6. Start the Backend Server

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

The server will start on `http://localhost:3000`

### 7. Verify Backend is Running

```bash
# Test the API health endpoint
curl http://localhost:3000/api/health
```

## API Endpoints Reference

### Authentication Routes (`/api/auth`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user

### User Routes (`/api/users`)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/:id` - Get specific user

### Wallet Routes (`/api/wallet`)
- `GET /api/wallet/balance` - Get wallet balance
- `POST /api/wallet/topup` - Top up wallet balance
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/transfer` - Transfer between wallets

### Product Routes (`/api/products`)
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get specific product
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Order Routes (`/api/orders`)
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get specific order
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id/status` - Update order status

## CORS Configuration

The backend is configured to accept requests from the frontend at `http://localhost:5173`.

If you're running the frontend on a different port, update in `.env`:
```
CORS_ORIGIN="http://localhost:YOUR_PORT"
```

## Database Schema

Prisma manages the database schema. Key tables:
- `User` - User accounts
- `Wallet` - User wallet balances
- `Transaction` - Wallet transactions
- `Product` - Store products
- `Order` - Customer orders
- `OrderItem` - Items in orders

## Common Issues

### Issue: "Connection refused" when connecting to database
**Solution:** 
- Ensure MySQL/MariaDB is running
- Check DATABASE_URL is correct in .env
- Verify database name matches DATABASE_URL

### Issue: "CORS error" when calling API from frontend
**Solution:**
- Ensure CORS_ORIGIN in .env matches your frontend URL
- Check frontend is calling correct backend API URL
- Clear browser cache and cookies

### Issue: "JWT expired" or authentication errors
**Solution:**
- Verify JWT_SECRET is set in .env
- Clear frontend localStorage of old tokens
- Login again to get fresh token

## Development Tips

1. **Hot Reload**: Changes to files are automatically detected with `npm run dev`
2. **Logging**: Set `LOG_LEVEL=debug` in .env for detailed logs
3. **Database**: Use `npx prisma studio` to view/edit database GUI
4. **Testing**: Run `npm test` for unit tests
5. **Linting**: Run `npm run lint` to check code quality

## Production Deployment

For production deployment:

```bash
# Build the project
npm run build

# Run in production
NODE_ENV=production npm start
```

Ensure these in production `.env`:
- Strong JWT_SECRET
- Production DATABASE_URL
- Correct CORS_ORIGIN
- NODE_ENV="production"

## Frontend Integration

The frontend is configured to call the backend at `http://localhost:3000/api` (development).

All API requests from frontend go through the configured API client with:
- Automatic JWT token injection
- Error handling and logging
- Request/response interceptors
- Automatic retries on failure

## Need Help?

Refer to:
- DEPLOYMENT_GUIDE.md - For VPS deployment
- PRODUCTION_CHECKLIST.md - For production requirements
- SECURITY.md - For security best practices
