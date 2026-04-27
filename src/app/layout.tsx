import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Voice Admin",
  description: "音声書き起こしの管理コンソール",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/recordings" className="text-lg font-semibold">
              Voice Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user?.role === "admin" && (
                <>
                  <Link href="/recordings" className="hover:underline">録音一覧</Link>
                  <Link href="/prompt" className="hover:underline">プロンプト</Link>
                  <Link href="/products" className="hover:underline">商品</Link>
                  <Link href="/users" className="hover:underline">ユーザー</Link>
                </>
              )}
              {user && (
                <span className="text-gray-600">
                  {user.displayName ?? user.email}（{user.role ?? "未設定"}）
                </span>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
