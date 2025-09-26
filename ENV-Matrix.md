# 🔧 Environment Variables Matrix

This document maps all environment variables used across the Oasis Care applications.

## 📊 Variable Status Legend
- ✅ **Found**: Variable is set in example/template files
- ❌ **Missing**: Variable needs to be configured
- ⚠️ **Optional**: Variable has fallback or is feature-flagged

---

## 🖥️ API Application (`apps/api`)

### Core Database & Authentication
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `DATABASE_URL` | ❌ | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | ❌ | JWT signing secret (min 32 chars) | `your-super-secret-jwt-key` |
| `NEXTAUTH_SECRET` | ❌ | NextAuth.js encryption secret | `your-nextauth-secret` |
| `NEXTAUTH_URL` | ❌ | Application base URL | `https://app.oasis-care.com` |

### AWS Cognito Integration
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `COGNITO_CLIENT_ID` | ❌ | Cognito app client ID | `3imuihdo5v7lgimq8je6d38std` |
| `COGNITO_CLIENT_SECRET` | ❌ | Cognito app client secret | `generated-secret` |
| `COGNITO_ISSUER` | ❌ | Cognito identity provider URL | `https://cognito-idp.eu-west-2.amazonaws.com/pool-id` |

### Demo & Development
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `DEMO_SEED_TOKEN` | ❌ | Secret key for demo seed endpoint | `demo-secret-2025` |
| `DEMO_ADMIN_EMAIL` | ❌ | Admin user email for demos | `admin@demo.local` |
| `DEMO_ADMIN_PASSWORD` | ❌ | Admin user password | `SecurePassword123!` |

### Optional Features
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `NODE_ENV` | ✅ | Runtime environment | `development` |
| `PORT` | ⚠️ | API server port | `3001` |
| `ALLOWED_ORIGINS` | ⚠️ | CORS allowed origins | `http://localhost:3000` |
| `METRICS_ENABLED` | ⚠️ | Enable Prometheus metrics | `false` |
| `GDPR_ENABLED` | ⚠️ | Enable GDPR module | `false` |
| `AI_SUMMARY_ENABLED` | ⚠️ | Enable AI summary features | `false` |

---

## 🌐 Web Application (`apps/web`)

### NextAuth Configuration  
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `NEXTAUTH_SECRET` | ❌ | NextAuth.js encryption secret | `same-as-api-nextauth-secret` |
| `NEXTAUTH_URL` | ❌ | Application base URL | `https://app.oasis-care.com` |

### API Connection
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `NEXT_PUBLIC_API_URL` | ❌ | API base URL (public) | `https://api.oasis-care.com` |
| `NEXT_PUBLIC_GRAPHQL_URL` | ❌ | GraphQL endpoint (public) | `https://api.oasis-care.com/graphql` |

### Authentication Integration
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `COGNITO_CLIENT_ID` | ❌ | Cognito app client ID | `3imuihdo5v7lgimq8je6d38std` |
| `COGNITO_ISSUER` | ❌ | Cognito identity provider URL | `https://cognito-idp.eu-west-2.amazonaws.com/pool-id` |

### Optional Configuration
| Variable | Status | Description | Example/Default |
|----------|--------|-------------|----------------|
| `NODE_ENV` | ✅ | Build environment | `development` |
| `VERCEL_ENV` | ⚠️ | Vercel deployment environment | `preview` |

---

## 🏗️ Infrastructure & Deployment

### GitHub Secrets (CI/CD)
| Variable | Status | Description | Used In |
|----------|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | ❌ | AWS access credentials | GitHub Actions |
| `AWS_SECRET_ACCESS_KEY` | ❌ | AWS secret credentials | GitHub Actions |
| `APP_RUNNER_SERVICE_ARN` | ⚠️ | AWS App Runner service ARN | API CI/CD |
| `AMPLIFY_WEBHOOK_URL` | ⚠️ | AWS Amplify webhook URL | Web deployment |

### AWS Secrets Manager
| Variable | Status | Description | Path |
|----------|--------|-------------|------|
| `DATABASE_URL` | ❌ | Database connection | `oasis/staging/DATABASE_URL` |
| `NEXTAUTH_SECRET` | ❌ | NextAuth secret | `oasis/staging/NEXTAUTH_SECRET` |
| `COGNITO_CLIENT_SECRET` | ❌ | Cognito secret | `oasis/staging/COGNITO_CLIENT_SECRET` |

---

## 📋 Setup Checklist

### For Local Development

#### API Setup
```bash
# Copy example environment file
cp apps/api/.env.example apps/api/.env.local

# Required variables to set:
DATABASE_URL=postgresql://...
JWT_SECRET=your-32-char-secret
NEXTAUTH_SECRET=your-nextauth-secret
DEMO_SEED_TOKEN=demo-secret-key
DEMO_ADMIN_EMAIL=admin@demo.local
```

#### Web Setup
```bash
# Copy example environment file  
cp apps/web/.env.example apps/web/.env.local

# Required variables to set:
NEXTAUTH_SECRET=same-as-api
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### For Staging Deployment

#### AWS Secrets Manager
```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret --name oasis/staging/DATABASE_URL --secret-string "postgresql://..."
aws secretsmanager create-secret --name oasis/staging/NEXTAUTH_SECRET --secret-string "..."
aws secretsmanager create-secret --name oasis/staging/COGNITO_CLIENT_SECRET --secret-string "..."
```

#### GitHub Repository Secrets
```bash
# Add repository secrets via GitHub UI or CLI
gh secret set AWS_ACCESS_KEY_ID --body="AKIA..."
gh secret set AWS_SECRET_ACCESS_KEY --body="..."
gh secret set APP_RUNNER_SERVICE_ARN --body="arn:aws:apprunner:..."  # Optional
gh secret set AMPLIFY_WEBHOOK_URL --body="https://..."  # Optional
```

---

## 🔍 Verification Commands

### Check Local Configuration
```bash
# Verify API can start
pnpm --filter @oasis/api dev

# Check health endpoint
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Verify Web can start  
pnpm --filter @oasis/web dev

# Check web app loads
curl http://localhost:3000
# Expected: HTML response
```

### Verify Database Connection
```bash
# Test database connectivity
pnpm --filter @oasis/db prisma studio

# Run migrations
pnpm --filter @oasis/db prisma migrate deploy
```

### Verify Demo Seeding
```bash
# Test demo endpoint (with proper secret)
curl -X POST http://localhost:3001/demo-seed \
  -H "x-seed-key: your-demo-seed-token"
# Expected: Success response with counts
```

---

## 🚨 Security Notes

- **Never commit real secrets** to version control
- **Use strong secrets** (minimum 32 characters for crypto operations)
- **Rotate secrets regularly** in production environments
- **Use AWS Secrets Manager** for production secrets
- **Enable secret scanning** in GitHub repository settings

## 📚 Related Documentation

- [Demo Runbook](docs/Demo-Runbook.md) - Complete setup and demo guide
- [Infrastructure Guide](infrastructure/DEPLOYMENT_GUIDE.md) - AWS deployment details
- [Main README](README.md) - Project overview and quick start
