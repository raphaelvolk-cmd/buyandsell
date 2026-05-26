"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/universe", label: "Universe" },
  { href: "/runs", label: "Runs" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/login") || pathname?.startsWith("/auth")) return null;
  return (
    <nav className="app-nav">
      {tabs.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname?.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
