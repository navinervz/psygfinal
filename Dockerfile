# --- Build backend ---
FROM node:20-alpine AS backend-build
WORKDIR /app/backend

# نصب سریع با کش بهتر
COPY backend/package*.json ./
RUN npm ci

# کد و پریزما
COPY backend/prisma ./prisma
COPY backend/ ./

# Prisma client
RUN npx prisma generate

# بیلد TS
RUN npm run build

# --- Runtime for backend ---
FROM node:20-alpine AS backend
WORKDIR /app/backend
ENV NODE_ENV=production

# فقط خروجی‌های لازم
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/prisma ./prisma

EXPOSE 3000

# Healthcheck: هر پاسخ HTTP از روت کافیست (نیاز به /healthz نیست)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', ()=>process.exit(0)).on('error',()=>process.exit(1))"

# مایگریت → اجرا
ENTRYPOINT ["sh","-c","npx prisma migrate deploy && node dist/server.js"]
