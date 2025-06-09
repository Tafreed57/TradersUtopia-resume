import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggler";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
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
				<div className="flex items-center gap-3">
					<Image src="/logo.svg" alt="TradersUtopia" width={32} height={32} />
					<span className="text-white text-xl font-bold">TradersUtopia</span>
				</div>
				<ModeToggle />
			</header>

			{/* Main Content */}
			<main className="flex flex-col items-center justify-center min-h-[calc(100vh-180px)] px-6">
				<div className="text-center max-w-4xl mx-auto">
					<h1 className="text-3xl md:text-7xl font-bold text-white mb-6 leading-tight">
						Welcome to Traders Utopia
						<br />
						<span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
							Community Hub
						</span>
					</h1>
					
					<p className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed">
					👋 Welcome to Traders Utopia! 🌟 Join a vibrant trading community where passion meets expertise. At Traders Utopia, we bring together traders of all levels to share insights, strategies, and real opportunities.
						<br />
						
					</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
						<Link href="/pricing">
							<Button 
								size="lg" 
								className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
							>
								Enter Traders Utopia
							</Button>
						</Link>
						
						<p className="text-gray-400 text-sm">
							Click to access your servers and communities
						</p>
					</div>
				</div>
			</main>
		</div>
	);
} 