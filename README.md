# Voice Admin

音声書き起こしシステム（voice-transcription）の管理者用Webコンソール。

## 提供する機能

- **/recordings** — 録音一覧（検索・ページング・詳細・音声ダウンロード）
- **/prompt** — Geminiプロンプト編集（保存後、次の録音から即時反映）
- **/users** — ユーザー管理（display_name、role切替）

## ローカル開発

```bash
cp .env.local.example .env.local
# 値を埋める: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
# → http://localhost:3000
```

## Supabase 側の事前準備

1. マイグレーション `voice-transcription/supabase/migrations/20260427_add_auth_and_prompts.sql` を Supabase Studio で実行
2. **Authentication → Providers → Google** を有効化
   - Allowed email domain: `sakuraforest.co.jp`
   - Redirect URL に `http://localhost:3000/auth/callback` と本番URLを追加
3. Google Cloud Console で OAuth ClientID 発行 → Supabase に登録

## デプロイ（Vercel）

1. Vercel にこのフォルダを連携
2. Environment Variables に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定
3. デプロイ後、Supabase の Redirect URL に本番URLを追加

## アクセス制御

- 全ページ: ログイン必須（middleware で `/login` にリダイレクト）
- /recordings / /prompt / /users: `user_roles.role = 'admin'` のユーザーのみ

admin の昇格は SQL で直接実行:

```sql
update public.user_roles set role = 'admin' where email = 'foo@sakuraforest.co.jp';
```
