import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { AppProviders } from "@/components/providers";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Worklane",
    template: "%s · Worklane",
  },
  description: "From first conversation to final payment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${sourceSerif.variable} h-svh overflow-hidden antialiased`}
    >
      <body className="h-full overflow-hidden font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
