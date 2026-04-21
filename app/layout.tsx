import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { NavigationProgressProvider } from "@/components/navigation-progress";
import "./globals.css";

export const metadata: Metadata = {
  title: "RebateClub Feedback Ops",
  description: "Operations software for campaigns, participant tracking, submissions, and payouts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<div className="page-loading-shell" />}>
          <NavigationProgressProvider>{children}</NavigationProgressProvider>
        </Suspense>
      </body>
    </html>
  );
}
