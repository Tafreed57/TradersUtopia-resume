import { redirect } from "next/navigation";

export default async function Home() {
	// Redirect all users to the dashboard for proper access control
	redirect("/dashboard");
}
