import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QUANTIVA — Trading Journal",
  description: "A focused trading journal for disciplined traders.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}