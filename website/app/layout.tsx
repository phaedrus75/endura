import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Endura — Study Smarter. Save Species.",
  description:
    "A gamified study app that turns your focus time into real conservation impact. Hatch endangered animals, build sanctuaries, and protect wildlife — one study session at a time.",
  keywords: [
    "study app",
    "conservation",
    "endangered species",
    "gamified learning",
    "focus timer",
    "wildlife",
    "charity",
  ],
  openGraph: {
    title: "Endura — Study Smarter. Save Species.",
    description:
      "Turn your study sessions into conservation impact. Hatch endangered animals, build sanctuaries, and study with friends.",
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
