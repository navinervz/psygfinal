# PSYGStore Monorepo

PSYGStore is the storefront for digital subscriptions with multi-currency support (IRR, USDT, TON) and a Node.js backend.

## Structure
- frontend: React 18 + Vite + TypeScript + Tailwind
- backend: Express + Prisma + MySQL (configurable)
- scripts: maintenance utilities

## Quick Start
### Frontend
`
npm install
npm run dev
npm run build
`

### Backend
`
cd backend
npm install
npm run dev
npm run build && npm run start
`

Environment variables are defined in .env and ackend/.env examples. Update credentials before deploying.

## Features
- Wallet top-up with Payment4, USDT (MetaMask), TON (Tonkeeper)
- REST API with JWT access/refresh tokens and Swagger docs (/api-docs)
- Prisma models for users, orders, payments, coupons, articles
- Dockerfile (to be updated for Node-only deployment)

## Security TODO
- Finalize AuthContext integration with backend endpoints
- Migrate deploy.sh and scripts to Node versions
- Audit Dockerfile to remove legacy PHP stage

## License
UNLICENSED (private project)

