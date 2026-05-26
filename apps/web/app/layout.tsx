import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buy & Sell",
  description: "Multi-source stock screening with Claude evaluation.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#0f1117",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="app-header">
            <div className="app-title">
              <span className="logo">📈</span>
              <span>Buy &amp; Sell</span>
            </div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              Multi-source screening · Claude Sonnet 4.6
            </div>
          </header>
          <AppNav />
          {children}
          <footer className="app-footer">
            <p>
              Diese Analyse dient nur zu Informationszwecken und stellt keine Kauf- oder
              Verkaufsempfehlung dar. Daten bis zu 20 Min. verzögert.
            </p>
            <p style={{ marginTop: 6 }}>
              Buy &amp; Sell · powered by Supabase + Vercel + Anthropic
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
