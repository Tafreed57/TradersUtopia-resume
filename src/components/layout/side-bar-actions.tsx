"use client";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useStore } from "@/store/store";
import { Plus, Lock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export function SideBarActions() {
  const onOpen = useStore.use.onOpen();
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  // Check if user has admin permissions
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      try {
        const response = await fetch("/api/admin/check-status", {
          method: "GET",
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setCheckingPermissions(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const handleServerCreation = () => {
    if (!isAdmin) {
      alert(
        "❌ Admin access required to create servers. Visit the dashboard to request admin access.",
      );
      return;
    }
    onOpen("createServer");
  };

  if (checkingPermissions) {
    return (
      <div>
        <ActionTooltip align="center" side="right" label="Loading...">
          <button
            disabled className="group flex items-center cursor-not-allowed"
          >
            <div className="flex mx-3 h-[48px] w-[48px] rounded-[24px] transition-all overflow-hidden items-center justify-center bg-background opacity-50">
              <Plus size={25} className="text-gray-400" />
            </div>
          </button>
        </ActionTooltip>
      </div>
    );
  }

  return (
    <div>
      <ActionTooltip
        align="center"
        side="right"
        label={isAdmin ? "Add a server" : "Admin access required"}
      >
        <button
          onClick={handleServerCreation}
          className={`group flex items-center ${!isAdmin ? "cursor-not-allowed" : ""}`}
        >
          <div
            className={`flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden items-center justify-center bg-background ${
              isAdmin
                ? "group-hover:bg-emerald-500"
                : "group-hover:bg-red-500 opacity-60"
            }`}
          >
            {isAdmin ? (
              <Plus
                size={25} className="group-hover:text-white transition text-emerald-500"
              />
            ) : (
              <Lock
                size={25} className="group-hover:text-white transition text-red-500"
              />
            )}
          </div>
        </button>
      </ActionTooltip>
    </div>
  );
}
