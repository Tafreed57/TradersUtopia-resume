"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { makeSecureRequest } from "@/lib/csrf-client";

export function AutoJoinDefault() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const ensureDefaultServer = async () => {
      if (!isLoaded || !user) return;

      try {
        const response = await makeSecureRequest(
          "/api/servers/ensure-default",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          console.log("✅ Default server ensured:", data.server.name);

          // Navigate to the default server
          router.push(`/servers/${data.server.id}`);
        } else {
          console.error("❌ Failed to ensure default server");
        }
      } catch (error) {
        console.error("❌ Error ensuring default server:", error);
      }
    };

    ensureDefaultServer();
  }, [user, isLoaded, router]);

  return null;
}
