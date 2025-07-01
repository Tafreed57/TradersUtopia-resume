# Product-Specific Paywall Setup Guide

This guide explains how to set up and configure the product-specific paywall that restricts dashboard access to users who have subscribed to specific Stripe products.

## What's Been Implemented

### 1. Database Changes
- Added `stripeProductId` field to the Profile model to track which specific Stripe product a user subscribed to
- Migration automatically applied when you run `npx prisma db push`

### 2. New API Endpoint
- `/api/check-product-subscription` - Checks if a user has subscribed to any of the allowed products

### 3. New Payment Gate Component
- `ProductPaymentGate` - A reusable component that only allows access to users with specific product subscriptions

### 4. Updated Dashboard
- Dashboard now uses the new product-specific payment gate instead of the generic one

## Configuration Steps

### Step 1: Get Your Stripe Product IDs

1. Go to your Stripe Dashboard
2. Navigate to Products → Product catalog
3. Click on the product you want to restrict access to
4. Copy the Product ID (starts with `prod_`)

Example: `prod_ABC123xyz456`

### Step 2: Update Dashboard Configuration

In `src/app/dashboard/page.tsx`, replace the example product IDs with your actual ones:

```typescript
const allowedProductIds = [
    "prod_ABC123xyz456", // Replace with your actual Stripe product ID
    "prod_DEF789uvw012", // Add more product IDs as needed
];
```

### Step 3: Update the Checkout Link

Replace the example checkout URL with your actual Stripe checkout link:

```typescript
upgradeUrl="https://buy.stripe.com/your-actual-checkout-link"
```

### Step 4: Customize the Product Information

Update the product name and features list:

```typescript
<ProductPaymentGate 
    allowedProductIds={allowedProductIds}
    productName="Your Product Name" // e.g., "Premium Trading Signals"
    upgradeUrl="https://buy.stripe.com/your-checkout-link"
    features={[
        "Your specific feature 1",
        "Your specific feature 2", 
        "Your specific feature 3"
    ]}
>
```

## How It Works

### For New Subscribers
1. User subscribes to one of your allowed products via Stripe
2. Stripe webhook updates their profile with `stripeProductId`
3. User gains immediate access to the dashboard

### For Existing Subscribers
1. User clicks "Verify My Payment with Stripe" 
2. System checks Stripe for active subscriptions to allowed products
3. If found, updates their profile and grants access

### Access Verification Flow
1. **Database Check**: First checks if user already has valid access in database
2. **Stripe Verification**: If not in database, checks Stripe for:
   - Active subscriptions with allowed products
   - Completed checkout sessions with allowed products
3. **Profile Update**: Updates user profile with the specific product ID
4. **Access Granted**: User can access the dashboard

## Multiple Product Support

You can allow access for multiple products:

```typescript
const allowedProductIds = [
    "prod_PremiumPlan",     // Premium monthly plan
    "prod_PremiumYearly",   // Premium yearly plan  
    "prod_VIPAccess",       // VIP tier
    "prod_LifetimeAccess"   // Lifetime access
];
```

## Security Features

- ✅ **Product-Specific**: Only checks for exact product matches
- ✅ **Stripe Verification**: Always verifies with Stripe before granting access
- ✅ **Database Caching**: Caches access status to reduce Stripe API calls
- ✅ **Expiration Tracking**: Tracks subscription end dates
- ✅ **Real-time Updates**: Stripe webhooks update access immediately

## Testing

### Test with Stripe Test Mode
1. Create test products in Stripe Dashboard
2. Use test product IDs in your configuration
3. Use Stripe test checkout links
4. Test the flow with test card numbers

### Verification
1. Check browser console for detailed logs
2. Use `/subscription-status` page to debug
3. Monitor Stripe Dashboard for webhook delivery

## Advanced Usage

### Different Products for Different Features

You can create multiple payment gates for different parts of your app:

```typescript
// Dashboard - requires premium access
<ProductPaymentGate allowedProductIds={["prod_premium"]}>
    <Dashboard />
</ProductPaymentGate>

// Admin panel - requires admin product
<ProductPaymentGate allowedProductIds={["prod_admin"]}>
    <AdminPanel />
</ProductPaymentGate>
```

### Combining with Server-Side Protection

For additional security, you can also check product access in API routes:

```typescript
// In any API route
import { db } from '@/lib/db';

const profile = await db.profile.findFirst({
    where: { 
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
        stripeProductId: { in: allowedProductIds }
    }
});

if (!profile) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

## Troubleshooting

### User Has Paid But Can't Access
1. Check if they're using the same email in Clerk and Stripe
2. Verify the product ID matches exactly
3. Check Stripe webhook delivery
4. Use the "Verify My Payment" button

### Product ID Not Found
1. Ensure you're using the Product ID, not Price ID
2. Product IDs start with `prod_`, Price IDs start with `price_`
3. Check that the product exists in your Stripe account

### Webhook Issues
1. Verify webhook endpoint URL in Stripe Dashboard
2. Check webhook secret in environment variables
3. Test webhook delivery in Stripe Dashboard

## Environment Variables Required

Make sure these are set in your `.env.local`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
```

## Support

If users have issues accessing after payment:
1. Direct them to `/subscription-status` page
2. They can use "Verify My Payment with Stripe" button
3. Check their subscription status in Stripe Dashboard
4. Manually update their profile if needed 