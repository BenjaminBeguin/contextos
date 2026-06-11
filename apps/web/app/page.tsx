import { redirect } from "next/navigation";

// The marketing landing lives in apps/landing. The product app routes its
// root straight to the dashboard (which gates on auth).
export default function Home() {
  redirect("/dashboard");
}
