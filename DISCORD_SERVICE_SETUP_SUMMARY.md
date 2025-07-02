# Discord Service Setup - Complete Solution

I've created a complete standalone Discord message collection service that runs separately from your Next.js application on AWS. Here's what's been set up:

## 🏗️ What's Been Created

### `/discord-bot/` Directory Structure
```
discord-bot/
├── src/
│   ├── index.ts                    # Main service entry point
│   └── lib/discord/                # Discord library (copied from your main app)
│       ├── messageCollector.ts     # Message collection service
│       ├── sourceChannelService.ts # Individual channel handler
│       ├── messageSanitizer.ts     # Content filtering
│       ├── types.ts               # TypeScript interfaces
│       └── constants.ts           # Discord constants
├── prisma/
│   └── schema.prisma              # Database schema (Discord models only)
├── config/
│   └── discord-config.json        # Channel and filter configuration
├── aws/
│   ├── task-definition.json       # ECS task configuration
│   └── service-definition.json    # ECS service configuration
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── Dockerfile                     # Container configuration
├── deploy.sh                      # Automated deployment script
└── README.md                      # Complete setup instructions
```

## 🚀 Key Features

✅ **Standalone Service**: Completely separate from your Next.js app
✅ **AWS ECS Fargate**: Serverless container hosting
✅ **35+ Discord Channels**: Monitors all your configured channels
✅ **Message Filtering**: Advanced content sanitization
✅ **Database Integration**: Uses your existing Neon PostgreSQL
✅ **Health Monitoring**: Auto-restart on failures
✅ **Secure Deployment**: Secrets stored in AWS Secrets Manager
✅ **Cost Optimized**: Runs on minimal resources (0.25 vCPU, 512MB RAM)

## 🔄 How It Works

1. **Service starts** on AWS ECS Fargate
2. **Connects to your Neon database** using existing Discord message tables
3. **Polls 35+ Discord channels** every 15 seconds
4. **Filters and sanitizes messages** using your existing rules
5. **Stores messages** in the same database your Next.js app reads from
6. **Your Next.js app continues** to read messages normally

## 📋 Next Steps for You

### 1. Review the Setup
```bash
cd discord-bot
cat README.md  # Review the complete instructions
```

### 2. Configure AWS Credentials
Make sure your AWS CLI is configured:
```bash
aws configure
```

### 3. Get Your Discord Bot Token
- Go to Discord Developer Portal
- Create a new application/bot
- Copy the bot token
- Ensure it has message read permissions in your channels

### 4. Update Configuration Files
Edit these files with your specific details:

**`discord-bot/aws/task-definition.json`:**
- Replace `YOUR_ACCOUNT_ID` with your AWS account ID
- Update secret ARNs to match your AWS region

**`discord-bot/aws/service-definition.json`:**
- Update `subnet-xxxxxxxxx` with your actual subnet IDs
- Update `sg-xxxxxxxxx` with your security group ID

**`discord-bot/deploy.sh`:**
- Set `AWS_ACCOUNT_ID` to your AWS account ID
- Adjust `AWS_REGION` if not using us-east-1

### 5. Run the Deployment
```bash
cd discord-bot

# Make script executable (already done)
chmod +x deploy.sh

# Set up environment for testing
cp .env.example .env
# Edit .env with your DATABASE_URL and DISCORD_AUTH_TOKEN

# Test locally first (optional)
pnpm install
npx prisma generate
pnpm run dev

# Deploy to AWS
./deploy.sh
```

## 🎯 Benefits of This Approach

### For Your Application
- **Separation of Concerns**: Discord collection doesn't affect your main app
- **Better Performance**: Main app isn't slowed down by Discord polling
- **Independent Scaling**: Scale Discord service separately from web app
- **Fault Isolation**: If Discord service fails, your main app keeps running

### For AWS Amplify
- **No Code Changes Needed**: Your Next.js app continues working as-is
- **Cleaner Deployments**: Discord logic doesn't affect web app deployments
- **Better Resource Allocation**: Each service uses appropriate resources

### Cost & Maintenance
- **Cost Effective**: ~$10-15/month for the Discord service
- **Auto-Scaling**: Scales up/down based on demand
- **Managed Infrastructure**: AWS handles server maintenance
- **Easy Updates**: Deploy changes without touching main app

## 🔧 Integration with Your Existing Code

The service uses the **exact same database tables** your Next.js app already uses:
- `messages` table (Discord messages)
- `channel_metadata` table (channel tracking)

Your existing Next.js code for reading Discord messages requires **no changes**.

## 📊 Monitoring & Management

Once deployed, you can monitor the service through:
- **AWS ECS Console**: Service health and task status
- **CloudWatch Logs**: Real-time service logs
- **CloudWatch Metrics**: CPU, memory, and custom metrics

## 🆘 Support & Troubleshooting

If you encounter issues:
1. Check the `discord-bot/README.md` for detailed troubleshooting
2. Review CloudWatch logs for error messages
3. Verify your Discord bot token and database connection
4. Ensure your AWS IAM permissions are correct

## 🎉 Summary

You now have a production-ready, standalone Discord message collection service that:
- Runs independently on AWS ECS Fargate
- Collects messages from all your Discord channels
- Stores them in your existing Neon database
- Allows your Next.js app to continue working unchanged
- Provides better performance, scalability, and maintainability

The next step is to follow the setup instructions in `discord-bot/README.md` and deploy the service to AWS! 