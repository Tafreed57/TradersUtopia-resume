"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
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
	DollarSign
} from "lucide-react";

export default function Home() {
	const [timeLeft, setTimeLeft] = useState({
		hours: 23,
		minutes: 45,
		seconds: 30
	});

	const [currentProfit, setCurrentProfit] = useState(247850);
	const [activeTraders, setActiveTraders] = useState(1247);

	useEffect(() => {
		const timer = setInterval(() => {
			setTimeLeft(prev => {
				if (prev.seconds > 0) {
					return { ...prev, seconds: prev.seconds - 1 };
				} else if (prev.minutes > 0) {
					return { minutes: prev.minutes - 1, seconds: 59 };
				} else if (prev.hours > 0) {
					return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
				} else {
					return { hours: 23, minutes: 59, seconds: 59 };
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
		<div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black text-white overflow-hidden">
			{/* Hero Section */}
			<div className="relative">
				{/* Background Effects */}
				<div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-green-600/10"></div>
				<div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
				<div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
				
				<div className="relative container mx-auto px-4 py-16">
					{/* Urgency Banner */}
					<div className="flex items-center justify-center mb-8">
						<div className="bg-gradient-to-r from-red-600 to-orange-500 px-6 py-2 rounded-full flex items-center gap-2 animate-pulse">
							<Clock size={16} />
							<span className="text-sm font-semibold">LIMITED TIME: 50% OFF EXPIRES IN</span>
							<span className="bg-black/30 px-2 py-1 rounded text-xs font-mono">
								{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
							</span>
						</div>
					</div>

					{/* Main Hero */}
					<div className="text-center max-w-6xl mx-auto">
						<div className="flex items-center justify-center gap-4 mb-6">
							<div className="flex">
								{[...Array(5)].map((_, i) => (
									<Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
								))}
							</div>
							<span className="text-yellow-400 font-semibold">Trusted by 1,000+ Active Traders</span>
						</div>

						<h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
							<span className="bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
								77% WIN RATE
							</span>
							<br />
							<span className="text-white">PROVEN TRACK RECORD</span>
						</h1>

						<p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
							Join the elite trading community that's generated <span className="text-green-400 font-bold">${currentProfit.toLocaleString()}</span> in verified profits over 2 years. 
							Our professional-grade alerts have consistently delivered results for serious traders.
						</p>

						{/* Live Stats Bar */}
						<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-8 grid md:grid-cols-4 gap-6">
							<div className="text-center">
								<div className="text-3xl font-bold text-green-400">77%</div>
								<div className="text-sm text-gray-400">Win Rate</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-blue-400">{activeTraders}</div>
								<div className="text-sm text-gray-400">Active Members</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-purple-400">2+</div>
								<div className="text-sm text-gray-400">Years Proven</div>
							</div>
							<div className="text-center">
								<div className="text-3xl font-bold text-yellow-400">24/7</div>
								<div className="text-sm text-gray-400">Market Coverage</div>
							</div>
						</div>

						{/* CTA Buttons */}
						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
							<Button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg px-8 py-4 rounded-xl transform hover:scale-105 transition-all duration-200 shadow-lg shadow-green-500/25">
								<Zap className="mr-2" size={20} />
								GET INSTANT ACCESS - 50% OFF
							</Button>
							<Button variant="outline" className="border-2 border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 rounded-xl backdrop-blur-sm">
								View Live Performance
								<ArrowRight className="ml-2" size={20} />
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Social Proof Section */}
			<div className="bg-slate-800/30 py-16">
				<div className="container mx-auto px-4">
					<div className="text-center mb-12">
						<h2 className="text-3xl font-bold mb-4">Trusted by Professional Traders Worldwide</h2>
						<p className="text-gray-400">Real results from real members of our exclusive trading community</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
						{[
							{
								name: "Michael R.",
								role: "Day Trader",
								profit: "+$47,820",
								quote: "Best signals I've ever received. The accuracy is incredible and the entry/exit timing is perfect.",
								avatar: "🚀"
							},
							{
								name: "Sarah L.", 
								role: "Swing Trader",
								profit: "+$23,450",
								quote: "2 years with this service and I'm consistently profitable. The education alone is worth 10x the price.",
								avatar: "💎"
							},
							{
								name: "David K.",
								role: "Options Trader", 
								profit: "+$62,180",
								quote: "From losing money to making 6 figures. This community changed my entire trading career.",
								avatar: "⚡"
							}
						].map((testimonial, i) => (
							<div key={i} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-green-500/50 transition-all duration-300">
								<div className="flex items-center gap-4 mb-4">
									<div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-2xl">
										{testimonial.avatar}
									</div>
									<div>
										<div className="font-semibold">{testimonial.name}</div>
										<div className="text-sm text-gray-400">{testimonial.role}</div>
									</div>
									<div className="ml-auto text-green-400 font-bold">{testimonial.profit}</div>
								</div>
								<p className="text-gray-300 italic">"{testimonial.quote}"</p>
								<div className="flex mt-4">
									{[...Array(5)].map((_, j) => (
										<Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Features Section */}
			<div className="py-20">
				<div className="container mx-auto px-4">
					<div className="text-center mb-16">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Professional-Grade Trading Intelligence
						</h2>
						<p className="text-xl text-gray-400 max-w-3xl mx-auto">
							Everything you need to trade like a pro, backed by 2 years of consistent performance
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
						{[
							{
								icon: <Target className="w-8 h-8" />,
								title: "Precision Entry/Exit Signals",
								description: "Get exact entry points, stop losses, and profit targets with mathematical precision.",
								color: "from-blue-500 to-cyan-500"
							},
							{
								icon: <BarChart3 className="w-8 h-8" />,
								title: "Advanced Market Analysis",
								description: "Deep technical and fundamental analysis delivered before market opens daily.",
								color: "from-purple-500 to-pink-500"
							},
							{
								icon: <Shield className="w-8 h-8" />,
								title: "Risk Management System",
								description: "Professional position sizing and risk controls to protect your capital.",
								color: "from-green-500 to-emerald-500"
							},
							{
								icon: <Users className="w-8 h-8" />,
								title: "Elite Community Access",
								description: "Connect with successful traders and share strategies in our private Discord.",
								color: "from-orange-500 to-red-500"
							},
							{
								icon: <Award className="w-8 h-8" />,
								title: "Live Education Sessions",
								description: "Weekly masterclasses and Q&A sessions with our professional trading team.",
								color: "from-yellow-500 to-orange-500"
							},
							{
								icon: <DollarSign className="w-8 h-8" />,
								title: "Multiple Asset Classes",
								description: "Forex, Stocks, Crypto, and Options - diversify across all major markets.",
								color: "from-indigo-500 to-blue-500"
							}
						].map((feature, i) => (
							<div key={i} className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
								<div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
									{feature.icon}
								</div>
								<h3 className="text-xl font-bold mb-3">{feature.title}</h3>
								<p className="text-gray-400 leading-relaxed">{feature.description}</p>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Urgency Section */}
			<div className="bg-gradient-to-r from-red-900/20 via-orange-900/20 to-yellow-900/20 py-16">
				<div className="container mx-auto px-4 text-center">
					<div className="max-w-4xl mx-auto">
						<h2 className="text-4xl md:text-5xl font-bold mb-6">
							Don't Let This Opportunity Slip Away
						</h2>
						<p className="text-xl mb-8 text-gray-300">
							We're limiting access to maintain signal quality. Only <span className="text-red-400 font-bold">47 spots remaining</span> at this price.
						</p>
						
						<div className="bg-slate-800/50 backdrop-blur-sm border border-red-500/50 rounded-2xl p-8 mb-8">
							<div className="grid md:grid-cols-2 gap-8 items-center">
								<div>
									<div className="text-6xl font-bold text-red-400 mb-2">47</div>
									<div className="text-xl">Spots Remaining</div>
									<div className="text-sm text-gray-400 mt-2">At Current Pricing</div>
								</div>
								<div>
									<div className="text-3xl font-bold mb-4">
										<span className="line-through text-gray-500">$297/month</span>
										<span className="text-green-400 ml-4">$147/month</span>
									</div>
									<div className="text-sm text-yellow-400">⚡ 50% OFF - Limited Time</div>
								</div>
							</div>
						</div>

						<Button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-xl px-12 py-6 rounded-xl transform hover:scale-105 transition-all duration-200 shadow-lg shadow-green-500/25">
							<Zap className="mr-3" size={24} />
							SECURE YOUR SPOT NOW - $147/MONTH
						</Button>
						
						<p className="text-sm text-gray-400 mt-4">
							💳 Secure payment • 🔒 Cancel anytime • ⚡ Instant access
						</p>
					</div>
				</div>
			</div>

			{/* Final Stats */}
			<div className="py-16 bg-slate-900">
				<div className="container mx-auto px-4 text-center">
					<div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
						<div>
							<div className="text-4xl font-bold text-green-400 mb-2">$2.4M+</div>
							<div className="text-gray-400">Member Profits Generated</div>
						</div>
						<div>
							<div className="text-4xl font-bold text-blue-400 mb-2">98.2%</div>
							<div className="text-gray-400">Member Satisfaction</div>
						</div>
						<div>
							<div className="text-4xl font-bold text-purple-400 mb-2">24/7</div>
							<div className="text-gray-400">Support Available</div>
						</div>
						<div>
							<div className="text-4xl font-bold text-yellow-400 mb-2">2.1K+</div>
							<div className="text-gray-400">Successful Signals</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
