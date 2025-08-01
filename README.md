# TRADERSUTOPIA

A full-featured real-time communication platform with subscription management, built with Next.js 14, TypeScript, and modern web technologies.

## Local Development Setup

### Prerequisites

- Node.js 18+ 
- pnpm (recommended package manager)
- PostgreSQL database (local or cloud)
- Stripe CLI for webhook testing
- ngrok for secure tunneling (optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TRADERSUTOPIA
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Development Commands**
   ```bash
   # Standard development mode (Next.js + Trigger.dev)
   pnpm dev

   # Development with detailed debug logging
   pnpm dev --debug
   # or
   pnpm dev:debug

   # Development with verbose logging  
   pnpm dev --verbose
   # or
   pnpm dev:verbose

   # Next.js only (without Trigger.dev)
   pnpm dev:next

   # Clean build and start development
   pnpm dev:clean
   ```

4. **Set up environment variables**
   
   Create a `.env.local` file in the root directory and add the following variables:

   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/tradersutopia"

   # Authentication (Clerk)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."
   CLERK_WEBHOOK_SIGNING_SECRET="whsec_..."
   NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
   NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"

   # Payments (Stripe)
   STRIPE_API_KEY="sk_test_..."
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."

   # File Uploads (UploadThing)
   UPLOADTHING_SECRET="sk_live_..."
   UPLOADTHING_APP_ID="your-app-id"

   # Push Notifications (VAPID)
   NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
   VAPID_PRIVATE_KEY="your-vapid-private-key"
   VAPID_EMAIL="your-email@example.com"

   # App Configuration
   NEXT_PUBLIC_SITE_URL="http://localhost:3000"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   pnpm prisma generate

   # Run database migrations
   pnpm prisma db push

   # (Optional) Seed the database
   pnpm prisma db seed
   ```

5. **Set up webhook forwarding for local development**

   **For Stripe webhooks:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   **For secure tunneling (optional):**
   ```bash
   ngrok http --url=ringtail-modest-gull.ngrok-free.app 3000
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000)

### Important Notes

- **Stripe CLI**: Make sure you have the Stripe CLI installed and configured with your Stripe account
- **Webhook Secret**: After running `stripe listen`, copy the webhook signing secret and add it to your `.env.local` as `STRIPE_WEBHOOK_SECRET`
- **Database Setup**: Ensure your PostgreSQL database is running and accessible with the provided `DATABASE_URL`
- **Environment Variables**: All environment variables are required for the application to function properly

### Development Workflow

1. **Database Schema Changes**: After modifying `prisma/schema.prisma`, run:
   ```bash
   pnpm prisma db push
   pnpm prisma generate
   ```

2. **Testing Payments**: Use Stripe's test card numbers for payment testing
3. **File Uploads**: Configure UploadThing for file upload functionality
4. **Push Notifications**: Generate VAPID keys for push notification testing

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Payments**: Stripe
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **File Uploads**: UploadThing
- **Push Notifications**: Web Push API
- **Package Manager**: pnpm

### Troubleshooting

- **Database Connection Issues**: Verify your `DATABASE_URL` is correct and the database is running
- **Webhook Issues**: Ensure Stripe CLI is running and the webhook secret is correctly set
- **Authentication Issues**: Check Clerk configuration and environment variables
- **Build Issues**: Clear `.next` folder and reinstall dependencies if needed
