import "./globals.css";
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-noto-sans-jp",
});
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  IconDashboard,
  IconGauge,
  IconMe,
  IconMic,
  IconPrompt,
  IconProduct,
  IconUsers,
} from "./_components/NavIcons";
import { SignOutButton } from "./_components/SignOutButton";

export const metadata: Metadata = {
  title: "Voice Admin",
  description: "音声書き起こしの管理コンソール",
};

const navLinkCls =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-brand-sub hover:bg-brand-soft hover:text-brand-green transition";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="bg-brand-bg text-brand-ink min-h-screen">
        <header className="bg-white border-b border-brand-border">
          <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-soft text-brand-green text-lg">
                🌳
              </span>
              <span className="text-lg font-extrabold text-brand-green tracking-tight">
                Voice Admin
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium">
              {user && (
                <>
                  <Link href="/" className={navLinkCls}>
                    <IconDashboard className="text-brand-leaf" />
                    ダッシュボード
                  </Link>
                  <Link href="/me" className={navLinkCls}>
                    <IconMe className="text-brand-leaf" />
                    マイページ
                  </Link>
                  {/* アップロード書き起こしは admin/operator 問わず全員が使える */}
                  <Link href="/uploads" className={navLinkCls}>
                    <IconMic className="text-brand-leaf" />
                    アップロード
                  </Link>
                  {/* 評価ポイントの説明ページは全員が見られる（評価結果自体はadmin限定） */}
                  <Link href="/hyoka-points" className={navLinkCls}>
                    <IconGauge className="text-brand-leaf" />
                    評価ポイント
                  </Link>
                  {user.role === "admin" && (
                    <>
                      <Link href="/recordings" className={navLinkCls}>
                        <IconMic className="text-brand-leaf" />
                        録音一覧
                      </Link>
                      <Link href="/prompt" className={navLinkCls}>
                        <IconPrompt className="text-brand-leaf" />
                        プロンプト
                      </Link>
                      <Link href="/products" className={navLinkCls}>
                        <IconProduct className="text-brand-leaf" />
                        商品
                      </Link>
                      <Link href="/users" className={navLinkCls}>
                        <IconUsers className="text-brand-leaf" />
                        ユーザー
                      </Link>
                    </>
                  )}
                  <span className="text-brand-sub pl-3 ml-2 border-l border-brand-border">
                    {user.displayName ?? user.email}
                    <span className="text-brand-leaf text-xs font-bold ml-1">
                      （{user.role ?? "未設定"}）
                    </span>
                  </span>
                  <SignOutButton />
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
