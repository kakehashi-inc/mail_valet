# Mail Valet

## 1. システム概要

Mail Valetは、複数のGmailアカウントを一括管理し、不要メールの効率的な整理を支援するデスクトップアプリケーションです。

### 主な機能

- **複数Gmailアカウント管理**: OAuth2認証による安全なマルチアカウント対応
- **メールサンプリング**: 日数または日付範囲指定でメールを取得し、From別またはSubject別にグループ化
- **Ollama AI判定**: ローカルAIによるマーケティング度・迷惑度の自動判定（0-10段階）
- **一括削除**: 不要なグループのメールをゴミ箱に一括移動（重要/スター付きは除外可能）
- **期間削除**: サンプリング済みメールのみをピンポイントで削除
- **詳細表示**: グループごとのメール一覧・本文・生データをモーダレスウィンドウで表示
- **ラベル管理**: Gmailラベルのツリー表示と取得対象の選択
- **多言語対応**: 日本語/英語（OS言語自動検出）
- **テーマ**: ライト/ダークモード（OSテーマ自動検出）
- **データ管理**: 設定エクスポート/インポート、AI判定キャッシュ/全キャッシュクリア

### 技術スタック

| 分類 | 技術 |
| ------ | ------ |
| フレームワーク | Electron 38 |
| フロントエンド | React 19 + MUI v7 |
| 言語 | TypeScript 5 |
| 状態管理 | Zustand 5 |
| 多言語 | i18next |
| ビルド | Vite 7 (Renderer) / tsc (Main) |
| 外部連携 | GCP Gmail API, Ollama |
| データ保存 | `~/.mailvalet/` (ファイルベースJSON + AES-256-GCM暗号化) |

## 2. 対応OS

- Windows 10/11
- macOS 10.15+
- Linux (Debian系/RHEL系)

注記: 本プロジェクトは Windows ではコード署名を行っていません。SmartScreen が警告を表示する場合は「詳細情報」→「実行」を選択してください。

## 3. 開発者向けリファレンス

### 開発ルール

- 開発者の参照するドキュメントは`README.md`を除き`Documents`に配置すること。
- 対応後は必ずリンターで確認を行い適切な修正を行うこと。故意にリンターエラーを許容する際は、その旨をコメントで明記すること。 **ビルドはリリース時に行うものでデバックには不要なのでリンターまでで十分**
- 一時的なスクリプトなど（例:調査用スクリプト）は`scripts`ディレクトリに配置すること。
- データモデルの実装時は、テーブル単位でファイルを配置すること。
- データモデルを作成および変更を加えた場合は、`Documents/テーブル定義.md`を更新すること。テーブル定義はテーブルごとに表で表現し、カラム名や型およびリレーションを表内で表現すること。
- システムの動作などに変更があった場合は、`Documents/システム仕様.md`を更新すること。

### 必要要件

- Node.js 22.x以上
- yarn 4
- Git

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd <repository-name>

# 依存関係のインストール
yarn install

# 開発起動
yarn dev
```

開発時のDevTools:

- DevTools はデタッチ表示で自動的に開きます
- F12 または Ctrl+Shift+I（macOSは Cmd+Option+I）でトグル可能

### ビルド/配布

- 全プラットフォーム: `yarn dist`
- Windows: `yarn dist:win`
- macOS: `yarn dist:mac`
- Linux: `yarn dist:linux`

開発時は BrowserRouter で `<http://localhost:3001>` を、配布ビルドでは HashRouter で `dist/renderer/index.html` を読み込みます。

### Windows 事前準備: 開発者モード

Windows で署名なしのローカルビルド/配布物を実行・テストする場合は、OSの開発者モードを有効にしてください。

1. 設定 → プライバシーとセキュリティ → 開発者向け
2. 「開発者モード」をオンにする
3. OSを再起動

### プロジェクト構造 (抜粋)

```text
src/
├── main/                  # Electron メイン: IPC/各種マネージャ
│   ├── index.ts           # 起動・ウィンドウ生成・サービス初期化
│   ├── ipc/               # IPCハンドラ
│   ├── services/          # 各種サービス
│   └── utils/             # 各種ユーティリティ
├── preload/               # renderer へ安全にAPIをブリッジ
├── renderer/              # React + MUI UI
├── shared/                # 型定義・定数(Default設定/保存パス)
└── public/                # アイコン等
```

### 使用技術

- **Electron**
- **React (MUI v7)**
- **TypeScript**
- **Zustand**
- **i18next**
- **Vite**

### Windows用アイコンの作成

```exec
magick public/icon.png -define icon:auto-resize=256,128,96,64,48,32,24,16 public/icon.ico
```
