# Trigger.dev Background Task Setup

## Overview

This document outlines the implementation of Trigger.dev background tasks for processing message notifications in TRADERSUTOPIA. The notification processing has been moved from synchronous execution to background tasks for better performance and user experience.

## What Was Implemented

### 1. Trigger.dev Configuration
- **File**: `trigger.config.ts`
- **Purpose**: Main configuration for Trigger.dev integration
- **Note**: You'll need to update the `project` field with your actual project reference from Trigger.dev dashboard

### 2. Background Task
- **File**: `trigger/send-message-notifications.ts`
- **Purpose**: Handles all notification processing in the background
- **Features**:
  - Processes notifications for users with active subscriptions or admin status
  - Respects channel notification preferences
  - Handles mention detection
  - Comprehensive logging and error handling
  - Returns detailed success/failure statistics

### 3. Updated Messages Route
- **File**: `src/app/api/messages/route.ts`
- **Changes**: 
  - Replaced synchronous notification processing with background task trigger
  - Faster response times for message creation
  - Non-blocking notification processing

### 4. Test Route
- **File**: `src/app/api/test-notifications/route.ts`
- **Purpose**: Manual testing of the notification background task
- **Usage**: POST request to `/api/test-notifications`

### 5. Development Scripts
- **Updated**: `package.json`
- **New Scripts**:
  - `pnpm run dev`: Runs both Next.js and Trigger.dev dev servers concurrently
  - `pnpm run dev:next`: Runs only Next.js dev server
  - `pnpm run trigger:dev`: Runs only Trigger.dev dev server

## Required Setup Steps

### 1. Trigger.dev Account Setup
1. Create account at [https://cloud.trigger.dev](https://cloud.trigger.dev)
2. Create a new project
3. Get your project reference and secret key

### 2. Environment Variables
Add to your `.env.local` file:
```env
# Trigger.dev Configuration
TRIGGER_SECRET_KEY=your_trigger_secret_key_here
```

### 3. Update Configuration
Update `trigger.config.ts` with your actual project reference:
```typescript
export default defineConfig({
  project: "your-actual-project-ref", // Replace this
  dirs: ["./trigger"],
});
```

### 4. Login to Trigger.dev CLI
```bash
npx trigger.dev@latest login
```

### 5. Initialize Project (if needed)
```bash
npx trigger.dev@latest init
```

## Running the Application

### Development Mode
```bash
# Run both Next.js and Trigger.dev dev servers
pnpm run dev

# Or run separately
pnpm run dev:next  # Terminal 1
pnpm run trigger:dev  # Terminal 2
```

### Testing the Background Task

1. **Via Message Creation**: Send a message through the normal flow - notifications will be processed in the background

2. **Via Test Route**: 
   ```bash
   curl -X POST http://localhost:3000/api/test-notifications
   ```

3. **Monitor in Trigger.dev Dashboard**: Check the dashboard for task execution logs and status

## Key Benefits

### Performance Improvements
- ✅ Faster message creation response times
- ✅ Non-blocking notification processing
- ✅ Better user experience during high-traffic periods

### Reliability
- ✅ Automatic retries for failed notification tasks
- ✅ Detailed logging and error tracking
- ✅ Task status monitoring via dashboard

### Scalability
- ✅ Background processing scales independently
- ✅ Queue management for high-volume notifications
- ✅ Distributed task execution

## Task Flow

1. **Message Created**: User sends message via API
2. **Task Triggered**: Background notification task is queued
3. **Task Execution**: 
   - Fetches eligible users (active subscriptions + admins)
   - Checks channel notification preferences
   - Processes mentions
   - Creates individual notifications
   - Returns execution statistics
4. **Monitoring**: View task progress in Trigger.dev dashboard

## Security Considerations

All security measures from the original implementation are preserved:
- ✅ Subscription status verification
- ✅ Admin user privileges
- ✅ Channel access validation
- ✅ Rate limiting (on message creation)
- ✅ Input validation

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**: Ensure all dependencies are installed
2. **Task not triggering**: Check environment variables and Trigger.dev login
3. **Database connection issues**: Verify Prisma configuration in background tasks

### Debug Steps

1. Check Trigger.dev CLI output for connection issues
2. Verify environment variables are set correctly
3. Monitor dashboard for task execution logs
4. Check Next.js server logs for trigger errors

## Deployment Considerations

### Production Deployment
- Set `TRIGGER_SECRET_KEY` in production environment
- Update `trigger.config.ts` with production project reference
- Deploy tasks using: `npx trigger.dev@latest deploy`

### Environment Variables for Production
```env
TRIGGER_SECRET_KEY=prod_secret_key_here
```

## Files Modified/Created

### Created
- `trigger.config.ts`
- `trigger/send-message-notifications.ts`
- `src/app/api/test-notifications/route.ts`
- `docs/TRIGGER_DEV_SETUP.md`

### Modified
- `src/app/api/messages/route.ts`
- `package.json`

## Next Steps

1. Complete Trigger.dev account setup and login
2. Update configuration with your project details
3. Test the background task functionality
4. Deploy to production when ready
5. Monitor task performance via dashboard

## Support

- Trigger.dev Documentation: [https://trigger.dev/docs](https://trigger.dev/docs)
- Next.js Integration Guide: [https://trigger.dev/docs/guides/frameworks/nextjs](https://trigger.dev/docs/guides/frameworks/nextjs) 