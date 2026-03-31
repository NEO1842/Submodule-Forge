# Submodule Forge

A desktop application that automates the creation of a workspace and the setup of multiple Git submodules.

## Prerequisites

- Node.js (v16 or later)
- Git (Must be accessible via command line)

## How to Run

### For Development
```bash
npm install
npm start
```

ブラウザで `http://localhost:3000` を開いてください。

## メモ

- `origin` に push する場合は認証情報が必要です(ユーザー名とトークン)。
- 認証ユーザー名はユーザー名のみ対応です(メールアドレスは不可)。
- サブモジュールの配置先は「ベースフォルダ内の相対パス」で指定します。
  - 例: `my-submodule` → `my-workspace/my-submodule`
- 「サブモジュール追加先のリポジトリURL」を指定すると、clone してからサブモジュールを追加します。
- トークンはログに表示せず、設定ファイルにも保存しません。
