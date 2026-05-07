import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";

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
    <html
      lang="zh-CN"
      className={cn("h-full antialiased font-sans")}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
