import { requireUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type Axis = {
  key: string;
  title: string;
  subtitle: string;
  anchors: [string, string, string, string];
};

// 本文の軸定義は cloudrun/finalize/voice_host/transcriber.py の DEPTH_SYSTEM アンカーと一致させている。
// 変更する場合は両方を揃えること。
const AXES: Axis[] = [
  {
    key: "problem_depth",
    title: "① 悩みの深さ",
    subtitle: "お客様側から、どれだけ引き出せたか",
    anchors: [
      "用件のみ",
      "症状・事実まで",
      "背景・生活・経緯まで",
      "願望・価値観まで",
    ],
  },
  {
    key: "relationship",
    title: "② 関係の距離",
    subtitle: "用件・症状・商品の話は含めない。世間話・私的な話題だけで見る",
    anchors: [
      "事務的なやり取りのみ",
      "軽い世間話がある",
      "個人的な話題まで踏み込めた",
      "私的な打ち明けがあった",
    ],
  },
  {
    key: "value_delivery",
    title: "③ 商品価値（価値伝達・自社主導）",
    subtitle: "オペレーターが主導で、どれだけ価値を伝えられたか",
    anchors: [
      "価値に触れず事務のみ",
      "理由のない表面的な指示",
      "根拠つきで説明できた",
      "個別化して設計思想まで伝えた",
    ],
  },
];

export default async function HyokaPointsPage() {
  // 全ログインユーザーが閲覧可（評価結果そのものは管理者限定・このページは説明のみ）。
  await requireUser();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
      <header>
        <p className="text-xs font-bold text-brand-leaf tracking-widest">CALL QUALITY</p>
        <h1 className="text-3xl font-extrabold text-brand-green">応対の評価ポイント</h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="mt-3 text-xs text-brand-sub leading-relaxed">
          通話は「①悩みの深さ」「②関係の距離」「③商品価値」の3軸・各0〜3で自動評価されます。
          測るのは応対の丁寧さや正しさではなく、①②は<b className="text-brand-ink">お客様からどれだけ引き出せたか</b>、
          ③は<b className="text-brand-ink">こちらから主導でどれだけ価値を伝えられたか</b>です。
          自分の応対で何を見られているかの理解に使ってください（評価結果の一覧は管理者のみ閲覧できます）。
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-brand-green">3軸のアンカー（0〜3）</h2>
        {AXES.map((axis) => (
          <div
            key={axis.key}
            className="bg-white border border-brand-border rounded-card shadow-soft overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-brand-border bg-brand-soft">
              <p className="font-bold text-brand-green text-sm">{axis.title}</p>
              <p className="text-xs text-brand-sub mt-0.5">{axis.subtitle}</p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {axis.anchors.map((text, score) => (
                  <tr key={score} className="border-t border-brand-border first:border-t-0">
                    <td className="py-2.5 px-4 w-14 whitespace-nowrap align-top">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-soft text-brand-green text-xs font-bold">
                        {score}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-brand-ink">{text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-green">受電と掛け電で主眼が違う</h2>
        <div className="bg-white border border-brand-border rounded-card shadow-soft p-4 space-y-2 text-sm text-brand-ink">
          <p>
            <span className="font-bold text-brand-green">受電</span>
            　お客様が発信元。お客様から<b>どれだけ引き出せたか</b>が中心（①②が主役）。
          </p>
          <p>
            <span className="font-bold text-brand-green">掛け電</span>
            　オペレーターが発信元。こちらから<b>価値を伝え・関係を築けたか</b>が主役（③が主役、①②も加点対象）。
          </p>
          <p className="text-xs text-brand-sub pt-1 border-t border-brand-border">
            解約の電話でも深耕はできます。解約＝低評価ではありません。原文に明確な根拠がある時だけ加点する厳しめの基準で評価しています。
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-green">評価イメージ（架空の例・実際の通話ではありません）</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-white border border-brand-border rounded-card shadow-soft p-4 space-y-2">
            <p className="text-xs font-bold text-brand-leaf tracking-widest">受電の例</p>
            <p className="text-xs text-brand-sub">
              「お届け日を変更したい」という用件のみで、雑談や深掘りのやり取りがなかったケース。
            </p>
            <ul className="text-sm space-y-1 pt-1">
              <li>悩みの深さ：<b>0</b>（用件のみで、症状や事情の話は出なかった）</li>
              <li>関係の距離：<b>0</b>（事務的なやり取りのみ）</li>
              <li>商品価値：<b>1</b>（「そのまま継続でよろしいですか」程度の、理由のない表面的な案内）</li>
            </ul>
          </div>
          <div className="bg-white border border-brand-border rounded-card shadow-soft p-4 space-y-2">
            <p className="text-xs font-bold text-brand-leaf tracking-widest">掛け電の例</p>
            <p className="text-xs text-brand-sub">
              定期購入のフォローコールで、生活の変化や困りごとまで聞けたケース。
            </p>
            <ul className="text-sm space-y-1 pt-1">
              <li>悩みの深さ：<b>2</b>（「最近階段の上り下りがつらい」など背景・生活まで聞けた）</li>
              <li>関係の距離：<b>1</b>（世間話が少し出た程度）</li>
              <li>商品価値：<b>2</b>（「プロテオグリカンが膝の負担を和らげる」と理由つきで説明できた）</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
