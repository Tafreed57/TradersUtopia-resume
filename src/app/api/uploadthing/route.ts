import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,

  // ✅ SECURITY: Apply an enhanced config with security features
  config: {
    // ✅ SECURITY: Enhanced error handling
    callbackUrl:
      process.env.NODE_ENV === "development"
        ? undefined // Use default in development
        : process.env.NEXT_PUBLIC_SITE_URL + "/api/uploadthing",

    // ✅ SECURITY: Additional configuration for production
    token: process.env.UPLOADTHING_SECRET,

    // ✅ SECURITY: Enhanced logging in development
    logLevel: process.env.NODE_ENV === "development" ? "debug" : "error",
  },
});
