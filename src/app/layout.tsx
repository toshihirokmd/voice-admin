import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  IconDashboard,
  IconMe,
  IconMic,
  IconPrompt,
  IconProduct,
  IconUsers,
} from "./_components/NavIcons";

export const metadata: Metadata = {
  title: "Voice Admin",
  description: "音声書き起こしの管理コンソール",
};

const navLinkCls =
  "inline-flex items-center gap-1.5 text-gray-700 hover:text-blue-700 hover:underline transition";

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
          <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold">
              Voice Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user && (
                <>
                  {user.role === "admin" && (
                    <Link href="/" className={navLinkCls}>
                      <IconDashboard className="text-blue-500" />
                      ダッシュボード
                    </Link>
                  )}
                  <Link href="/me" className={navLinkCls}>
                    <IconMe className="text-emerald-500" />
                    マイページ
                  </Link>
                  {user.role === "admin" && (
                    <>
                      <Link href="/recordings" className={navLinkCls}>
                        <IconMic className="text-violet-500" />
                        録音一覧
                      </Link>
                      <Link href="/prompt" className={navLinkCls}>
                        <IconPrompt className="text-amber-500" />
                        プロンプト
                      </Link>
                      <Link href="/products" className={navLinkCls}>
                        <IconProduct className="text-rose-500" />
                        商品
                      </Link>
                      <Link href="/users" className={navLinkCls}>
                        <IconUsers className="text-slate-500" />
                        ユーザー
                      </Link>
                    </>
                  )}
                  <span className="text-gray-500 pl-3 ml-1 border-l border-gray-200">
                    {user.displayName ?? user.email}
                    <span className="text-gray-400 text-xs ml-1">
                      （{user.role ?? "未設定"}）
                    </span>
                  </span>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-[1600px] mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
