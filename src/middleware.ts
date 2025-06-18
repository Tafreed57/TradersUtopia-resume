import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
	"/", 
	"/pricing", 
	"/sign-in(.*)", 
	"/sign-up(.*)", 
	"/api/uploadthing", 
	"/api/socket(.*)", 
	"/api/webhooks(.*)",
	"/api/sync-profiles",
	"/api/test-env",
	"/api/test-clerk",
	"/api/debug-emails",
	"/api/debug-stripe",
	"/api/check-payment-status",
	"/api/verify-stripe-payment",
	"/api/test-login-sync",
	"/api/setup-login-sync-test"
]);

// protect all routes except the public ones
export default clerkMiddleware(
	(auth, request) => {
		if (!isPublicRoute(request)) {
			auth().protect();
		}
	},
	// { debug: process.env.NODE_ENV === "development" }
);

export const config = { 
	matcher: [
		"/((?!.*\\..*|_next|ws).*)", 
		"/", 
		"/(api|trpc)(.*)"
	] 
};
