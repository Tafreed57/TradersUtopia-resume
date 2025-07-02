# TradersUtopia Discord Collector - AWS Amplify Functions

Perfect integration with your existing Amplify setup! This converts your Discord message collector to use [AWS Amplify Functions](https://docs.amplify.aws/nextjs/build-a-backend/functions/) instead of standalone Docker containers.

## 🚀 Quick Start

**Ready to go!** The Amplify Function structure has been created for you. Follow these steps:

```bash
# 1. Install Amplify dependencies (already done ✅)
pnpm install @aws-amplify/backend @aws-amplify/backend-cli aws-cdk-lib constructs

# 2. Install function dependencies (already done ✅)
cd amplify/functions/discord-collector && npm install && npx prisma generate

# 3. Configure your secrets in AWS
aws secretsmanager create-secret \
    --name "tradersutopia/database-url" \
    --secret-string "your-neon-database-url"

aws secretsmanager create-secret \
    --name "tradersutopia/discord-token" \
    --secret-string "Bot your-discord-bot-token"

# 4. Test with sandbox
npx ampx sandbox

# 5. Deploy to production
npx ampx pipeline-deploy --branch main
```

## 🏗️ Amplify Functions Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EventBridge   │    │ Amplify Function│    │   Neon Database │
│   (15s cron)    │───►│   (Lambda)      │───►│   PostgreSQL    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                       ┌─────────────────┐
                       │   Next.js App   │
                       │  (Same Amplify) │
                       │  Reads Messages │
                       └─────────────────┘
```

## 🚀 Benefits of Amplify Functions

✅ **Integrated**: Part of your existing Amplify project  
✅ **No Docker**: Zero Docker configuration needed  
✅ **Cost Effective**: ~$5-10/month (serverless pricing)  
✅ **Same Deploy**: Deploys with your Next.js app  
✅ **TypeScript**: Full TypeScript support  
✅ **Environment Variables**: Managed through Amplify  
✅ **Automatic Scheduling**: Built-in EventBridge integration  

## 📁 What's Been Created

```
amplify/
├── backend.ts                               # 🆕 Main backend configuration
└── functions/
    └── discord-collector/
        ├── resource.ts                      # 🆕 Function definition
        ├── handler.ts                       # 🆕 Lambda handler
        ├── package.json                     # 🆕 Function dependencies
        ├── tsconfig.json                    # 🆕 TypeScript config
        ├── prisma/schema.prisma             # 🆕 Database schema
        ├── config/discord-config.json       # 🆕 Discord channels config
        └── lib/                             # 🆕 Discord logic
            ├── messageCollector.ts          #     Collection service
            ├── sourceChannelService.ts      #     Channel handler
            ├── messageSanitizer.ts          #     Content filtering
            └── types.ts                     #     TypeScript types
```

## 🛠️ Setup Instructions

### Step 1: Install Amplify Dependencies

```bash
# Install Amplify Gen 2 dependencies
npm install @aws-amplify/backend @aws-amplify/backend-cli aws-cdk-lib constructs

# Or with pnpm
pnpm install @aws-amplify/backend @aws-amplify/backend-cli aws-cdk-lib constructs
```

### Step 2: Install Function Dependencies

```bash
# Install dependencies for the Discord function
cd amplify/functions/discord-collector
npm install

# Generate Prisma client
npx prisma generate
cd ../../..
```

### Step 3: Configure Secrets

Create your secrets in AWS Secrets Manager:

```bash
# Database URL
aws secretsmanager create-secret \
    --name "tradersutopia/database-url" \
    --description "Neon Database URL for TradersUtopia" \
    --secret-string "your-neon-database-url"

# Discord Bot Token
aws secretsmanager create-secret \
    --name "tradersutopia/discord-token" \
    --description "Discord Bot Token for TradersUtopia" \
    --secret-string "Bot your-discord-bot-token"
```

### Step 4: Test Locally (Sandbox)

```bash
# Start Amplify sandbox for local development
npx ampx sandbox

# This will:
# - Deploy your function to AWS
# - Set up EventBridge scheduling
# - Provide real-time logs
```

### Step 5: Deploy to Production

```bash
# Deploy the function with your Next.js app
npx ampx pipeline-deploy --branch main

# Or through Amplify Console
# Your function will automatically deploy with your app
```

## 🔧 Configuration

### Function Settings

The Discord function is configured in `amplify/functions/discord-collector/resource.ts`:

- **Timeout**: 300 seconds (5 minutes)
- **Memory**: 512 MB
- **Schedule**: Every 15 seconds via EventBridge
- **Runtime**: Node.js 18 (managed by Amplify)

### Environment Variables

Variables are automatically managed:
- **Secrets**: Retrieved from AWS Secrets Manager
- **Database**: Connected to your existing Neon database
- **Discord Config**: Loaded from `config/discord-config.json`

### Discord Channels

Update channels in `amplify/functions/discord-collector/config/discord-config.json`:

```json
{
  "source_channels": {
    "channel-name": "discord-channel-id",
    "another-channel": "another-channel-id"
  },
  "string_filters": ["unwanted-text", "spam"],
  "polling_interval": 15,
  "message_batch_size": 15
}
```

## 📊 Monitoring

### Amplify Console

Monitor your function through the Amplify Console:
- Function execution logs
- Error rates and performance
- Billing and usage metrics

### CloudWatch Logs

```bash
# View real-time logs during sandbox
npx ampx sandbox --outputs-file amplify_outputs.json

# View logs in AWS Console
# CloudWatch > Log Groups > /aws/lambda/amplify-*-discord-collector
```

### Function Testing

```bash
# Test the function locally
cd amplify/functions/discord-collector
node -e "
const { handler } = require('./dist/handler.js');
handler({
  source: 'aws.events',
  'detail-type': 'Scheduled Event',
  time: new Date().toISOString()
}, {
  callbackWaitsForEmptyEventLoop: false,
  getRemainingTimeInMillis: () => 30000
}).then(console.log).catch(console.error);
"
```

## 🔍 Troubleshooting

### Common Issues

1. **Function Not Triggering:**
   ```bash
   # Check EventBridge rule
   aws events list-rules --name-prefix amplify
   
   # Verify function permissions
   aws lambda get-policy --function-name amplify-*-discord-collector
   ```

2. **Database Connection Issues:**
   ```bash
   # Test secret access
   aws secretsmanager get-secret-value --secret-id tradersutopia/database-url
   
   # Check function environment
   aws lambda get-function-configuration --function-name amplify-*-discord-collector
   ```

3. **Build Errors:**
   ```bash
   # Clean and rebuild
   rm -rf amplify/functions/discord-collector/node_modules
   cd amplify/functions/discord-collector
   npm install
   npx prisma generate
   ```

### Debug Commands

```bash
# View Amplify status
npx ampx configure list

# Check function logs
npx ampx generate outputs --branch main

# View deployment status
npx ampx status
```

## 🔄 Development Workflow

### Making Changes

1. **Edit Function Code**: Modify files in `amplify/functions/discord-collector/`
2. **Test Locally**: Use `npx ampx sandbox` for immediate testing
3. **Deploy**: Commit and push, or use `npx ampx pipeline-deploy`

### Adding Channels

1. **Update Config**: Edit `amplify/functions/discord-collector/config/discord-config.json`
2. **Redeploy**: Push changes or use sandbox
3. **Monitor**: Check CloudWatch logs for new channel activity

### Environment Updates

```bash
# Update secrets
aws secretsmanager update-secret \
    --secret-id tradersutopia/discord-token \
    --secret-string "Bot new-discord-token"

# Function will automatically use new values on next execution
```

## 💰 Cost Optimization

### Current Estimate

- **Executions**: ~2,400/hour × 24 × 30 = 1.7M/month
- **Duration**: ~2 seconds average
- **Cost**: ~$5-10/month (much cheaper than containers)

### Optimization Tips

1. **Reduce Polling**: Increase interval from 15 to 30 seconds if acceptable
2. **Batch Processing**: Process multiple channels efficiently
3. **Connection Reuse**: Keep database connections warm between invocations

## 🛡️ Security

- ✅ **IAM Roles**: Minimal permissions for secrets and logging
- ✅ **Secrets Manager**: Encrypted credential storage
- ✅ **VPC**: Optional VPC integration if needed
- ✅ **Amplify Security**: Built-in security best practices

## 🎯 Integration with Your App

### Reading Messages

Your Next.js app continues to work exactly as before:

```typescript
// Your existing message reading code works unchanged
const messages = await prisma.discordMessage.findMany({
  where: { channelName: 'bitcoin-bulls' },
  orderBy: { timestamp: 'desc' }
});
```

### Real-time Updates

Since messages are stored in the same database, your existing real-time subscriptions and API routes continue working without changes.

## 🚀 Next Steps

1. **Install Dependencies**: `pnpm install` in root and function directories
2. **Configure Secrets**: Set up AWS Secrets Manager
3. **Test Sandbox**: `npx ampx sandbox` for immediate testing
4. **Deploy**: Push to your main branch for production deployment

Your Discord collector is now fully integrated with Amplify! 🎉

## 📞 Support

For issues:
1. Check Amplify Console logs
2. Review CloudWatch logs: `/aws/lambda/amplify-*-discord-collector`
3. Test function with sandbox: `npx ampx sandbox`
4. Verify secrets in AWS Secrets Manager

The Amplify Functions approach is the cleanest solution since it's fully integrated with your existing Amplify setup! 🚀 