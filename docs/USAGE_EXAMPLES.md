# Product Paywall Usage Examples

This document shows practical examples of how to use the product-specific paywall system throughout your application.

## 1. Protecting Pages with ProductPaymentGate

### Basic Usage
```typescript
// src/app/premium-feature/page.tsx
import { ProductPaymentGate } from '@/components/product-payment-gate';

export default function PremiumFeaturePage() {
  return (
    <ProductPaymentGate 
      allowedProductIds={["prod_premium_access"]}
      productName="Premium Features"
      upgradeUrl="https://buy.stripe.com/premium-checkout"
      features={[
        "Advanced analytics dashboard",
        "Export capabilities", 
        "Priority support"
      ]}
    >
      <div>
        <h1>Premium Features</h1>
        {/* Your premium content here */}
      </div>
    </ProductPaymentGate>
  );
}
```

### Multiple Product Tiers
```typescript
// Different access levels for different products
import { PRODUCT_TIERS } from '@/lib/product-access';

// VIP-only feature
<ProductPaymentGate 
  allowedProductIds={PRODUCT_TIERS.VIP}
  productName="VIP Access"
>
  <VIPFeatures />
</ProductPaymentGate>

// Premium or VIP access
<ProductPaymentGate 
  allowedProductIds={PRODUCT_TIERS.PREMIUM_OR_VIP}
  productName="Premium Features"
>
  <PremiumFeatures />
</ProductPaymentGate>
```

## 2. Server-Side Access Control

### In API Routes
```typescript
// src/app/api/premium-data/route.ts
import { NextResponse } from 'next/server';
import { requireProductAccess } from '@/lib/product-access';

export async function GET() {
  try {
    // Require premium access for this API
    await requireProductAccess(['prod_premium']);
    
    // User has access, proceed with API logic
    const premiumData = await getPremiumData();
    
    return NextResponse.json({ data: premiumData });
  } catch (error) {
    return NextResponse.json(
      { error: 'Premium subscription required' }, 
      { status: 403 }
    );
  }
}
```

### In Server Components
```typescript
// src/app/dashboard/analytics/page.tsx
import { checkProductAccess } from '@/lib/product-access';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  const access = await checkProductAccess(['prod_analytics_addon']);
  
  if (!access.hasAccess) {
    redirect('/pricing?feature=analytics');
  }
  
  return (
    <div>
      <h1>Analytics Dashboard</h1>
      <AnalyticsCharts />
    </div>
  );
}
```

## 3. Conditional UI Rendering

### Show/Hide Features Based on Access
```typescript
// src/components/feature-menu.tsx
'use client';

import { useEffect, useState } from 'react';
import { fetchProductAccess } from '@/lib/product-access';
import { Button } from '@/components/ui/button';

export function FeatureMenu() {
  const [premiumAccess, setPremiumAccess] = useState(false);
  const [vipAccess, setVipAccess] = useState(false);
  
  useEffect(() => {
    // Check access levels
    fetchProductAccess(['prod_premium']).then(result => {
      setPremiumAccess(result.hasAccess);
    });
    
    fetchProductAccess(['prod_vip']).then(result => {
      setVipAccess(result.hasAccess);
    });
  }, []);
  
  return (
    <div className="space-y-2">
      {/* Always visible */}
      <Button>Basic Feature</Button>
      
      {/* Only for premium users */}
      {premiumAccess ? (
        <Button>Premium Analytics</Button>
      ) : (
        <Button variant="outline" disabled>
          Premium Analytics (Upgrade Required)
        </Button>
      )}
      
      {/* Only for VIP users */}
      {vipAccess && (
        <Button>VIP-Only Feature</Button>
      )}
    </div>
  );
}
```

### Upgrade Prompts
```typescript
// src/components/upgrade-prompt.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UpgradePromptProps {
  feature: string;
  requiredProduct: string;
  upgradeUrl: string;
}

export function UpgradePrompt({ feature, requiredProduct, upgradeUrl }: UpgradePromptProps) {
  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <CardTitle>🔒 {feature} - Premium Feature</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          This feature requires a {requiredProduct} subscription.
        </p>
        <Button onClick={() => window.open(upgradeUrl, '_blank')}>
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}

// Usage:
// <UpgradePrompt 
//   feature="Advanced Reports" 
//   requiredProduct="Premium"
//   upgradeUrl="https://buy.stripe.com/premium-checkout"
// />
```

## 4. Complex Access Scenarios

### Tiered Feature Access
```typescript
// src/components/reports-dashboard.tsx
import { checkProductAccess, PRODUCT_TIERS } from '@/lib/product-access';

export default async function ReportsDashboard() {
  const basicAccess = await checkProductAccess(PRODUCT_TIERS.BASIC);
  const premiumAccess = await checkProductAccess(PRODUCT_TIERS.PREMIUM);
  const vipAccess = await checkProductAccess(PRODUCT_TIERS.VIP);
  
  return (
    <div>
      <h1>Reports Dashboard</h1>
      
      {/* Basic reports - available to all paid users */}
      {basicAccess.hasAccess && (
        <section>
          <h2>Basic Reports</h2>
          <BasicReports />
        </section>
      )}
      
      {/* Premium reports */}
      {premiumAccess.hasAccess && (
        <section>
          <h2>Premium Reports</h2>
          <PremiumReports />
        </section>
      )}
      
      {/* VIP-only features */}
      {vipAccess.hasAccess && (
        <section>
          <h2>VIP Analytics</h2>
          <VIPAnalytics />
        </section>
      )}
      
      {/* Upgrade prompts for missing access */}
      {!basicAccess.hasAccess && (
        <UpgradePrompt 
          feature="Reports" 
          requiredProduct="Basic"
          upgradeUrl="/pricing"
        />
      )}
    </div>
  );
}
```

### Time-Limited Features
```typescript
// src/components/feature-with-expiry.tsx
import { checkProductAccess } from '@/lib/product-access';

export default async function FeatureWithExpiry() {
  const access = await checkProductAccess(['prod_monthly_feature']);
  
  if (!access.hasAccess) {
    return <UpgradePrompt feature="Monthly Feature" />;
  }
  
  const daysLeft = access.subscriptionEnd 
    ? Math.ceil((new Date(access.subscriptionEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  
  return (
    <div>
      {daysLeft && daysLeft < 7 && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
          ⚠️ Your subscription expires in {daysLeft} days. 
          <Button variant="link">Renew Now</Button>
        </div>
      )}
      <FeatureContent />
    </div>
  );
}
```

## 5. Configuration Examples

### Environment-Specific Product IDs
```typescript
// src/lib/products.ts
const isProduction = process.env.NODE_ENV === 'production';

export const PRODUCTS = {
  BASIC: isProduction ? 'prod_live_basic' : 'prod_test_basic',
  PREMIUM: isProduction ? 'prod_live_premium' : 'prod_test_premium',
  VIP: isProduction ? 'prod_live_vip' : 'prod_test_vip'
};
```

### Feature Flag Integration
```typescript
// src/lib/feature-flags.ts
import { checkProductAccess } from '@/lib/product-access';

export async function isFeatureEnabled(feature: string) {
  switch (feature) {
    case 'advanced-analytics':
      return (await checkProductAccess(['prod_premium', 'prod_vip'])).hasAccess;
    
    case 'white-label':
      return (await checkProductAccess(['prod_enterprise'])).hasAccess;
    
    case 'api-access':
      return (await checkProductAccess(['prod_developer'])).hasAccess;
    
    default:
      return false;
  }
}
```

## 6. Testing Examples

### Mock Product Access for Testing
```typescript
// src/lib/test-utils.ts
export function mockProductAccess(productId: string) {
  // Mock implementation for testing
  global.mockProductAccess = {
    hasAccess: true,
    productId,
    reason: 'Test access granted'
  };
}

// In your tests:
beforeEach(() => {
  mockProductAccess('prod_test_premium');
});
```

## 7. Error Handling

### Graceful Degradation
```typescript
// src/components/premium-chart.tsx
'use client';

import { useEffect, useState } from 'react';
import { fetchProductAccess } from '@/lib/product-access';

export function PremiumChart() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchProductAccess(['prod_premium'])
      .then(result => setHasAccess(result.hasAccess))
      .catch(err => {
        console.error('Access check failed:', err);
        setError('Unable to verify access');
        setHasAccess(false);
      });
  }, []);
  
  if (error) {
    return (
      <div className="p-4 border-red-200 border rounded">
        ⚠️ {error} - Showing basic view
        <BasicChart />
      </div>
    );
  }
  
  if (hasAccess === null) {
    return <div>Checking access...</div>;
  }
  
  return hasAccess ? <AdvancedChart /> : <BasicChart />;
}
```

These examples show how to implement product-specific access control throughout your application while maintaining a good user experience and proper error handling. 