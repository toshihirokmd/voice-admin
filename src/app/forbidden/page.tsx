import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-lg shadow p-8 space-y-4">
      <h1 className="text-2xl font-bold text-red-700">アクセス権がありません</h1>
      <p className="text-sm text-gray-600">
        このページは管理者（admin）のみが閲覧できます。
        ダッシュボードと自分のマイページは閲覧できますので、そちらをご利用ください。
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          href="/me"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          マイページへ
        </Link>
        <Link
          href="/"
          className="inline-block bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm"
        >
          ダッシュボードへ
        </Link>
        <Link
          href="/login"
          className="inline-block text-blue-600 hover:underline text-sm py-2"
        >
          別のアカウントでログイン
        </Link>
      </div>
    </div>
  );
}
