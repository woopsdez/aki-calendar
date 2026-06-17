# 空き時間カレンダー

カレンダーをドラッグで塗るだけの日程調整ツール。リンクを共有すると、相手はアカウントなしで空き時間を書き込め、重なりが濃い時間帯が候補として出ます。

## クイックスタート

```bash
npm create vite@latest . -- --template react   # 既存 src/ は保持（CLAUDE.md参照）
npm i firebase react-router-dom
cp .env.example .env                            # 値はFirebaseコンソールから
npm run dev
```

詳しい手順・設計・Firebase側の設定は **CLAUDE.md** を参照（Claude Code に渡せばそのまま立ち上げられます）。

## スタック

- Vite + React（静的SPA、HashRouter）
- Firebase Firestore（無料Sparkプラン）＋ 匿名認証
- ホスティング：Vercel か GitHub Pages

## Firebase側で必要な設定（人間が一度だけ）

1. プロジェクト作成
2. Firestore 有効化 → ルールは `firestore.rules` を貼る
3. Authentication で「匿名」を有効化
4. ウェブアプリのSDK設定を `.env` に貼る
