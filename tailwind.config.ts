import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // さくらの森 ブランドトークン（.claude/design.md §2 準拠）
      colors: {
        brand: {
          green: "#17683B", // 主役：フォレストグリーン
          dark: "#0F5530", // ホバー濃色
          leaf: "#54AF77", // アクセント：リーフグリーン
          sakura: "#F06E8E", // 差し色：サクラピンク
          bg: "#F4F8F1", // ベース背景：ミストグリーン
          soft: "#E4F4E9", // 淡カード：ペールリーフ
          ssoft: "#FBE9ED", // 淡桜
          ink: "#1C3B2A", // 本文
          sub: "#5C7868", // 補足
          border: "#DCEAE0", // 罫線
        },
      },
      boxShadow: {
        soft: "0 4px 16px rgba(23,104,59,0.08)",
        softlg: "0 8px 28px rgba(23,104,59,0.10)",
      },
      borderRadius: { card: "16px" },
    },
  },
  plugins: [],
};

export default config;
