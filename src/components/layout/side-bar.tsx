import { getCurrentProfile, getAllServers } from "@/lib/query";
import { SideBarActions } from "@/components/layout/side-bar-actions";
import { SideBarItem } from "@/components/layout/side-bar-item";
import { ModeToggle } from "@/components/mode-toggler";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { SubscriptionProtectedLink } from "@/components/subscription-protected-link";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

export async function SideBar() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return redirect("/");
  }

  const servers = await getAllServers(profile.id);

  return (
    <div className="flex flex-col space-y-4 items-center h-full text-primary w-full bg-[#E3E5E8] dark:bg-[#1E1F22] py-3">
      {/* Dashboard Link */}
      <SubscriptionProtectedLink
        href="/dashboard"
        className="h-[48px] w-[48px] rounded-full bg-background/10 hover:bg-background/20 transition-all group"
        size="icon"
        variant="ghost"
      >
        <LayoutDashboard className="h-5 w-5 text-primary group-hover:text-white transition-colors" />
      </SubscriptionProtectedLink>

      <SideBarActions />
      <Separator className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-10 mx-auto" />
      <ScrollArea className="flex-1 w-full">
        {servers?.map((server) => (
          <div key={server.id} className="mb-4">
            <SideBarItem
              name={server.name}
              id={server.id}
              imageUrl={server.imageUrl}
            />
          </div>
        ))}
      </ScrollArea>
      <div className="pb-3 mt-auto flex items-center flex-col gap-y-4">
        <NotificationBell />
        <ModeToggle />
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-[48px] w-[48px]",
            },
          }}
        />
      </div>
    </div>
  );
}
