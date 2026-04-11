import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Endura — A study timer app to hatch your potential",
  description:
    "Endura turns every focused study session into an endangered animal you hatch, collect, and protect. Finally, a reason to sit down and do the work.",
  keywords: [
    "study app",
    "conservation",
    "endangered species",
    "gamified learning",
    "focus timer",
    "wildlife",
    "WWF",
  ],
  openGraph: {
    title: "Endura — A study timer app to hatch your potential",
    description:
      "Endura turns every focused study session into an endangered animal you hatch, collect, and protect. Finally, a reason to sit down and do the work.",
    type: "website",
    locale: "en_GB",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
