# CLAUDE.md — 空き時間カレンダー（日程調整ツール）

このリポジトリは Claude Code で立ち上げる前提の「種（seed）」です。
**まずこの全文を読んでから着手してください。** ゴール・スタック・やること・やらないことを定義しています。

---

## ゴール

調整さんのような日程調整ツール。ただし入力体験を「カレンダーをドラッグで塗るだけ」にする。

- 無料・**参加者はアカウント不要**（リンクを開いて名前を入れて塗るだけ）
- イベント単位（`/e/{id}`）。トップ `/` で新規作成＋過去履歴から並行イベントを切替
- 複数人の空きを集約し、**重なりが濃い時間帯を候補として提示**
- 非同期がメイン（各自が好きな時に入力）。同期（その場で一斉入力）も同じ仕組みで動く

## 確定済みの技術判断（変更しないこと）

- **フロント**：Vite + React（静的SPA）。GitHub Pages でも Vercel でも動かせる
- **バックエンド**：Firebase **Firestore**（無料 Spark プラン）。理由＝休止しない＝keep-alive不要
- **認証**：Firebase **匿名認証**。端末ごとに uid を発行し、回答ドキュメントを uid でキー化
- **ルーティング**：**HashRouter**（静的ホスティングで直リンク404を避けるため。`src/App.jsx` 参照）
- **集約にユーザーアカウントは不要**。本人判定は匿名 uid ＋ Firestore ルールで担保
- リアルタイムは Firestore の `onSnapshot` で“ついで”に得る（専用の作り込みはしない）

## データモデル（Firestore）

```
events/{eventId}
  title: string
  settings: { startHour: number, endHour: number }
  createdAt: serverTimestamp
  ownerUid: string

events/{eventId}/responses/{uid}     // docId = 匿名認証の uid
  name: string
  color: string
  slots: string[]                    // "YYYY-MM-DD|<分>" 例 "2026-06-18|840"
  updatedAt: serverTimestamp
```

セキュリティルールは `firestore.rules` にある（他人の行は壊せない／設定変更はオーナーのみ）。

---

## セットアップ手順（Claude Code が実行）

1. このフォルダで Vite の React 雛形を生成する（既存の `src/` を壊さないこと）：
   ```
   npm create vite@latest . -- --template react
   ```
   - 競合したら、生成物のうち `package.json` / `vite.config.js` / `index.html` / `src/main.jsx` / `.gitignore` だけ採用し、
     **既存の `src/App.jsx`・`src/firebase.js`・`src/pages/`・`src/components/`・`src/lib/` は保持**する。
   - `src/main.jsx` は雛形のままでよい（`<App />` を描画。App 内で HashRouter を張っている）。
   - 不要な `src/App.css` の派手なテンプレCSSは消すか無視。`index.css` は最小限（margin:0 程度）に。

2. 依存を追加：
   ```
   npm i firebase react-router-dom
   ```

3. `.env.example` を `.env` にコピー（値は人間が後で入れる。下記「人間がやること」）。
   `.gitignore` に `.env` が入っていることを確認（無ければ追加）。

4. `npm run dev` で起動し、以下を**実際に確認して、壊れていたら直す**：
   - `/` で新規作成 → `/e/{id}` に遷移
   - 名前未入力でも塗れる（下書き）。名前を入れて保存すると共有対象になる
   - 別ブラウザ/シークレットで同じ `/e/{id}` を開き、別名で塗ると、双方に重なりが出る
   - 「重なりを見る」でヒートマップ＋候補が出る。当日以前はグレーで操作不可
   - トップに履歴が出て、別イベントへ切り替えられる

5. ビルド確認：`npm run build && npm run preview`

## デプロイ（どちらか）

- **Vercel（推奨・簡単）**：リポジトリを接続して deploy。環境変数 `VITE_FB_*` を Vercel 側にも設定。HashRouter なのでリライト設定は不要。
- **GitHub Pages**：`vite.config.js` の `base` をリポジトリ名に（例 `base: '/aki-calendar/'`）。`gh-pages` で `dist` を公開、または GitHub Actions。HashRouter なので 404 フォールバックは不要。

## 人間がやること（Claude Code では代行不可・約5分）

1. Firebase コンソールでプロジェクト作成
2. **Firestore Database** を有効化（本番モードで開始 → ルールは `firestore.rules` を貼る）
3. **Authentication → Sign-in method → 匿名（Anonymous）を有効化**
4. プロジェクト設定 → ウェブアプリを追加 → SDK設定の値を `.env` に貼る
5. （任意）`firebase deploy --only firestore:rules` でルールを反映、または手動でコンソールに貼る

---

## やらないこと（MVPスコープ外）

- ファシリテーターが1画面で複数人ぶん入力する機能（匿名uid＝1人1行モデルに統一したため除外）
- メール通知、確定機能、SSR、PWAオフライン同期
- イベントページの SEO 対応（むしろ将来は `/e/` を noindex 推奨。他人の予定が検索に出ないように）

## コード規約

- 既存ファイルのスタイル（インラインstyleオブジェクト `S`）を踏襲。新規CSSフレームワークは入れない
- 日本語UI。コメントも日本語でよい
- Firestore I/O は EventPage に集約。`AvailabilityCalendar` は props と callback だけで動く純粋なUI
- 破壊的変更や設計判断を変える前に、この CLAUDE.md と矛盾しないか確認すること
