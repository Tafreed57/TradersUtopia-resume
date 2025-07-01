# AWS Amplify Hosting Deployment Guide

This guide will walk you through deploying your Next.js Discord clone to **AWS Amplify Hosting** (Git-based continuous deployment).

> **Important:** This guide is for **Amplify Hosting** only, not Amplify CLI backend deployment. Your app uses external services (PostgreSQL, Clerk, Stripe, etc.) instead of Amplify backend services.

## Prerequisites

1. **AWS Account**: You'll need an active AWS account
2. **GitHub Repository**: Your code should be pushed to GitHub
3. **External Services**: Set up these services before deployment:
   - PostgreSQL database (recommend Supabase, Railway, or AWS RDS)
   - Clerk account for authentication
   - Stripe account for payments
   - LiveKit account for video/audio
   - Resend account for emails
   - UploadThing account for file uploads

## Step 1: Prepare Your Environment Variables

Before deploying, gather all the required environment variables listed in `.env.example`.

### Required Environment Variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@hostname:5432/database?schema=public"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"

# Stripe Payment
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# LiveKit (Video/Audio)
LIVEKIT_API_KEY="API_KEY"
LIVEKIT_API_SECRET="API_SECRET"
NEXT_PUBLIC_LIVEKIT_URL="wss://your-livekit-instance.livekit.cloud"

# Email (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# App URLs (IMPORTANT: Update after deployment)
NEXT_PUBLIC_APP_URL="https://your-app-name.amplifyapp.com"
NEXT_PUBLIC_SITE_URL="https://your-app-name.amplifyapp.com"

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BM..."
VAPID_PRIVATE_KEY="..."

# File Upload (UploadThing)
UPLOADTHING_SECRET="sk_live_..."
UPLOADTHING_APP_ID="your-app-id"
```

## Step 2: Database Setup

1. **Create a PostgreSQL database** using one of these services:
   - [Supabase](https://supabase.com/) (Recommended)
   - [Railway](https://railway.app/)
   - [AWS RDS](https://aws.amazon.com/rds/)
   - [Neon](https://neon.tech/)

2. **Get your DATABASE_URL** and note it down for later

## Step 3: Push to GitHub

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for AWS Amplify deployment"
git push origin main
```

## Step 4: Deploy to AWS Amplify

### 4.1 Access AWS Amplify Console

1. Sign in to the [AWS Management Console](https://aws.amazon.com/console/)
2. Search for "Amplify" and select **AWS Amplify**
3. Click **"Get Started"** or **"Create new app"**

### 4.2 Connect Repository

1. Select **"Deploy an app"**
2. Choose **GitHub** as your Git provider
3. Click **"Next"** and authorize AWS Amplify to access your GitHub account
4. Select your repository and the `main` branch
5. Click **"Next"**

### 4.3 Configure Build Settings

1. **App name**: Enter your desired app name
2. **Build settings**: AWS Amplify should automatically detect this as a Next.js app
3. **Environment variables**: This is where you'll add all your environment variables
4. **Service role**: Create a new service role or use an existing one
5. Click **"Next"**

### 4.4 Add Environment Variables

In the **Environment variables** section, add all the variables from your `.env.example` file:

**Important Notes:**
- Don't add `NODE_ENV` - Amplify sets this automatically
- Initially use temporary URLs for `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL`
- You'll update these URLs after the first deployment

### 4.5 Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. Wait for the deployment to complete (usually 5-10 minutes)

## Step 5: Update App URLs

After the first deployment:

1. Copy the generated Amplify URL (e.g., `https://main.d1234567890.amplifyapp.com`)
2. Go to **Environment variables** in the Amplify console
3. Update these variables:
   - `NEXT_PUBLIC_APP_URL`: Your Amplify URL
   - `NEXT_PUBLIC_SITE_URL`: Your Amplify URL
4. Trigger a new deployment

## Step 6: Database Migration

Since this is the first deployment, you need to run database migrations:

1. **Option A: Use a local connection** (if your database allows external connections):
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

2. **Option B: Add migration to build process** (temporary):
   - Edit `amplify.yml` to add migration commands
   - Deploy again
   - Remove migration commands after first successful run

## Step 7: Configure Webhooks

### Stripe Webhooks
1. Go to your Stripe Dashboard
2. Navigate to **Developers > Webhooks**
3. Create a new webhook endpoint: `https://your-amplify-url.amplifyapp.com/api/webhooks/stripe`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook secret and update your `STRIPE_WEBHOOK_SECRET` environment variable

## Step 8: Test Your Deployment

1. Visit your deployed app URL
2. Test key functionality:
   - User authentication (sign up/sign in)
   - Creating servers and channels
   - Sending messages
   - Payment flow (if applicable)
   - Video/audio calls

## Step 9: Custom Domain (Optional)

1. In the Amplify console, go to **Domain management**
2. Click **"Add domain"**
3. Follow the instructions to configure your custom domain
4. Update your environment variables with the new domain

## Troubleshooting

### Build Failures

**Prisma Issues:**
- Ensure `binaryTargets` includes AWS Lambda binaries
- Check that `DATABASE_URL` is correctly set

**Environment Variable Issues:**
- Verify all required variables are set
- Check for typos in variable names
- Ensure URLs don't have trailing slashes

**Next.js Build Issues:**
- Check the build logs in Amplify console
- Ensure all dependencies are listed in `package.json`

### Runtime Issues

**Database Connection:**
- Verify DATABASE_URL is correct
- Check if your database allows connections from AWS
- Consider using connection pooling (PgBouncer)

**Authentication Issues:**
- Verify Clerk configuration
- Check Clerk webhook URLs match your deployment
- Update redirect URLs in Clerk dashboard

**Payment Issues:**
- Verify Stripe webhook endpoint is correct
- Check webhook events are properly configured
- Ensure webhook secret matches

## Performance Optimization

1. **Database Connection Pooling**: Use PgBouncer or similar for better database performance
2. **Caching**: Enable Next.js caching for better performance
3. **CDN**: Amplify automatically provides CDN capabilities

## Security Considerations

1. **Environment Variables**: Never commit actual secrets to Git
2. **Database**: Use SSL connections for database
3. **HTTPS**: Amplify automatically provides HTTPS
4. **Headers**: Security headers are configured in `next.config.mjs`

## Monitoring and Logs

1. **Amplify Console**: Monitor deployments and view build logs
2. **CloudWatch**: Access detailed application logs
3. **Error Tracking**: Consider integrating Sentry or similar tools

## Scaling

AWS Amplify automatically handles scaling, but consider:
- Database connection limits
- Stripe rate limits
- LiveKit capacity limits

## Cost Optimization

1. **Amplify Pricing**: Review Amplify pricing tiers
2. **Database**: Choose appropriate database tier
3. **CDN**: Amplify includes CDN in pricing
4. **External Services**: Monitor usage of Stripe, LiveKit, etc.

---

**Need Help?**
- Check AWS Amplify documentation
- Review build logs for specific error messages
- Verify all external service configurations
- Test locally before deploying 