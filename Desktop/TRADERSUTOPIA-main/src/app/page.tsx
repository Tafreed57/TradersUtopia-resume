"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Users, 
  Shield, 
  Zap,
  Star,
  ArrowRight,
  BarChart3,
  Target,
  Award,
  DollarSign,
  Lock,
  Play
} from "lucide-react";
import { SmartEntryButton } from "@/components/smart-entry-button";
import { PricingSectionButton } from "@/components/pricing-section-button";
import { useSmartRouting } from "@/lib/smart-routing";
import { ModeToggle } from "@/components/mode-toggler";
import { AutoRouteAfterSignIn } from "@/components/auto-route-after-signin";
import { CountdownTimer } from "@/components/countdown-timer";
import { SubscriptionProtectedLink } from "@/components/subscription-protected-link";
import { GlobalMobileMenu } from "@/components/global-mobile-menu";
import { NavigationButton } from "@/components/navigation-button";
import { Suspense } from "react";
import { Check } from "lucide-react";

export default function HomePage() {
	const [timeLeft, setTimeLeft] = useState({
		hours: 4,
		minutes: 18,
		seconds: 0
	});

	const [currentProfit, setCurrentProfit] = useState(256176);
	const [activeTraders, setActiveTraders] = useState(1247);
	const [isNavProcessing, setIsNavProcessing] = useState(false);

	// Smart routing for nav button
	const { handleSmartNavigation: handleNavSmartRouting, isLoaded, isSignedIn } = useSmartRouting({
		loadingCallback: setIsNavProcessing,
		onError: (error) => {
			console.error('Nav smart routing error:', error);
		}
	});

	const handleStartTrialClick = async () => {
		if (isNavProcessing) return;
		await handleNavSmartRouting();
	};

	useEffect(() => {
		const timer = setInterval(() => {
			setTimeLeft(prev => {
				if (prev.seconds > 0) {
					return { ...prev, seconds: prev.seconds - 1 };
				} else if (prev.minutes > 0) {
					return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
				} else if (prev.hours > 0) {
					return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
				} else {
					return { hours: 4, minutes: 18, seconds: 0 };
				}
			});
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		const profitTimer = setInterval(() => {
			setCurrentProfit(prev => prev + Math.floor(Math.random() * 50) + 25);
		}, 5000);

		const tradersTimer = setInterval(() => {
			setActiveTraders(prev => prev + (Math.random() > 0.5 ? 1 : -1));
		}, 3000);

		return () => {
			clearInterval(profitTimer);
			clearInterval(tradersTimer);
		};
	}, []);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-hidden">
			{/* Hero Banner - Countdown Timer */}
			<div className="bg-gradient-to-r from-red-600/90 via-orange-500/80 to-red-700/90 border-b border-red-400/30 sticky top-0 z-50 shadow-lg">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<div className="flex items-center justify-center gap-3 text-center">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-red-100 rounded-full animate-pulse"></div>
							<span className="text-red-100 font-semibold text-sm uppercase tracking-wide">Limited Time</span>
						</div>
						<span className="text-white font-semibold text-sm">Lock in pricing</span>
						<div className="bg-black/20 rounded px-3 py-1 border border-red-400/20">
							<CountdownTimer initialMinutes={47} initialSeconds={33} />
						</div>
					</div>
				</div>
			</div>
			
			{/* Animated Background Effects */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
				<div className="absolute top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
				<div className="absolute bottom-40 right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
			</div>
			<div className="relative z-10">
				{/* Auto-route component for handling post-sign-in routing */}
				<Suspense fallback={null}>
					<AutoRouteAfterSignIn />
				</Suspense>

				{/* Trust Bar */}
				<div className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/25 to-yellow-400/20 border-b border-yellow-400/30 backdrop-blur-sm">
					<div className="max-w-7xl mx-auto px-6 py-2">
						<div className="flex items-center justify-center gap-6 text-sm text-yellow-100">
							<div className="flex items-center gap-2">
								<Shield className="w-4 h-4" />
								<span>SEC Compliant</span>
							</div>
							<div className="flex items-center gap-2">
								<Lock className="w-4 h-4" />
								<span>Bank-Level Security</span>
							</div>
							<div className="flex items-center gap-2">
								<Award className="w-4 h-4" />
								<span>14-Day Money-Back Guarantee</span>
							</div>
						</div>
					</div>
				</div>

				{/* Header */}
				<header className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-7xl mx-auto">
					{/* Mobile Layout - Centered Logo */}
					<div className="flex md:hidden items-center justify-between w-full">
						<div className="w-10"></div> {/* Spacer for balance */}
						<div className="flex items-center gap-2">
							<div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
								<Image src="/logo.png" alt="TradersUtopia" width={20} height={20} />
							</div>
							<span className="text-white text-lg font-bold tracking-tight">TradersUtopia</span>
						</div>
						<div className="flex items-center gap-2">
							<GlobalMobileMenu />
							<ModeToggle />
						</div>
					</div>

					{/* Desktop Layout */}
					<div className="hidden md:flex items-center gap-6 w-full">
						{/* Logo and Title */}
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
								<Image src="/logo.png" alt="TradersUtopia" width={24} height={24} />
							</div>
							<span className="text-white text-xl font-bold tracking-tight">TradersUtopia</span>
						</div>
						
						{/* Navigation */}
						<nav className="flex items-center gap-6 text-sm">
							<Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
							<Link href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Reviews</Link>
							<Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
							<Link href="#free-videos" className="text-gray-300 hover:text-white transition-colors">Free Videos</Link>
						</nav>
						
						{/* Authentication Section */}
						<div className="flex items-center gap-3 ml-auto">
							<SignedOut>
								<Link href="/sign-in">
									<Button 
										variant="ghost" 
										className="text-white hover:bg-white/10"
									>
										Sign In
									</Button>
								</Link>
								<Link href="/sign-up">
									<Button 
										className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
									>
										Start Free Trial
									</Button>
								</Link>
							</SignedOut>
							<SignedIn>
								<div className="flex items-center gap-3">
									<SubscriptionProtectedLink 
										href="/dashboard"
										variant="outline"
										className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
									>
										Dashboard
									</SubscriptionProtectedLink>
									<UserButton 
										appearance={{
											elements: {
												avatarBox: "w-8 h-8"
											}
										}}
									/>
								</div>
							</SignedIn>
							<ModeToggle />
						</div>
					</div>
				</header>

				{/* Hero Section */}
				<section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-16">
					<div className="text-center mb-12 sm:mb-16">
						{/* Social Proof Badge */}
						<div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-400/30 rounded-full px-4 py-2 mb-6">
							<div className="flex -space-x-2">
								<div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white"></div>
								<div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white"></div>
								<div className="w-6 h-6 bg-purple-500 rounded-full border-2 border-white"></div>
							</div>
							<span className="text-green-400 text-sm font-medium">Trusted by 2,847+ professional traders</span>
						</div>

						{/* Main Headline */}
						<h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-4 sm:mb-6 leading-[0.9] tracking-tight">
							<span className="bg-gradient-to-r from-white via-yellow-100 to-yellow-300 bg-clip-text text-transparent animate-gradient">
								Turn Market Knowledge
							</span>
							<br />
							<span className="text-white drop-shadow-2xl">Into Consistent</span>
							<br />
							<span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent animate-gradient">
								Profits
							</span>
						</h1>
						
						{/* Subheadline */}
						<p className="text-lg sm:text-xl md:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0">
							Join elite traders who receive <span className="text-yellow-400 font-semibold">high-probability setups</span>, 
							expert analysis, and live coaching sessions. Start your 14-day free trial today.
						</p>

						{/* Stats Row */}
						<div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 text-center px-2 sm:px-0">
							<div className="flex flex-col items-center bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 min-w-[80px] sm:min-w-[100px]">
								<div className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400">78%</div>
								<div className="text-xs sm:text-sm text-gray-300">Win Rate</div>
							</div>
							<div className="flex flex-col items-center bg-gradient-to-b from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 min-w-[80px] sm:min-w-[100px]">
								<div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-400">$2.4M+</div>
								<div className="text-xs sm:text-sm text-gray-300">Member Profits</div>
							</div>
							<div className="flex flex-col items-center bg-gradient-to-b from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 min-w-[80px] sm:min-w-[100px]">
								<div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-400">2,847</div>
								<div className="text-xs sm:text-sm text-gray-300">Active Members</div>
							</div>
							<div className="flex flex-col items-center bg-gradient-to-b from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 min-w-[80px] sm:min-w-[100px]">
								<div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-400">5 Years</div>
								<div className="text-xs sm:text-sm text-gray-300">Track Record</div>
							</div>
						</div>
						
						{/* CTA Section */}
						<div className="flex flex-col items-center gap-4">
							<SmartEntryButton />
							<div className="flex items-center gap-2 text-green-400 text-sm">
								<Check className="w-4 h-4" />
								<span>14-day free trial • No credit card required</span>
							</div>
						</div>
					</div>

					{/* Video Demo Section */}
					<div className="bg-gradient-to-br from-gray-800/60 via-slate-800/40 to-gray-900/60 rounded-3xl p-4 sm:p-6 md:p-10 mb-20 border border-gray-600/30 backdrop-blur-md shadow-2xl">
						<div className="text-center mb-6 sm:mb-8 md:mb-10">
							<h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 md:mb-6 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">See TradersUtopia in Action</h2>
							<p className="text-gray-300 text-base sm:text-lg md:text-xl">Watch how our members receive and execute profitable trades</p>
						</div>
						<div className="relative max-w-5xl mx-auto">
							<div className="rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-gray-600/50 hover:border-yellow-400/50 transition-all duration-500">
								<iframe
									className="w-full h-[180px] sm:h-[240px] md:h-[320px] lg:h-[400px]"
									src="https://www.youtube.com/embed/XMW0WVYBbLY"
									title="TradersUtopia 2-min Demo"
									frameBorder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
								></iframe>
							</div>
						</div>
					</div>
				</section>

				{/* Free Videos Advertisement Section */}
				<section id="free-videos" className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
					<div className="max-w-7xl mx-auto px-4 sm:px-6">
						<div className="text-center mb-16">
							<div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-400/30 rounded-full px-6 py-2 mb-6">
								<Play className="w-4 h-4 text-purple-400" />
								<span className="text-purple-300 font-semibold text-sm">FREE EDUCATIONAL CONTENT</span>
							</div>
							<h2 className="text-4xl md:text-6xl font-bold mb-6">
								<span className="bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
									31 Free Trading Videos
								</span>
							</h2>
							<p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-8">
								Master the fundamentals with our comprehensive video library. Learn from professional traders 
								and discover the strategies that generate consistent profits.
							</p>
						</div>

						<div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-16">
							{/* Left side - Video preview */}
							<div className="relative">
								<div className="rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-purple-400/30 hover:border-purple-400/60 transition-all duration-500">
									<iframe
										className="w-full h-[200px] sm:h-[280px] lg:h-[320px]"
										src="https://www.youtube.com/embed/TdPQNrQrpXw"
										title="TradersUtopia Free Trading Videos"
										frameBorder="0"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
										allowFullScreen
									></iframe>
								</div>
								
								{/* Video stats overlay */}
								<div className="absolute -bottom-6 -right-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-4 border border-purple-400/30 backdrop-blur-sm">
									<div className="text-center">
										<div className="text-2xl font-bold text-white">31</div>
										<div className="text-xs text-purple-200">Videos</div>
									</div>
								</div>
								
								{/* Duration badge */}
								<div className="absolute top-4 left-4 bg-black/80 rounded-lg px-3 py-1 border border-purple-400/30">
									<span className="text-purple-300 text-sm font-semibold">12+ Hours Content</span>
								</div>
							</div>

							{/* Right side - Features */}
							<div className="space-y-8">
								<div className="space-y-6">
									<div className="flex items-start gap-4">
										<div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-purple-600/30 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
											<TrendingUp className="w-5 h-5 text-purple-400" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white mb-2">Technical Analysis Fundamentals</h3>
											<p className="text-gray-300 leading-relaxed">Learn to read charts, identify trends, and spot high-probability entry points using professional trading techniques.</p>
										</div>
									</div>

									<div className="flex items-start gap-4">
										<div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-blue-600/30 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
											<Target className="w-5 h-5 text-blue-400" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white mb-2">Risk Management Strategies</h3>
											<p className="text-gray-300 leading-relaxed">Protect your capital with proven risk management techniques that professional traders use every day.</p>
										</div>
									</div>

									<div className="flex items-start gap-4">
										<div className="w-10 h-10 bg-gradient-to-br from-indigo-500/20 to-indigo-600/30 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
											<BarChart3 className="w-5 h-5 text-indigo-400" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white mb-2">Market Psychology & Mindset</h3>
											<p className="text-gray-300 leading-relaxed">Develop the mental discipline and emotional control needed for consistent trading success.</p>
										</div>
									</div>

									<div className="flex items-start gap-4">
										<div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-green-600/30 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
											<Zap className="w-5 h-5 text-green-400" />
										</div>
										<div>
											<h3 className="text-xl font-bold text-white mb-2">Live Trade Examples</h3>
											<p className="text-gray-300 leading-relaxed">Watch real trades unfold with step-by-step explanations of entry, management, and exit strategies.</p>
										</div>
									</div>
								</div>

								{/* CTA Button */}
								<div className="pt-4">
									<NavigationButton 
										href="/free-videos" 
										asButton={true}
										className="w-full sm:w-auto bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105 border border-purple-400/30 hover:border-purple-400/50"
										loadingMessage="Loading free videos..."
									>
										<Play className="w-5 h-5 mr-2" />
										Watch All 31 Videos Free
									</NavigationButton>
									<p className="text-purple-300 text-sm mt-3 text-center sm:text-left">
										✨ No sign-up required • Instant access • 100% Free
									</p>
								</div>
							</div>
						</div>

						{/* Video topics grid */}
						<div className="grid md:grid-cols-3 gap-6">
							<div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-6 border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300 backdrop-blur-sm">
								<div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
									<div className="text-2xl">📈</div>
								</div>
								<h3 className="text-lg font-bold text-white mb-2">Beginner Basics</h3>
								<p className="text-gray-300 text-sm mb-3">Perfect for new traders learning the fundamentals</p>
								<div className="text-purple-400 text-xs font-semibold">8 Videos • 2.5 Hours</div>
							</div>

							<div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 backdrop-blur-sm">
								<div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
									<div className="text-2xl">⚡</div>
								</div>
								<h3 className="text-lg font-bold text-white mb-2">Advanced Strategies</h3>
								<p className="text-gray-300 text-sm mb-3">Complex setups and professional techniques</p>
								<div className="text-blue-400 text-xs font-semibold">15 Videos • 6 Hours</div>
							</div>

							<div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl p-6 border border-indigo-400/20 hover:border-indigo-400/40 transition-all duration-300 backdrop-blur-sm">
								<div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
									<div className="text-2xl">🎯</div>
								</div>
								<h3 className="text-lg font-bold text-white mb-2">Live Examples</h3>
								<p className="text-gray-300 text-sm mb-3">Real trades with full explanations</p>
								<div className="text-indigo-400 text-xs font-semibold">8 Videos • 3.5 Hours</div>
							</div>
						</div>
					</div>
				</section>

				{/* Features Section */}
				<section id="features" className="bg-gradient-to-b from-gray-900/50 to-black py-20">
					<div className="max-w-7xl mx-auto px-6">
						<div className="text-center mb-16">
							<h2 className="text-4xl md:text-5xl font-bold mb-4">
								Everything You Need to <span className="text-yellow-400">Trade Profitably</span>
							</h2>
							<p className="text-xl text-gray-300 max-w-3xl mx-auto">
								Our comprehensive platform provides real-time alerts, expert education, 
								and a supportive community of successful traders.
							</p>
						</div>

						<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
							{/* Feature 1 */}
							<div className="group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-yellow-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-400/10 backdrop-blur-sm">
								<div className="w-16 h-16 bg-gradient-to-br from-yellow-500/20 to-yellow-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
									<TrendingUp className="w-8 h-8 text-yellow-400" />
								</div>
								<h3 className="text-2xl font-bold mb-4 group-hover:text-yellow-300 transition-colors">Real-Time Trade Alerts</h3>
								<p className="text-gray-300 mb-6 leading-relaxed">Receive instant notifications for high-probability setups with entry, stop-loss, and target levels.</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>SMS & Email alerts</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Risk management included</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Mobile app access</span>
									</div>
								</div>
							</div>

							{/* Feature 2 */}
							<div className="group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-400/10 backdrop-blur-sm">
								<div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
									<BarChart3 className="w-8 h-8 text-blue-400" />
								</div>
								<h3 className="text-2xl font-bold mb-4 group-hover:text-blue-300 transition-colors">Expert Market Analysis</h3>
								<p className="text-gray-300 mb-6 leading-relaxed">Daily market breakdowns, key level analysis, and economic calendar insights from professional traders.</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Daily market reports</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Video breakdowns</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Economic calendar</span>
									</div>
								</div>
							</div>

							{/* Feature 3 */}
							<div className="group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-400/10 backdrop-blur-sm">
								<div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
									<Users className="w-8 h-8 text-purple-400" />
								</div>
								<h3 className="text-2xl font-bold mb-4 group-hover:text-purple-300 transition-colors">Live Trading Sessions</h3>
								<p className="text-gray-300 mb-6 leading-relaxed">Join live sessions where experts explain their thought process and trade in real-time.</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>3x weekly sessions</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Q&A opportunities</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Session recordings</span>
									</div>
								</div>
							</div>

							{/* Feature 4 */}
							<div className="group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-green-400/10 backdrop-blur-sm">
								<div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-green-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
									<Target className="w-8 h-8 text-green-400" />
								</div>
								<h3 className="text-2xl font-bold mb-4 group-hover:text-green-300 transition-colors">Risk Management Tools</h3>
								<p className="text-gray-300 mb-6 leading-relaxed">Advanced position sizing calculators and risk management strategies to protect your capital.</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Position size calculator</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Stop-loss strategies</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Portfolio tracking</span>
									</div>
								</div>
							</div>

							{/* Feature 5 */}
							<div className="group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-red-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-red-400/10 backdrop-blur-sm">
								<div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
									<Zap className="w-8 h-8 text-red-400" />
								</div>
								<h3 className="text-2xl font-bold mb-4 group-hover:text-red-300 transition-colors">Premium Community</h3>
								<p className="text-gray-300 mb-6 leading-relaxed">Connect with successful traders, share strategies, and get feedback on your trades.</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Private Discord server</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Trade review sessions</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Mentorship program</span>
									</div>
								</div>
							</div>

							{/* Feature 6 */}
							<div className="group bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-orange-400/50 transition-all duration-500 hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-400/10 backdrop-blur-sm">
								<div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-orange-600/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
									<Award className="w-8 h-8 text-orange-400" />
								</div>
								<h3 className="text-2xl font-bold mb-4 group-hover:text-orange-300 transition-colors">Educational Resources</h3>
								<p className="text-gray-300 mb-6 leading-relaxed">Comprehensive trading courses, webinars, and resources for all skill levels.</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>50+ hours of content</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Interactive quizzes</span>
									</div>
									<div className="flex items-center gap-2 text-sm">
										<Check className="w-4 h-4 text-green-400" />
										<span>Certification program</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Results Section */}
				<section className="py-20">
					<div className="max-w-7xl mx-auto px-6">
						<div className="text-center mb-16">
							<h2 className="text-4xl md:text-5xl font-bold mb-4">
								Real Results From <span className="text-yellow-400">Real Members</span>
							</h2>
							<p className="text-xl text-gray-300 max-w-3xl mx-auto">
								Our members consistently achieve profitable results using our proven strategies and alerts.
							</p>
						</div>

						<div className="grid md:grid-cols-2 gap-8 mb-12">
							<div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-400/30 rounded-xl p-6">
								<Image 
									src="/phone.png" 
									alt="Mobile Trading Results" 
									width={200} 
									height={300} 
									className="mx-auto mb-6"
								/>
								<div className="text-center">
									<h3 className="text-2xl font-bold mb-2">Mobile-First Experience</h3>
									<p className="text-gray-300 mb-4">Get alerts instantly on your phone and execute trades on the go.</p>
									<div className="bg-green-600/30 rounded-lg p-3 inline-block">
										<span className="text-green-300 font-semibold">+$12,847 This Month</span>
									</div>
								</div>
							</div>

							<div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-400/30 rounded-xl p-6">
								<Image 
									src="/laptop.png" 
									alt="Desktop Trading Platform" 
									width={300} 
									height={200} 
									className="mx-auto mb-6"
								/>
								<div className="text-center">
									<h3 className="text-2xl font-bold mb-2">Professional Analysis</h3>
									<p className="text-gray-300 mb-4">Access detailed charts, analysis, and educational content on our web platform.</p>
									<div className="bg-blue-600/30 rounded-lg p-3 inline-block">
										<span className="text-blue-300 font-semibold">78% Win Rate</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Testimonials Section */}
				<section id="testimonials" className="bg-gradient-to-b from-gray-900/50 to-black py-20">
					<div className="max-w-7xl mx-auto px-6">
						<div className="text-center mb-16">
							<h2 className="text-4xl md:text-5xl font-bold mb-4">
								What Our <span className="text-yellow-400">Members Say</span>
							</h2>
						</div>

						<div className="grid md:grid-cols-3 gap-8">
							{/* Testimonial 1 */}
							<div className="bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-blue-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-400/10 backdrop-blur-sm">
								<div className="flex items-center gap-1 mb-4">
									{[...Array(5)].map((_, i) => (
										<Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
									))}
								</div>
								<p className="text-gray-300 mb-4 italic">
									"I've been trading for 3 years and TradersUtopia completely changed my approach. 
									The alerts are incredibly accurate and the education is top-notch."
								</p>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
										M
									</div>
									<div>
										<div className="font-semibold">Marcus Chen</div>
										<div className="text-sm text-gray-400">Software Engineer, +$47K profit</div>
									</div>
								</div>
							</div>

							{/* Testimonial 2 */}
							<div className="bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-purple-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-400/10 backdrop-blur-sm">
								<div className="flex items-center gap-1 mb-4">
									{[...Array(5)].map((_, i) => (
										<Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
									))}
								</div>
								<p className="text-gray-300 mb-4 italic">
									"The live sessions are incredible. Being able to watch professionals trade 
									in real-time and explain their thinking is invaluable."
								</p>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
										S
									</div>
									<div>
										<div className="font-semibold">Sarah Johnson</div>
										<div className="text-sm text-gray-400">Marketing Director, +$23K profit</div>
									</div>
								</div>
							</div>

							{/* Testimonial 3 */}
							<div className="bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-2xl p-8 border border-gray-700/50 hover:border-green-400/50 transition-all duration-500 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-400/10 backdrop-blur-sm">
								<div className="flex items-center gap-1 mb-4">
									{[...Array(5)].map((_, i) => (
										<Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
									))}
								</div>
								<p className="text-gray-300 mb-4 italic">
									"Best investment I've made. The risk management strategies alone 
									have saved me thousands. Highly recommend to any serious trader."
								</p>
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
										D
									</div>
									<div>
										<div className="font-semibold">David Rodriguez</div>
										<div className="text-sm text-gray-400">Financial Advisor, +$89K profit</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Guarantee Section */}
				<section className="py-20">
					<div className="max-w-4xl mx-auto px-6 text-center">
						<div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-400/30 rounded-2xl p-8">
							<div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
								<Shield className="w-8 h-8 text-green-400" />
							</div>
							<h2 className="text-3xl font-bold mb-4">100% Risk-Free Guarantee</h2>
							<p className="text-xl text-gray-300 mb-6">
								Try TradersUtopia for 14 days completely free. If you're not satisfied, 
								get a full refund - no questions asked.
							</p>
							<div className="flex flex-wrap justify-center gap-6 text-sm">
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400" />
									<span>14-day free trial</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400" />
									<span>No credit card required</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400" />
									<span>Cancel anytime</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400" />
									<span>Money-back guarantee</span>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Final CTA Section */}
				<section id="pricing" className="bg-gradient-to-b from-gray-900/50 to-black py-20">
					<div className="max-w-4xl mx-auto px-6 text-center">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Start Your <span className="text-yellow-400">Trading Journey</span> Today
						</h2>
						<p className="text-xl text-gray-300 mb-8">
							Join 2,847+ successful traders and start receiving profitable trade alerts within minutes.
						</p>
						
						{/* Pricing */}
						<div className="bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 rounded-3xl p-10 border border-gray-700/50 mb-8 backdrop-blur-md shadow-2xl hover:border-yellow-400/50 transition-all duration-500">
							<div className="flex items-center justify-center gap-2 mb-4">
								<span className="text-gray-400 text-lg line-through">$199/month</span>
								<span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">SAVE $50</span>
							</div>
							<div className="text-5xl font-bold text-yellow-400 mb-2">$149</div>
							<div className="text-gray-300 mb-6">per month • 14-day free trial</div>
							
							<div className="space-y-4 mb-8">
								<SmartEntryButton />
								<p className="text-green-400 text-sm">✅ Start free trial instantly - no credit card required</p>
							</div>

							<div className="grid md:grid-cols-2 gap-4 text-left">
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400 flex-shrink-0" />
									<span className="text-sm">Real-time trade alerts</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400 flex-shrink-0" />
									<span className="text-sm">Live trading sessions</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400 flex-shrink-0" />
									<span className="text-sm">Expert market analysis</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400 flex-shrink-0" />
									<span className="text-sm">Premium community access</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400 flex-shrink-0" />
									<span className="text-sm">Risk management tools</span>
								</div>
								<div className="flex items-center gap-2">
									<Check className="w-4 h-4 text-green-400 flex-shrink-0" />
									<span className="text-sm">Educational resources</span>
								</div>
							</div>
						</div>

						<p className="text-gray-400 text-sm">
							Over 2,847 members • 4.9/5 rating • Join risk-free today
						</p>
					</div>
				</section>

				{/* Footer */}
				<footer className="border-t border-gray-800 py-12">
					<div className="max-w-7xl mx-auto px-6">
						<div className="grid md:grid-cols-4 gap-8">
							<div>
								<div className="flex items-center gap-3 mb-4">
									<div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
										<Image src="/logo.png" alt="TradersUtopia" width={20} height={20} />
									</div>
									<span className="text-white font-bold">TradersUtopia</span>
								</div>
								<p className="text-gray-400 text-sm">
									Professional trading signals and education platform trusted by thousands of traders worldwide.
								</p>
							</div>
							
							<div>
								<h4 className="text-white font-semibold mb-3">Product</h4>
								<div className="space-y-2 text-sm">
									<Link href="#features" className="text-gray-400 hover:text-white block">Features</Link>
									<Link href="#pricing" className="text-gray-400 hover:text-white block">Pricing</Link>
									<SubscriptionProtectedLink href="/dashboard" className="text-gray-400 hover:text-white block">
										Dashboard
									</SubscriptionProtectedLink>
								</div>
							</div>
							
							<div>
								<h4 className="text-white font-semibold mb-3">Support</h4>
								<div className="space-y-2 text-sm">
									<Link href="#" className="text-gray-400 hover:text-white block">Help Center</Link>
									<Link href="#" className="text-gray-400 hover:text-white block">Contact Us</Link>
									<Link href="#" className="text-gray-400 hover:text-white block">Terms of Service</Link>
								</div>
							</div>
							
							<div>
								<h4 className="text-white font-semibold mb-3">Legal</h4>
								<div className="space-y-2 text-sm">
									<Link href="#" className="text-gray-400 hover:text-white block">Privacy Policy</Link>
									<Link href="#" className="text-gray-400 hover:text-white block">Risk Disclosure</Link>
									<Link href="#" className="text-gray-400 hover:text-white block">SEC Compliance</Link>
								</div>
							</div>
						</div>
						
						<div className="border-t border-gray-800 pt-8 mt-8 text-center">
							<p className="text-gray-400 text-sm">
								© 2024 TradersUtopia. All rights reserved. Trading involves risk and may not be suitable for all investors.
							</p>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
} 