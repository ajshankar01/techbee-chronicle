import type { Metadata } from "next";
import "./globals.css";
import HexBackgroundWrapper from "../components/HexBackgroundWrapper";

export const metadata: Metadata = {
  title: "Techbee Chronicle Interview Platform",
  description: "Candidate evaluation platform for the Techbee Chronicle program",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <HexBackgroundWrapper />
        {children}
      </body>
    </html>
  );
}
