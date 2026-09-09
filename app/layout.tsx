import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "AdvisorOS", description: "Turn client conversations into clear records and next steps." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
