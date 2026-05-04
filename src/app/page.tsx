import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Home() {
  // TZ=America/Denver is set on the pod; fallback to UTC-6 offset
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", {
    timeZone: process.env.TZ || "America/Denver",
  });
  redirect(`/daily/${today}`);
}
