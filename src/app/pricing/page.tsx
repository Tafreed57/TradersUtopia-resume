import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggler";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { SimplePricingButtons } from "@/components/simple-pricing-buttons";
import { AuthHeader } from "@/components/auth-header";

export default function PricingPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
			{/* Promotional Banner */}
			<div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white text-center py-7 px-4">
				<div className="flex items-center justify-center gap-2 text-sm md:text-base font-semibold">
					<span className="text-2xl">⏳</span>
					<span>PRICE INCREASING AGAIN</span>
					<span className="text-yellow-300">Time's up!</span>
				</div>
			</div>

			{/* Header */}
			<header className="flex items-center justify-between p-6 max-w-7xl mx-auto">
				<div className="flex items-center gap-6">
					{/* Logo and Title */}
					<div className="flex items-center gap-3">
						<Image src="/logo.svg" alt="TradersUtopia" width={32} height={32} />
						<span className="text-white text-xl font-bold">TradersUtopia</span>
					</div>
					
					{/* Authentication Section */}
					<AuthHeader />
				</div>
				<div className="flex items-center gap-4">
					<Link href="/dashboard">
						<Button variant="ghost" className="text-white hover:bg-white/10">
							Access Discord
						</Button>
					</Link>
					<ModeToggle />
				</div>
			</header>

			{/* Main Content */}
			<main className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-6">
				<div className="text-center max-w-4xl mx-auto mb-12">
					<h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
						Join 
						<span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
							{" "}Traders Utopia
						</span>
					</h1>
					
					<p className="text-lg md:text-xl text-gray-300 mb-8">
						Shehroze Trade Alerts and Education - Professional Trading Community
					</p>
				</div>

				{/* Pricing Card */}
				<div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-2xl w-full border border-white/20">
					<div className="text-center mb-8">
						<h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
							🌟 Premium Trading Alerts
						</h2>
						<div className="text-4xl md:text-5xl font-bold text-white mb-2">
							$149.99
							<span className="text-lg text-gray-300 font-normal">/month</span>
						</div>
						<p className="text-green-400 font-semibold">14 day free trial</p>
					</div>

					<div className="space-y-4 mb-8">
						<div className="flex items-start gap-3">
							<span className="text-green-400 text-xl">📈</span>
							<div>
								<p className="text-white font-semibold">Real-Time Swing Trade Alerts</p>
								<p className="text-gray-300 text-sm">Only high-probability setups, no spam</p>
							</div>
						</div>
						
						<div className="flex items-start gap-3">
							<span className="text-green-400 text-xl">💎</span>
							<div>
								<p className="text-white font-semibold">Bonus Investing Alerts</p>
								<p className="text-gray-300 text-sm">Targeting 30–50%+ returns with long-term plays</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<span className="text-green-400 text-xl">🎙️</span>
							<div>
								<p className="text-white font-semibold">Live Daily Classes</p>
								<p className="text-gray-300 text-sm">Monday to Friday, 9:00–9:30 PM EST, hosted in Discord voice chat</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<span className="text-green-400 text-xl">🔒</span>
							<div>
								<p className="text-white font-semibold">Private Access Channels</p>
								<p className="text-gray-300 text-sm">Get alerts and insights that free members can't see</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<span className="text-green-400 text-xl">🤝</span>
							<div>
								<p className="text-white font-semibold">Supportive Network</p>
								<p className="text-gray-300 text-sm">Learn from experienced traders and level up faster</p>
							</div>
						</div>

						<div className="flex items-start gap-3">
							<span className="text-green-400 text-xl">🌐</span>
							<div>
								<p className="text-white font-semibold">Community Only Resources</p>
								<p className="text-gray-300 text-sm">Exclusive tools, discussions, and education</p>
							</div>
						</div>
					</div>

					<SignedIn>
						<SimplePricingButtons />
					</SignedIn>
					<SignedOut>
						<div className="space-y-4">
							<Button 
								size="lg" 
								onClick={() => window.location.href = "https://buy.stripe.com/3cI5kC46X5Bmbft2Kc4Ja0k"}
								className="w-full bg-green-600 hover:bg-green-700 text-white py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
							>
								Start 14-Day Free Trial - $149.99/month
							</Button>
							
							<p className="text-gray-400 text-sm text-center">
								14-day free trial • Cancel anytime
							</p>
						</div>
					</SignedOut>
				</div>

				{/* Discord Access Button */}
				<div className="mt-8 text-center">
					<p className="text-gray-300 mb-4">Already a member?</p>
					<Link href="/dashboard">
						<Button 
							variant="outline" 
							className="border-white/30 text-white hover:bg-white/10 px-6 py-3"
						>
							Access Discord Server
						</Button>
					</Link>
				</div>
			</main>
		</div>
	);
} 