# Supabase / Postgres local setup (quick)

Option A — Supabase cloud
- Create project in supabase.com
- Get URL and anon/service keys from project settings
- Put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY into .env

Option B — Local Postgres with docker-compose
1. Create docker-compose.yml:
version: '3.8'
services:
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: psygdb
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:

2. Start:

docker-compose up -d

3. Set DATABASE_URL in .env:

DATABASE_URL=postgres://user:password@localhost:5432/psygdb

4. Run Prisma (backend):

cd backend
npx prisma db push
# or if you have migrations:
npx prisma migrate deploy

Notes
- If you use Supabase cloud, skip the docker steps and set SUPABASE keys in `.env`.
- Make sure backend `DATABASE_URL` matches what prisma expects.
