# Database Setup Guide

This guide covers setting up the TRADERSUTOPIA database schema, seeding data, and running validation tests.

## Quick Start

### 1. Prerequisites
- PostgreSQL database (local or Neon)
- Environment variables configured:
  - `DATABASE_URL` - PostgreSQL connection string
- Node.js and pnpm installed

### 2. Initial Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed development data
pnpm tsx scripts/seed-database.ts dev

# Validate setup
pnpm tsx scripts/test-schema.ts
```

## Environment-Specific Seeding

### Development Environment
```bash
pnpm tsx scripts/seed-database.ts dev
```
- Complete dataset with all user scenarios
- Sample messages and attachments
- All subscription states (free, trial, active, canceled)
- Realistic server organization

### Testing Environment  
```bash
pnpm tsx scripts/seed-database.ts test
```
- Focused datasets for automated testing
- Additional edge case users
- Performance testing data

### Staging Environment
```bash
pnpm tsx scripts/seed-database.ts staging
```
- Production-like data volumes
- Anonymized patterns
- Performance validation datasets

## Validation & Testing

### Schema Validation
```bash
# Run comprehensive schema tests
pnpm tsx scripts/test-schema.ts

# Validate seed data integrity
pnpm tsx scripts/test-schema.ts seed-validate
```

### Manual Database Inspection
```bash
# Open Prisma Studio for visual inspection
npx prisma studio

# Connect to database directly
psql $DATABASE_URL
```

## Seeded Data Overview

### Users
- **Alpha Trader** (`clerk_admin_001`) - Admin/content creator
- **Market Guru** (`clerk_admin_002`) - Admin/content creator  
- **Newbie Trader** (`clerk_user_001`) - Active premium subscriber
- **Day Trader Pro** (`clerk_user_002`) - Trial user
- **Swing Master** (`clerk_user_003`) - Free user

### Servers & Organization
- **TRADERSUTOPIA MAIN** - Primary server with organized sections:
  - 📈 Market Analysis (daily-market-overview, sector-rotation)
  - 💰 Trading Signals (swing-signals, day-trade-alerts)
  - 📚 Education (basics-and-fundamentals) - Free access
  - 🎯 Premium Content (exclusive-setups) - Premium only

### Access Control
- **Free Role** - Access to education content only
- **Premium Role** - Full access to all channels and sections

### Sample Content
- Daily market analysis messages
- Trading signals with chart attachments
- Subscription notifications
- Timer configuration for live sessions

## Common Operations

### Reset Development Database
```bash
# Clear and reseed
pnpm tsx scripts/seed-database.ts dev
```

### Add New Test Scenarios
1. Edit `scripts/seed-database.ts`
2. Add new user/subscription scenarios
3. Re-run seeding for test environment

### Validate Business Logic
```bash
# Run constraint validation
pnpm tsx scripts/test-schema.ts
```

### Performance Monitoring
The test script includes performance benchmarks for:
- User lookups by Clerk ID
- Server membership queries  
- Message pagination
- Role permission checks

## Troubleshooting

### Common Issues

#### Prisma Client Not Generated
```bash
npx prisma generate
```

#### Migration Errors
```bash
# Reset migrations (development only!)
npx prisma migrate reset

# Deploy specific migration
npx prisma migrate deploy
```

#### Seeding Failures
- Check database connectivity
- Verify environment variables
- Ensure migrations are applied
- Check for unique constraint violations

#### Performance Issues
- Run query analysis: `EXPLAIN ANALYZE`
- Check index usage
- Monitor connection pool usage

## Documentation

- [Schema Design](./schema-design.md) - Complete ER diagrams and design decisions
- [Seed Data Strategy](./seed-data.md) - Detailed seeding approach and examples

## Scripts Reference

### `scripts/seed-database.ts`
- Environment-aware seeding
- Comprehensive user scenarios
- Server organization setup
- Role-based access control
- Sample content creation

### `scripts/test-schema.ts`  
- Database connectivity tests
- Schema integrity validation
- Business logic constraint checking
- Performance benchmarking
- Seed data verification

---

*For additional help, see the complete schema documentation or reach out to the development team.* 