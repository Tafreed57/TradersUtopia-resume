import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traders Utopia - Login",
  description: "Access your professional trading community and signals.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen justify-center items-center">{children}</div>
  );
}
