"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crown, ShieldOff, Loader2 } from "lucide-react";
import { showToast } from "@/lib/notifications-client";
import { useRouter } from "next/navigation";
import { makeSecureRequest } from "@/lib/csrf-client";

interface AdminButtonProps {
  isAdmin: boolean;
}

export function AdminButton({ isAdmin }: AdminButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleGrantAdmin = async () => {
    setIsLoading(true);
    try {
      const response = await makeSecureRequest("/api/admin/grant-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success("🔑 Admin Access Granted!", data.message);

        // ✅ ENHANCEMENT: Update server roles after granting admin privileges
        try {
          const serverResponse = await makeSecureRequest(
            "/api/servers/ensure-default",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          if (serverResponse.ok) {
            showToast.success(
              "🔄 Server Roles Updated!",
              "Your server permissions have been upgraded",
            );
          }
        } catch (serverError) {
          console.error("Error updating server roles:", serverError);
          // Don't show error to user - the main admin grant succeeded
        }

        // Refresh the page to update the UI
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        showToast.error("❌ Failed to Grant Admin Access", data.error);
      }
    } catch (error) {
      console.error("Error granting admin access:", error);
      showToast.error("❌ Error", "Failed to grant admin access");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeAdmin = async () => {
    setIsLoading(true);
    try {
      const response = await makeSecureRequest("/api/admin/revoke-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        showToast.success("🔒 Admin Access Revoked!", data.message);

        // ✅ FIX: Update server roles after revoking admin privileges
        try {
          const serverResponse = await makeSecureRequest(
            "/api/servers/ensure-default",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            },
          );

          if (serverResponse.ok) {
            showToast.success(
              "🔄 Server Roles Updated!",
              "Your server permissions have been downgraded",
            );
          }
        } catch (serverError) {
          console.error("Error updating server roles:", serverError);
          // Don't show error to user - the main admin revoke succeeded
        }

        // Refresh the page to update the UI
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        showToast.error("❌ Failed to Revoke Admin Access", data.error);
      }
    } catch (error) {
      console.error("Error revoking admin access:", error);
      showToast.error("❌ Error", "Failed to revoke admin access");
    } finally {
      setIsLoading(false);
    }
  };

  if (isAdmin) {
    return (
      <Button
        onClick={handleRevokeAdmin}
        disabled={isLoading}
        variant="outline"
        className="border-red-200 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-900/20 dark:hover:border-red-700"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Revoking...
          </>
        ) : (
          <>
            <ShieldOff className="h-4 w-4 mr-2" />
            Remove Admin Access
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleGrantAdmin}
      disabled={isLoading}
      className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Granting...
        </>
      ) : (
        <>
          <Crown className="h-4 w-4 mr-2" />
          Grant Admin Access
        </>
      )}
    </Button>
  );
}
