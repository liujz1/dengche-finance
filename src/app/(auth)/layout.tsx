import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle className="text-xl">项目损益账本 — 登录</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
