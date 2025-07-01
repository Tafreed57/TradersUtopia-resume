# AWS Amplify Troubleshooting Guide

This guide covers common issues you might encounter when deploying the Discord clone to AWS Amplify.

## Common Build Issues

### 1. Prisma Generation Errors

**Error:** `Prisma schema validation error` or `Prisma client could not be generated`

**Solutions:**
```bash
# Check that binary targets are set correctly in schema.prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]
}
```

**Environment Variables Check:**
- Ensure `DATABASE_URL` is correctly set
- Verify database is accessible from AWS (check firewall/security groups)

### 2. Next.js Build Failures

**Error:** `Module not found` or dependency errors

**Solutions:**
1. Clear cache in Amplify console and rebuild
2. Check that all dependencies are in `package.json`
3. Verify Node.js version compatibility

**Environment Variables:**
```bash
# Add these to debug build issues
BUILD_DEBUG=true
NODE_OPTIONS="--max-old-space-size=4096"
```

### 3. TypeScript Compilation Errors

**Error:** `Type errors` during build

**Solutions:**
1. Run `npm run build` locally to identify issues
2. Check `tsconfig.json` configuration
3. Ensure all environment variables are properly typed

## Runtime Issues

### 1. Database Connection Problems

**Error:** `Connection timeout` or `Database connection failed`

**Diagnostics:**
Check the health endpoint: `https://your-app.amplifyapp.com/api/health`

**Solutions:**
1. **Connection Pooling:** Add PgBouncer parameters to DATABASE_URL:
   ```bash
   DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true&connect_timeout=10&pool_timeout=10"
   ```

2. **Timeout Settings:** Increase timeout in your database provider
3. **SSL Configuration:** Ensure SSL is properly configured:
   ```bash
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   ```

### 2. Clerk Authentication Issues

**Error:** `Invalid publishable key` or authentication redirects failing

**Solutions:**
1. **Check Environment Variables:**
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```

2. **Update Clerk Dashboard:**
   - Add your Amplify domain to allowed origins
   - Update webhook URLs to your Amplify domain
   - Set correct redirect URLs

3. **Environment-specific Keys:**
   - Use production keys for production deployment
   - Ensure keys match the environment

### 3. Stripe Webhook Issues

**Error:** `Webhook signature verification failed`

**Solutions:**
1. **Update Webhook Endpoint:** 
   - Go to Stripe Dashboard > Webhooks
   - Update endpoint URL to: `https://your-app.amplifyapp.com/api/webhooks/stripe`

2. **Verify Webhook Events:**
   ```bash
   # Required events:
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
   ```

3. **Environment Variables:**
   ```bash
   STRIPE_SECRET_KEY=sk_live_... # or sk_test_ for testing
   STRIPE_WEBHOOK_SECRET=whsec_... # Get from webhook settings
   ```

### 4. LiveKit Connection Issues

**Error:** `Failed to connect to LiveKit` or video/audio not working

**Solutions:**
1. **Check Environment Variables:**
   ```bash
   LIVEKIT_API_KEY=your_api_key
   LIVEKIT_API_SECRET=your_api_secret
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
   ```

2. **CORS Configuration:**
   - Add your Amplify domain to LiveKit CORS settings
   - Ensure WebSocket connections are allowed

### 5. File Upload (UploadThing) Issues

**Error:** `Upload failed` or `Invalid API key`

**Solutions:**
1. **Environment Variables:**
   ```bash
   UPLOADTHING_SECRET=sk_live_...
   UPLOADTHING_APP_ID=your_app_id
   ```

2. **Domain Configuration:**
   - Add your Amplify domain to UploadThing allowed domains
   - Update CORS settings if needed

## Performance Issues

### 1. Slow Database Queries

**Solutions:**
1. **Connection Pooling:** Use PgBouncer
2. **Database Optimization:** Add indexes, optimize queries
3. **Caching:** Implement Redis caching for frequently accessed data

### 2. Large Bundle Size

**Solutions:**
1. **Dynamic Imports:** Use dynamic imports for heavy components
2. **Bundle Analysis:** Use `@next/bundle-analyzer`
3. **Image Optimization:** Ensure images are optimized

## Environment Variables Debug

### Check All Required Variables

Create a debug endpoint (development only):

```typescript
// src/app/api/debug-env/route.ts (for development only)
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not available in production', { status: 404 });
  }

  const requiredVars = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'NEXT_PUBLIC_LIVEKIT_URL',
    'RESEND_API_KEY',
    'NEXT_PUBLIC_APP_URL',
    'UPLOADTHING_SECRET',
  ];

  const status = requiredVars.map(varName => ({
    name: varName,
    set: !!process.env[varName],
    value: process.env[varName] ? '***SET***' : 'NOT SET'
  }));

  return Response.json({ environmentVariables: status });
}
```

## Monitoring and Debugging

### 1. Enable Detailed Logging

Add to your environment variables:
```bash
DEBUG=true
NODE_ENV=production
```

### 2. Health Check Monitoring

Monitor: `https://your-app.amplifyapp.com/api/health`

Expected response:
```json
{
  "status": "healthy",
  "message": "Application is running correctly",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "database": "connected"
}
```

### 3. CloudWatch Logs

1. Go to AWS CloudWatch
2. Find your Amplify application logs
3. Check for error patterns

## Deployment Best Practices

### 1. Staged Deployments

1. **Test Environment:** Deploy to a test branch first
2. **Environment Variables:** Use different values for test/production
3. **Database:** Use separate databases for test/production

### 2. Rollback Strategy

1. **Git Tags:** Tag successful deployments
2. **Environment Backup:** Keep backup of working environment variables
3. **Database Migrations:** Test migrations in staging first

### 3. Monitoring

1. **Health Checks:** Set up automated health monitoring
2. **Error Tracking:** Integrate Sentry or similar service
3. **Performance:** Monitor Core Web Vitals

## Getting Help

### 1. Check AWS Amplify Console
- Build logs
- Environment variables
- Performance metrics

### 2. Useful Commands for Local Testing

```bash
# Test database connection
npm run db:setup

# Check health endpoint locally
curl http://localhost:3000/api/health

# Build locally to test for issues
npm run build
```

### 3. Support Resources

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Prisma AWS Deployment](https://www.prisma.io/docs/guides/deployment)

### 4. Common Error Patterns

**Pattern:** `ECONNREFUSED` or `ETIMEDOUT`
**Cause:** Database connection issues
**Solution:** Check DATABASE_URL and network connectivity

**Pattern:** `Invalid hook call` or React errors
**Cause:** Version mismatch or SSR issues
**Solution:** Check React/Next.js versions and SSR compatibility

**Pattern:** `Module not found`
**Cause:** Missing dependencies or build issues
**Solution:** Clear cache, check package.json, rebuild

Remember to check the AWS Amplify build logs for specific error messages and stack traces. 