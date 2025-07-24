# Trigger.dev AWS Amplify Deployment Guide

## Overview

This guide covers deploying TRADERSUTOPIA with Trigger.dev background tasks on AWS Amplify. The setup includes automated task deployment during the AWS Amplify build process.

## 🚀 What's Configured

### AWS Amplify Integration
- **Automatic Task Deployment**: Trigger.dev tasks deploy automatically during AWS Amplify builds
- **Environment Variable Management**: Production secrets are properly configured
- **Build Optimization**: Optimized for AWS Amplify's build environment
- **Fallback Handling**: Build continues even if Trigger.dev deployment fails

### Background Task Optimizations
- **Batch Processing**: Notifications processed in batches of 10 for better performance
- **Retry Logic**: Automatic retries with exponential backoff
- **Memory Optimization**: Reduced memory footprint for AWS Lambda
- **Timeout Management**: 5-minute timeout for notification tasks

## 📋 Prerequisites

### 1. Trigger.dev Account Setup
1. Create account at [https://cloud.trigger.dev](https://cloud.trigger.dev)
2. Create a new project
3. Get your production secret key

### 2. AWS Amplify Environment Variables
Add these to your AWS Amplify environment variables:

```env
# Trigger.dev Production Configuration
TRIGGER_SECRET_KEY=tr_prod_your_production_secret_key_here

# Your existing environment variables...
DATABASE_URL=your_production_database_url
STRIPE_SECRET_KEY=your_stripe_secret
CLERK_SECRET_KEY=your_clerk_secret
# ... etc
```

### 3. Trigger.dev Project Configuration
Update your project settings in Trigger.dev dashboard:
- **Project ID**: `proj_dggewuwolwsrvedcloti` (already configured)
- **Environment**: Production
- **Runtime**: Node.js (configured)

## 🔧 Deployment Process

### Automatic Deployment (Recommended)
AWS Amplify automatically deploys Trigger.dev tasks during the build process:

1. **Trigger Deployment**: Push to your main branch
2. **AWS Amplify Build**: 
   - Deploys Trigger.dev tasks first
   - Builds Next.js application
   - Deploys to production
3. **Verification**: Check Trigger.dev dashboard for deployed tasks

### Manual Deployment
For manual deployments or testing:

```bash
# Deploy to production
pnpm run trigger:deploy:prod

# Deploy to development
pnpm run trigger:deploy
```

## 📁 File Structure

```
src/
├── trigger/
│   └── send-message-notifications.ts  # Background notification task
├── app/
│   └── api/
│       ├── messages/
│       │   └── route.ts               # Triggers background tasks
│       └── test-notifications/
│           └── route.ts               # Test endpoint
└── ...

trigger.config.ts                      # Trigger.dev configuration
amplify.yml                           # AWS Amplify build configuration
```

## ⚙️ Configuration Details

### trigger.config.ts
```typescript
export default defineConfig({
  project: "proj_dggewuwolwsrvedcloti",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});
```

### AWS Amplify Build Configuration
The `amplify.yml` includes:
- Environment variable setup
- Trigger.dev task deployment
- Next.js application build
- Database migrations

## 🔒 Security Considerations

### Environment Variables
- ✅ Production secrets stored in AWS Amplify environment variables
- ✅ No sensitive data in code repository
- ✅ Separate development and production environments

### Task Security
- ✅ All authentication and authorization checks preserved
- ✅ Input validation maintained
- ✅ Rate limiting applied to API endpoints (not background tasks)
- ✅ Subscription and admin status verification

## 📊 Monitoring & Logging

### Trigger.dev Dashboard
- **Real-time Monitoring**: View task execution in real-time
- **Error Tracking**: Detailed error logs and stack traces
- **Performance Metrics**: Task duration and success rates
- **Retry Tracking**: Monitor retry attempts and patterns

### AWS Amplify Logs
- **Build Logs**: Check AWS Amplify build logs for deployment issues
- **Function Logs**: Monitor Next.js API route logs
- **Error Tracking**: AWS CloudWatch integration

## 🧪 Testing

### Development Testing
```bash
# Start development servers
pnpm run dev

# Test notification task
curl -X POST http://localhost:3000/api/test-notifications
```

### Production Testing
```bash
# Test production notification endpoint
curl -X POST https://your-app.amplifyapp.com/api/test-notifications
```

### Manual Task Triggering
In the Trigger.dev dashboard:
1. Navigate to your project
2. Go to "Tasks" → "send-message-notifications"
3. Click "Run test"
4. Use test payload:
```json
{
  "messageId": "test-message-id",
  "senderId": "test-sender-id",
  "senderName": "Test User",
  "channelId": "test-channel-id",
  "serverId": "test-server-id",
  "content": "Test message content"
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Build Fails During Trigger.dev Deployment
**Error**: `Trigger.dev deployment failed`
**Solution**: 
- Check `TRIGGER_SECRET_KEY` in AWS Amplify environment variables
- Verify project ID in `trigger.config.ts`
- Check Trigger.dev dashboard for project status

#### 2. Tasks Not Appearing in Dashboard
**Error**: Tasks not visible after deployment
**Solution**:
- Verify correct project ID in configuration
- Check build logs for deployment errors
- Ensure environment variables are set correctly

#### 3. Background Tasks Not Triggering
**Error**: Messages sent but no notifications processed
**Solution**:
- Check AWS Amplify function logs
- Verify `TRIGGER_SECRET_KEY` is set in production
- Test with the test endpoint first

#### 4. Task Timeouts
**Error**: Tasks timing out during execution
**Solution**:
- Check notification batch sizes (currently 10)
- Monitor database connection performance
- Review task logs in Trigger.dev dashboard

### Debug Steps

1. **Check Environment Variables**:
   ```bash
   # In AWS Amplify console, verify all required env vars are set
   ```

2. **Verify Build Logs**:
   - AWS Amplify Console → Build logs
   - Look for Trigger.dev deployment status

3. **Monitor Task Execution**:
   - Trigger.dev Dashboard → Runs
   - Check for error messages and execution times

4. **Test API Endpoints**:
   ```bash
   # Test message creation
   curl -X POST https://your-app.amplifyapp.com/api/messages \
     -H "Content-Type: application/json" \
     -d '{"content":"test message"}'
   
   # Test notification task directly
   curl -X POST https://your-app.amplifyapp.com/api/test-notifications
   ```

## 🔄 Deployment Workflow

### Development → Production
1. **Local Development**:
   - Work with `pnpm run dev` (Next.js + Trigger.dev dev servers)
   - Test changes locally

2. **Staging/Testing**:
   - Deploy to development environment: `pnpm run trigger:deploy`
   - Test with development database

3. **Production Deployment**:
   - Push to main branch
   - AWS Amplify automatically builds and deploys
   - Trigger.dev tasks deploy automatically
   - Monitor deployment in both AWS and Trigger.dev dashboards

### Rollback Procedure
If issues arise in production:

1. **Quick Fix**: Revert code changes and redeploy
2. **Task-Specific Issues**: 
   - Disable problematic tasks in Trigger.dev dashboard
   - Deploy hotfix
   - Re-enable tasks after verification

## 📈 Performance Optimization

### AWS Amplify Optimizations
- **Memory Settings**: 14GB max old space for Node.js
- **Cache Management**: Optimized cache settings for faster builds
- **Dependencies**: Hoisted node modules for better performance

### Trigger.dev Optimizations
- **Batch Processing**: Process notifications in batches of 10
- **Sequential Batching**: Prevent overwhelming the system
- **Retry Logic**: Exponential backoff for failed notifications
- **Timeout Management**: 5-minute task timeout

## 📝 Environment Variable Checklist

Before deploying, ensure these are set in AWS Amplify:

- [ ] `TRIGGER_SECRET_KEY` (Production secret from Trigger.dev)
- [ ] `DATABASE_URL` (Your production database)
- [ ] `STRIPE_SECRET_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_STRIPE_CHECKOUT_URL`
- [ ] Other project-specific environment variables

## 🔗 Useful Commands

```bash
# Development
pnpm run dev                    # Start both Next.js and Trigger.dev dev servers
pnpm run dev:next              # Start only Next.js dev server
pnpm run trigger:dev           # Start only Trigger.dev dev server

# Deployment
pnpm run trigger:deploy        # Deploy to development environment
pnpm run trigger:deploy:prod   # Deploy to production environment

# Testing
curl -X POST http://localhost:3000/api/test-notifications          # Local test
curl -X POST https://your-app.amplifyapp.com/api/test-notifications # Production test
```

## 📚 Additional Resources

- [Trigger.dev Documentation](https://trigger.dev/docs)
- [AWS Amplify Hosting Guide](https://docs.amplify.aws/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Trigger.dev Next.js Integration](https://trigger.dev/docs/guides/frameworks/nextjs)

## 🎯 Success Checklist

After deployment, verify:

- [ ] AWS Amplify build completed successfully
- [ ] Trigger.dev tasks visible in dashboard
- [ ] Test notification endpoint works
- [ ] Message creation triggers background notifications
- [ ] Notification logs appear in Trigger.dev dashboard
- [ ] No errors in AWS Amplify function logs
- [ ] Performance metrics look healthy 