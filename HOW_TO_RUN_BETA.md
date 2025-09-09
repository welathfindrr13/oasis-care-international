# How to Run Oasis Care Beta

## Prerequisites
- **Node.js** 18+ and **pnpm** installed
- **Docker** and **Docker Compose** available
- **Git** (to clone the repository)

## Quick Start

### 1. Start Database Containers
```bash
# Start test database (for E2E tests)
docker compose -f demo/docker-compose.test.yml up -d

# Start demo database (for beta demo)
docker compose -f demo/docker-compose.demo.yml up -d
```

### 2. Environment Configuration
```bash
# Copy demo environment (adjust paths if needed)
cp .env.demo .env.local
```

### 3. Install Dependencies & Build
```bash
# Install all workspace dependencies
pnpm install

# Build the workspace (optional - can skip if issues)
pnpm -w -r build || true
```

### 4. Database Setup
```bash
# Apply migrations and seed demo data
pnpm --filter @oasis/db prisma migrate deploy
pnpm --filter @oasis/db prisma db seed
```

### 5. Start Applications
```bash
# Start API server (Terminal 1)
pnpm --filter @oasis/api dev

# Start Web app (Terminal 2) 
pnpm --filter @oasis/web dev
```

## Access the Demo

### URLs
- **Web App**: http://localhost:3000
- **API GraphQL**: http://localhost:4000/graphql
- **API Health**: http://localhost:4000/demo/health

### Demo Authentication
Add this header to API requests for demo access:
```
Authorization: Bearer DEMO_SHOW
```

### Key Demo Routes
- `/dashboard` - Main overview with metrics and activity
- `/visits` - List and manage care visits
- `/visits/new` - Schedule new visits
- `/clients` - Client directory with search
- `/admin/metrics` - System monitoring (admin only)

## Demo Data
- **5 Clients**: Margaret Thompson, Robert Smith, Emily Davis, John Williams, Mary Brown
- **4 Carers**: Sarah Johnson, Mike Thompson, Emma Wilson, James Roberts  
- **12 Visits**: 6 today (2 finished, 4 upcoming), 6 tomorrow
- **Locations**: London-based addresses
- **Tasks**: Meal prep, medication, wellness checks

## Troubleshooting

### Database Connection Issues
```bash
# Check container status
docker ps | grep oasis

# Restart containers if needed
docker compose -f demo/docker-compose.demo.yml restart
```

### API Won't Start
```bash
# Check if database is ready
curl http://localhost:4000/demo/health

# Check logs for Prisma/database errors
# Ensure .env.demo is properly sourced
```

### Web App Build Errors
```bash
# Clear Next.js cache
cd apps/web && rm -rf .next

# Restart development server
pnpm --filter @oasis/web dev
```

### Port Conflicts
- **API**: Change `PORT=4000` in .env.demo if port 4000 is busy
- **Web**: Change `WEB_PORT=3000` if port 3000 is busy  
- **Demo DB**: Change `5434:5432` in docker-compose.demo.yml if port 5434 is busy

## Architecture Notes
- **Monorepo**: pnpm workspace with shared libs
- **Backend**: NestJS with GraphQL + REST APIs
- **Frontend**: Next.js 14 with App Router
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Prisma for schema and migrations
- **Authentication**: JWT (bypassed in demo mode)
- **Styling**: Tailwind CSS with design tokens

## Development Workflow
1. Make changes to code
2. API auto-reloads on file changes
3. Web app hot-reloads on file changes
4. Database changes require migration: `pnpm --filter @oasis/db prisma migrate dev`

---

**Need help?** Check logs in terminal windows or contact the development team.
