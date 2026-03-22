import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "SplitMyWay — Shared expense tracker",
  description: "Split expenses. Not friendships.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className={`${geist.className} bg-white antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
