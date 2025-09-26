# 🚀 Oasis Care Demo Runbook

This guide covers how to run the Oasis Care demo application locally and deploy it for staging demos.

## 📋 Prerequisites

- **Node.js**: Version 20 or higher
- **pnpm**: Version 9.13.1 (will be auto-installed via corepack)
- **Docker**: For local database (optional)
- **PostgreSQL**: For database (local or remote)

## 🔧 Environment Setup

### Required Environment Variables

#### API (`apps/api/.env.local`)
```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/oasis_dev

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Cognito (if using)
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret
COGNITO_ISSUER=https://cognito-idp.eu-west-2.amazonaws.com/your-pool-id

# Demo Seeding
DEMO_SEED_TOKEN=your-demo-seed-secret-key
DEMO_ADMIN_EMAIL=admin@demo.local
DEMO_ADMIN_PASSWORD=SecurePassword123!

# Optional
ALLOWED_ORIGINS=http://localhost:3000,https://app.oasis-care.com
METRICS_ENABLED=true
GDPR_ENABLED=true
```

#### Web App (`apps/web/.env.local`)
```bash
# NextAuth
NEXTAUTH_SECRET=same-as-api-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# API Connection
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3001/graphql

# Cognito
COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_ISSUER=https://cognito-idp.eu-west-2.amazonaws.com/your-pool-id
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# From project root
pnpm install
```

### 2. Database Setup
```bash
# Generate Prisma client
pnpm --filter @oasis/db prisma generate

# Run migrations
pnpm --filter @oasis/db prisma migrate deploy

# Seed with demo data (optional)
pnpm --filter @oasis/db run seed
```

### 3. Start Development Servers
```bash
# Terminal 1: Start API
pnpm --filter @oasis/api dev

# Terminal 2: Start Web App
pnpm --filter @oasis/web dev
```

### 4. Verify Health
- **API Health**: http://localhost:3001/health → `{"status":"ok"}`
- **Web App**: http://localhost:3000 → Should load dashboard
- **GraphQL Playground**: http://localhost:3001/graphql

## 🌱 Demo Data Seeding

### Using Prisma Seed (Recommended)
```bash
pnpm --filter @oasis/db run seed
```

### Using Demo Endpoint (Protected)
```bash
curl -X POST http://localhost:3001/demo-seed \
  -H "x-seed-key: your-demo-seed-secret-key"
```

### Seeded Data Includes:
- **Organization**: Oasis Demo
- **Admin User**: Based on `DEMO_ADMIN_EMAIL`
- **Carers**: 3 demo carers (Sarah, Mike, Emma)
- **Clients**: 5 demo clients with London addresses
- **Medications**: Paracetamol, Lisinopril, Metformin
- **Visits**: 2 completed today, 4 upcoming
- **eMAR**: Sample medication administrations

## 📱 Demo Flow Script

### 1. Dashboard Overview (2 minutes)
- Login as admin user
- Show today's stats: visits, carers, clients
- Highlight completed vs upcoming visits
- Point out key metrics

### 2. Visits Management (3 minutes)
- Navigate to Visits page
- Show visit list with filtering
- Open a completed visit → show notes, tasks
- Open an upcoming visit → demonstrate scheduling

### 3. Client Management (3 minutes)
- Navigate to Clients
- Open a client profile
- Show client details, address, DOB
- Navigate to Medications tab
- Show active prescriptions

### 4. eMAR (Electronic Medication Administration) (3 minutes)
- Navigate to eMAR page
- Show medication schedule for today
- Demonstrate "marking as administered"
- Show medication history and notes

### 5. Reporting & Analytics (2 minutes)
- Back to dashboard
- Show real-time metrics
- Demonstrate responsive design on mobile
- Highlight compliance features

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Reset database
pnpm --filter @oasis/db prisma migrate reset
pnpm --filter @oasis/db run seed
```

#### Prisma Client Out of Sync
```bash
# Regenerate client
pnpm --filter @oasis/db prisma generate
```

#### Port Already in Use
```bash
# Kill processes on ports 3000/3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

#### Missing Environment Variables
- Check all `.env.local` files exist
- Verify all required variables are set
- Restart development servers after changes

### Development Scripts

```bash
# Full build (all packages)
pnpm turbo run build

# Run tests
pnpm --filter @oasis/api test
pnpm --filter @oasis/web test

# Lint and format
pnpm turbo run lint
pnpm turbo run format

# Database operations
pnpm --filter @oasis/db prisma studio    # GUI for database
pnpm --filter @oasis/db prisma migrate dev  # Create new migration
```

## 🚀 Production Deployment

### Using GitHub Actions
1. Push to `main` or `demo/*` branch
2. API builds automatically via `.github/workflows/api-ci-cd.yml`
3. Web app deploys via Amplify (if configured)

### Manual Deployment
```bash
# Build Docker image for API
docker build -t oasis-api -f apps/api/Dockerfile .

# Deploy to AWS ECS/App Runner
# (Follow infrastructure/DEPLOYMENT_GUIDE.md)
```

## 📊 Monitoring

### Health Checks
- **API**: `/health` and `/healthz`
- **Metrics**: `/metrics` (if enabled)
- **Demo Health**: `/demo/health`

### Logs
- API logs to CloudWatch (production)
- Console output (development)
- Request IDs for tracing

## 🔒 Security Notes

- Never commit `.env` files
- Use strong secrets (min 32 characters)
- Rotate secrets regularly
- Enable HTTPS in production
- Validate all demo seed requests with headers

---

## 🎯 Demo Tips

1. **Prepare Data**: Always seed fresh data before demos
2. **Test Flow**: Run through the entire script beforehand
3. **Have Backup**: Local version ready if network issues
4. **Monitor Performance**: Check API response times
5. **Mobile Ready**: Test responsive design on tablets

For technical issues during demos, contact the development team or refer to the main README.md.
