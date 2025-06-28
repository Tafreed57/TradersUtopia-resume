# Fix Google OAuth Account Selection Issue

## Problem
When clicking "Continue with Google", users are automatically signed in without seeing the Google account selection screen.

## Solution

### 1. Environment Variable Configuration

Add these environment variables to your `.env.local` file:

```env
# Force Google to show account selection
CLERK_OAUTH_GOOGLE_PROMPT=select_account
CLERK_OAUTH_GOOGLE_ACCESS_TYPE=offline

# Alternative approach (if above doesn't work)
NEXT_PUBLIC_CLERK_OAUTH_GOOGLE_PROMPT=select_account
```

### 2. Clerk Dashboard Configuration

As an alternative or additional step, you can configure this in your Clerk Dashboard:

1. Go to your Clerk Dashboard
2. Navigate to "Authentication" → "Social Connections"
3. Click on "Google" 
4. In the "Advanced" section, add these OAuth parameters:
   - `prompt`: `select_account`
   - `access_type`: `offline`

### 3. Manual Testing

After adding the environment variables:

1. Restart your development server: `npm run dev`
2. Clear your browser cookies for your domain
3. Test the Google sign-in again

### 4. Backup Solution (Custom Implementation)

If the environment variables don't work, you can use the custom Google sign-in component I created (`src/components/custom-google-signin.tsx`) and replace the default Clerk Google button with it.

### Expected Behavior

After implementing this fix:
- Clicking "Continue with Google" will show the Google account selection screen
- Users can choose which Google account to use
- The selection screen will appear even if users are already signed into Google

### Notes

- This fix applies the `prompt=select_account` parameter to Google's OAuth flow
- This forces Google to always show the account picker
- Users will see this screen every time they sign in (which is the desired behavior for account switching) 