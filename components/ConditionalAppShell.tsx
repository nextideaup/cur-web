"use client";
import { usePathname } from "next/navigation";
import AppShell from "./AppShell";
export default function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register" || pathname === "/privacy") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
