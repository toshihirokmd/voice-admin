import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-lg shadow p-8">
      <h1 className="text-2xl font-bold mb-2 text-red-700">アクセス権がありません</h1>
      <p className="text-sm text-gray-600">
        このページは管理者（admin）のみが閲覧できます。権限が必要な場合は管理者に依頼してください。
      </p>
      <Link href="/login" className="mt-4 inline-block text-blue-600 hover:underline">
        別のアカウントでログイン
      </Link>
    </div>
  );
}
