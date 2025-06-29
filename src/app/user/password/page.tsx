import { PasswordManager } from "@/components/user/password-manager";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function PasswordPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <PasswordManager />;
}
