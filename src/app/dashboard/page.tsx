import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { UserDetails } from "@/components/user/user-details";
import { ModeToggle } from "@/components/mode-toggler";
import { initProfile, getFirstServer } from "@/lib/query";
import {InitialModel} from "@/components/modals/initial-model";
import { redirect } from "next/navigation";
import { ProductPaymentGate } from "@/components/product-payment-gate";

export default async function Dashboard() {
	const profile = await initProfile();
	console.log(profile);

	// Check if user has any servers, if so redirect them to the first server
	const server = await getFirstServer(profile.id);
	
	// If getFirstServer found a server, it will have already redirected
	// If we reach this point, the user has no servers and should see the dashboard

	// Configure which Stripe products are allowed for dashboard access
	const allowedProductIds = [
		"prod_SWIyAf2tfVrJao", // Your current product ID
		// Add more product IDs here as you create them
	];

	return (
		<ProductPaymentGate 
			allowedProductIds={allowedProductIds}
			productName="Premium Dashboard Access"
			upgradeUrl="https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01"
			features={[
				"Exclusive dashboard access",
				"Advanced server management",
				"Premium support",
				"Priority features"
			]}
		>
			<main className="max-w-[75rem] w-full mx-auto">
				<div className="grid grid-cols-[1fr_20.5rem] gap-10 pb-10">
					<div>
						<header className="flex items-center justify-between w-full h-16 gap-4">
							<div className="flex gap-4">
								<ModeToggle />
							</div>
							<div className="flex items-center gap-2">
								<UserButton
									afterSignOutUrl="/"
									appearance={{
										elements: {
											userButtonAvatarBox: "size-6",
										},
									}}
								/>
							</div>
						</header>
						{!server && <InitialModel />}
						<UserDetails />
					</div>
				</div>
			</main>
		</ProductPaymentGate>
	);
} 