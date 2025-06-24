import { SignIn } from "@clerk/nextjs";

export default function Page({ 
  searchParams 
}: { 
  searchParams: { redirect_url?: string } 
}) {
  // Get the redirect URL from search params, default to homepage
  const redirectUrl = searchParams.redirect_url || '/';

  return (
    <SignIn 
      redirectUrl={redirectUrl}
      afterSignInUrl={redirectUrl}
    />
  );
}
