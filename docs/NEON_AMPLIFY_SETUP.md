# Neon + AWS Amplify Integration Setup Guide

This guide walks you through setting up your repository to work with AWS Amplify Hosting and NeonDB with database branching, based on the [Neon article](https://neon.com/blog/fullstack-serverless-ci-cd-in-aws-amplify-hosting-with-postgres-database-branching).

## ✅ Already Configured in Your Repository

Your repository is already configured with:
- ✅ `amplify.yml` CI/CD configuration 
- ✅ `neon-ci.sh` script for database branch management
- ✅ Neon serverless driver (`@neondatabase/serverless`)
- ✅ Prisma schema configured to use `DATABASE_URL`
- ✅ AWS Amplify Gen 2 backend setup

## 🔧 What You Need to Configure

### 1. Create a Neon Project

1. Go to [Neon Console](https://console.neon.tech)
2. Sign up/sign in and create a new project
3. Note down your **Project ID** from the project dashboard

### 2. Get Your Neon API Key

1. In Neon Console, go to **Account Settings** → **API Keys**
2. Create a new API key
3. Copy the API key (you'll store this in AWS SSM)

### 3. Update amplify.yml Configuration

In your `amplify.yml` file, replace `YOUR_NEON_PROJECT_ID` with your actual Neon project ID:

```yaml
bash neon-ci.sh create-branch --app-id $AWS_APP_ID --neon-project-id YOUR_ACTUAL_PROJECT_ID --branch-name $AWS_BRANCH --parent-branch main --api-key-param "neon-api-key" --role-name neondb_owner --database-name neondb --suspend-timeout 0
```

### 4. AWS Setup - What You Need to Do in AWS Console

#### A. Create Amplify App
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Connect your GitHub repository
3. Choose **Amazon Linux: 2023** as build image
4. Enable automatic service role creation

#### B. Store Neon API Key in SSM Parameter Store
1. Go to [AWS Systems Manager Console](https://console.aws.amazon.com/systems-manager/)
2. Navigate to **Parameter Store**
3. Click **Create parameter**
4. Configure:
   - **Name**: `neon-api-key`
   - **Type**: `SecureString`
   - **Value**: Your Neon API key from step 2

#### C. Update IAM Role Permissions

Find your Amplify service role in [AWS IAM Console](https://console.aws.amazon.com/iam/) and add these inline policies:

**Policy 1: SSM Parameter Store Access**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAmplifySSMCalls",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParametersByPath",
        "ssm:GetParameters",
        "ssm:GetParameter"
      ],
      "Resource": ["arn:aws:ssm:*:*:parameter/neon-api-key"]
    }
  ]
}
```

**Policy 2: Amplify Access**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AmplifyBranchAccess",
      "Effect": "Allow",
      "Action": "amplify:ListBranches",
      "Resource": "arn:aws:amplify:*:*:apps/*/branches/*"
    }
  ]
}
```

#### D. Enable Branch Auto-Detection
1. In Amplify Console, go to your app
2. Navigate to **App settings** → **General**
3. Scroll to **Repository details**
4. Enable **Branch auto-detection**
5. Set pattern to match your branch naming (e.g., `*` for all branches)

## 🚀 How It Works

### Automatic Database Branching Flow

1. **Push a new Git branch** → Amplify creates a new app branch
2. **CI/CD runs** → `neon-ci.sh` script executes
3. **Database branch created** → Script creates corresponding Neon DB branch
4. **Environment variable set** → `DATABASE_URL` is injected into `.env`
5. **App deployed** → Your app has access to isolated database branch

### Example: Using Neon in Your API Routes

```typescript
// src/app/api/example/route.ts
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const result = await sql`SELECT version()`;
    return Response.json({ version: result[0].version });
  } catch (error) {
    return Response.json({ error: 'Database connection failed' }, { status: 500 });
  }
}
```

## 🔄 Database Migrations

Your existing database migrations will work automatically:

```bash
# Migrations run during build process
npx prisma migrate deploy
```

The `DATABASE_URL` environment variable is automatically set by the `neon-ci.sh` script during the CI/CD process.

## 🧹 Branch Cleanup (Optional)

To enable automatic cleanup of database branches when Git branches are deleted, uncomment the cleanup line in your `amplify.yml`:

```yaml
postBuild:
  commands:
    - |
      if ! [ "${AWS_BRANCH}" = "main" ] && ! [ "${AWS_BRANCH}" = "dev" ]; then
        bash neon-ci.sh cleanup-branches --app-id $AWS_APP_ID --neon-project-id YOUR_NEON_PROJECT_ID --api-key-param "neon-api-key"
      fi
```

⚠️ **Test this thoroughly in development before enabling in production!**

## 🔍 Monitoring & Troubleshooting

### Check Build Logs
- Monitor Amplify build logs for database branch creation
- Look for `neon-ci.sh` output in the backend build phase

### Verify Database Branches
- Check Neon Console to see created branches
- Each branch will be named: `{amplify-app-id}-{git-branch-name}`

### Common Issues
- **SSM Permission Denied**: Check IAM role has correct SSM policy
- **Neon API Error**: Verify API key is correct and stored as SecureString
- **Branch Creation Failed**: Check Neon project ID in amplify.yml

## 📚 Additional Resources

- [Original Neon Article](https://neon.com/blog/fullstack-serverless-ci-cd-in-aws-amplify-hosting-with-postgres-database-branching)
- [Neon Documentation](https://neon.tech/docs)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Neon Serverless Driver](https://github.com/neondatabase/serverless)

## ✅ Checklist

- [ ] Created Neon project and got Project ID
- [ ] Created Neon API key
- [ ] Updated `amplify.yml` with your Project ID
- [ ] Created Amplify app with Amazon Linux 2023
- [ ] Stored API key in SSM Parameter Store as `neon-api-key`
- [ ] Added SSM and Amplify permissions to service role
- [ ] Enabled branch auto-detection
- [ ] Pushed a test branch to verify setup

Once completed, every new Git branch will automatically get its own isolated database branch! 🎉 