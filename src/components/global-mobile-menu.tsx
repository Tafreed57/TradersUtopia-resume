"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  Home,
  DollarSign,
  LayoutDashboard,
  Server,
  Play,
  User,
  LogIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSmartRouting } from "@/lib/smart-routing";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Image from "next/image";

export function GlobalMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavProcessing, setIsNavProcessing] = useState(false);
  const router = useRouter();

  // Smart routing for trial button
  const { handleSmartNavigation: handleNavSmartRouting, isLoaded } =
    useSmartRouting({
      loadingCallback: setIsNavProcessing,
      onError: (error) => {
        console.error("Mobile menu smart routing error:", error);
      },
    });

  const handleNavigation = async (
    path: string,
    isServerLink = false,
    isScrollLink = false,
  ) => {
    setIsOpen(false);

    if (isServerLink) {
      // Smart server navigation - get user's first server
      try {
        const response = await fetch("/api/servers/ensure-default", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.server?.id) {
            router.push(`/servers/${data.server.id}`);
            return;
          }
        }
      } catch (error) {
        console.error("Error getting default server:", error);
      }

      // Fallback to dashboard if server navigation fails
      router.push("/dashboard");
    } else if (isScrollLink) {
      // Handle scroll links (like /#free-videos)
      if (path.startsWith("/#")) {
        const sectionId = path.substring(2); // Remove /#
        // If we're already on homepage, just scroll to section
        if (window.location.pathname === "/") {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
            return;
          }
        }
        // Otherwise navigate to homepage first, then scroll
        router.push("/");
        setTimeout(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      } else {
        router.push(path);
      }
    } else {
      router.push(path);
    }
  };

  const handleStartTrialClick = async () => {
    if (isNavProcessing) return;
    setIsOpen(false);
    await handleNavSmartRouting();
  };

  const navigationItems: Array<{
    id: string;
    icon: any;
    label: string;
    path: string;
    isServerLink?: boolean;
    isScrollLink?: boolean;
  }> = [
    { id: "homepage", icon: Home, label: "Homepage", path: "/" },
    {
      id: "free-videos",
      icon: Play,
      label: "Free Videos",
      path: "/free-videos",
    },
    { id: "pricing", icon: DollarSign, label: "Pricing", path: "/pricing" },
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/dashboard",
    },
    {
      id: "servers",
      icon: Server,
      label: "Servers",
      path: "/dashboard",
      isServerLink: true,
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 transition-colors duration-200"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[280px] bg-gradient-to-b from-gray-900 via-gray-900/95 to-black border-l border-gray-700/50 backdrop-blur-xl"
      >
        <div className="flex flex-col h-full pt-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-700/50">
            <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg">
              <Image
                src="/logo.png"
                alt="TradersUtopia"
                width={16}
                height={16}
              />
            </div>
            <span className="text-white text-lg font-bold">TradersUtopia</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-2 mb-8 flex-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-white/10 hover:text-yellow-400 transition-all duration-200 py-3 px-4"
                  onClick={() =>
                    handleNavigation(
                      item.path,
                      item.isServerLink || false,
                      item.isScrollLink || false,
                    )
                  }
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* Auth Section */}
          <div className="border-t border-gray-700/50 pt-6 space-y-3">
            <SignedOut>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:bg-white/10 transition-all duration-200"
                onClick={() => handleNavigation("/sign-in")}
              >
                <LogIn className="w-4 h-4 mr-3" />
                Sign In
              </Button>
              <Button
                onClick={handleStartTrialClick}
                disabled={!isLoaded || isNavProcessing}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {isNavProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </div>
                ) : (
                  "Start Free Trial"
                )}
              </Button>
            </SignedOut>

            <SignedIn>
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8",
                    },
                  }}
                />
                <span className="text-gray-300 text-sm">Signed in</span>
              </div>
            </SignedIn>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
