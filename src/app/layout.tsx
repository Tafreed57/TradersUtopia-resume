import { ourFileRouter } from "@/app/api/uploadthing/core";
import "@/app/globals.css";
import { ModalProvider } from "@/contexts/modal-provider";
import { QueryProvider } from "@/contexts/query-provider";
import { SocketProvider } from "@/contexts/socket-provider";
import { ThemeProvider } from "@/contexts/theme-provider";
import { LoadingProvider } from "@/contexts/loading-provider";
import { AuthWrapper } from "@/components/auth-wrapper";
import { TwoFactorGuard } from "@/components/2fa-guard";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { extractRouterConfig } from "uploadthing/server";
import { Toaster } from "sonner";

const open_sans = Open_Sans({ subsets: ["latin"] });

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export const metadata: Metadata = {
	title: "Traders Utopia",
	description: "Professional Trading Signals & Expert Education Platform",
	openGraph: {
		type: "website",
		title: "Traders Utopia",
		description: "Professional Trading Signals & Expert Education Platform",
	},
	icons: {
		icon: "/logo.png",
		shortcut: "/logo.png",
		apple: "/logo.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="scroll-smooth" suppressHydrationWarning>
			<body className={cn(open_sans.className, "bg-white dark:bg-[#313338]")}>
				<ClerkProvider
					appearance={{
						variables: { colorPrimary: "#000000" },
						elements: {
							formButtonPrimary:
								"bg-black border border-black border-solid hover:bg-white hover:text-black",
							socialButtonsBlockButton:
								"bg-white border-gray-200 hover:bg-transparent hover:border-black text-gray-600 hover:text-black",
							socialButtonsBlockButtonText: "font-semibold",
							formButtonReset:
								"bg-white border border-solid border-gray-200 hover:bg-transparent hover:border-black text-gray-500 hover:text-black",
							membersPageInviteButton:
								"bg-black border border-black border-solid hover:bg-white hover:text-black",
							card: "bg-[#fafafa]",
						},
					}}
				>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						enableSystem={false}
						storageKey="traders-utopia-theme"
						disableTransitionOnChange
					>
						<NextSSRPlugin
							routerConfig={extractRouterConfig(ourFileRouter)}
						/>
						<ErrorBoundary>
							<LoadingProvider>
								<SocketProvider>
									<QueryProvider>
										<AuthWrapper>
											<TwoFactorGuard>
												<ModalProvider />
												<Toaster 
													position="top-right"
													expand={true}
													richColors
													closeButton
												/>
												{children}
											</TwoFactorGuard>
										</AuthWrapper>
									</QueryProvider>
								</SocketProvider>
							</LoadingProvider>
						</ErrorBoundary>
					</ThemeProvider>
				</ClerkProvider>
			</body>
		</html>
	);
}
