import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Mono, Inter, Space_Grotesk, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Luffy TV — Anime, Movies & TV Shows",
  description: "Stream anime, movies, and TV shows online free. Watch subbed & dubbed anime, trending movies, popular TV series all in one place.",
  keywords: [
    "anime", "watch anime online", "free anime streaming", "movies",
    "TV shows", "HD anime", "trending anime", "Luffy TV", "streaming",
    "subbed", "dubbed", "watch movies free", "watch TV shows online",
  ],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📺</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${spaceMono.variable} ${inter.variable} ${spaceGrotesk.variable} ${outfit.variable} antialiased bg-[#000000] text-[#e2e8f0] selection:bg-[#E63946]/30 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
