import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "MyFinance — Your Personal CFO", description: "Private personal finance dashboard" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }
