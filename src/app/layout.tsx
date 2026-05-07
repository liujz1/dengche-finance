import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "项目损益账本",
  description: "dengche finance — 项目级损益账本（合伙人共录）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
