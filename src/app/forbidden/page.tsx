import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="max-w-md mx-auto mt-12 bg-white border border-brand-border rounded-card shadow-soft p-8 space-y-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-ssoft text-base">
          🔒
        </span>
        <h1 className="text-2xl font-extrabold text-brand-sakura">アクセス権がありません</h1>
      </div>
      <p className="text-sm text-brand-sub">
        このページは管理者（admin）のみが閲覧できます。
        ダッシュボードと自分のマイページは閲覧できますので、そちらをご利用ください。
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link
          href="/me"
          className="inline-block bg-brand-green text-white px-4 py-2 rounded-xl font-bold hover:bg-brand-dark transition text-sm"
        >
          マイページへ
        </Link>
        <Link
          href="/"
          className="inline-block bg-white border border-brand-border text-brand-sub px-4 py-2 rounded-lg hover:bg-brand-soft transition text-sm"
        >
          ダッシュボードへ
        </Link>
        <Link
          href="/login"
          className="inline-block text-brand-green hover:underline text-sm py-2"
        >
          別のアカウントでログイン
        </Link>
      </div>
    </div>
  );
}
