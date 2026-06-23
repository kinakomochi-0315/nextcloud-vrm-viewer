# VRM Viewer for Nextcloud

NextcloudのFiles画面からVRM 0.x／VRM 1.0ファイルを直接開ける、対話型3Dビューアーです。

> English summary: This Nextcloud 34 app opens VRM 0.x and VRM 1.0 avatar files in an interactive 3D viewer directly from Files.

## 機能

- `.vrm`をクリックしてNextcloud Viewer内に表示
- VRM 0.x／VRM 1.0対応
- 上腕を下げたAポーズへ統一
- ドラッグ回転、ホイール拡大縮小、パン、カメラリセット
- VRMファイル間の前後移動
- VRMに埋め込まれたPNG／JPEGサムネイルをFiles一覧へ表示
- 明色背景と床グリッド
- 破損ファイル、通信失敗、WebGL非対応のエラー表示と再試行
- 外部CDNを使用しないブラウザー内レンダリング

## 対応範囲

- Nextcloud 34
- ログイン済みのFiles画面
- 同一オリジンのWebDAVファイル
- 自己完結したGLB形式のVRM

埋め込みサムネイルがない、または参照が不正なVRMは、Files一覧で通常のファイルアイコンを表示します。モデルを3D描画してサムネイルを新規生成する処理は行いません。

公開共有リンク、VRMA、モーション再生、表情編集は0.2.0の対象外です。

## インストール

GitHub Releaseの`files_vrmviewer-0.2.0.tar.gz`をNextcloudの`custom_apps`へ展開します。

```bash
tar -xzf files_vrmviewer-0.2.0.tar.gz -C /path/to/nextcloud/custom_apps
sudo -u www-data php /path/to/nextcloud/occ app:enable files_vrmviewer
```

アプリ独自のファイルアクションが拡張子を判定するため、追加のMIME設定なしで利用できます。

## 任意のMIME設定

Nextcloud全体で`.vrm`を専用MIMEとして扱いたい場合は、既存内容を消さずに以下をマージします。

`config/mimetypemapping.json`:

```json
{
  "vrm": ["model/vrm"]
}
```

`config/mimetypealiases.json`:

```json
{
  "model/vrm": "file"
}
```

設定後にキャッシュを更新します。

```bash
sudo -u www-data php occ maintenance:mimetype:update-db --repair-filecache
sudo -u www-data php occ maintenance:mimetype:update-js
```

## 開発

Node.js 24とnpm 11を使用します。

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm run stylelint
npm test
```

ローカルNextcloud 34環境:

```bash
npm run build
npm run docker:up
npm run docker:setup
npx playwright install chromium
npm run test:e2e
npm run docker:down
```

E2E用VRMは固定コミットの公式サンプルをダウンロードし、SHA-256を検証します。バイナリはGit管理しません。

## 配布物の生成

```bash
npm run package
```

`build/artifacts/files_vrmviewer-0.2.0.tar.gz`とSHA-256ファイルが生成されます。

## License

AGPL-3.0-or-later
