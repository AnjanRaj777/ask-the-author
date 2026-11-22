import { LoginClient } from "@/components/auth/LoginClient";

export const metadata = { title: "Sign in · Ask the Author" };

export default function LoginPage() {
  return (
    <main
      className="relative grid min-h-svh place-items-center bg-cover bg-center px-6 py-12"
      style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-paper/35" />
      <LoginClient />
    </main>
  );
}
