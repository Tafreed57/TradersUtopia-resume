import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import Link from "next/link";
import { NavigationButton } from "./navigation-button";

export function AuthHeader() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <NavigationButton href="/sign-in" asButton={true} variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/30" loadingMessage="Redirecting to sign in...">
          Sign In
        </NavigationButton>
        <NavigationButton href="/sign-up" asButton={true} className="bg-indigo-600 hover:bg-indigo-700 text-white" loadingMessage="Redirecting to sign up...">
          Register
        </NavigationButton>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center gap-2">
          <span className="text-white/80 text-sm">Welcome back!</span>
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-8 h-8"
              }
            }}
          />
        </div>
      </SignedIn>
    </div>
  );
} 