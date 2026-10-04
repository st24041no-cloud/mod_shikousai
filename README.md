# FesFlow オフラインレジ補助モッド

## 導入URL

```text
https://st24041no-cloud.github.io/mod_shikousai/manifest.json
```

FesFlowの「URLからモッドを導入」には、ディレクトリではなく上記の `manifest.json` の完全なURLを入力してください。

## FesFlow側の現在の制約

FesFlowのモッドは `sandbox="allow-scripts"` のiframe内で実行され、CSPの `connect-src 'none'` によって通信できません。公開されているSDKから親画面へ送れる操作も `ADD_TO_CART`、`CLEAR_CART`、`SET_FULLSCREEN` に限られます。このため、モッドだけでオフライン注文を永続保存し、復旧後にFesFlow APIへ同期することはできません。本バージョンはレジ画面への通信状態・警告表示までを、正式なフック仕様で実装しています。

完全なオフライン会計には、FesFlow本体へ次の追加が必要です。

- 注文作成API呼び出しをService WorkerまたはIndexedDBキューへ退避
- 復旧時のBackground Syncと冪等キーによる再送
- モッドSDKへの `QUEUE_ORDER`、`GET_PENDING_ORDERS` 等の安全なアクション追加
- サーバー側での在庫競合記録と二重登録防止

通信が切れても IndexedDB に商品・在庫・取引を保存し、会計を継続する拡張機能です。復旧後は取引ごとの `Idempotency-Key` を使って再送するため、サーバー側が同キーを一意制約として扱えば二重売上を防げます。

## 機能

- オフライン会計、端末内の在庫引当、現金のお釣り計算
- 接続状態・未同期件数・当日売上の表示
- 自動同期／手動再同期と同期失敗の保存
- 取引CSVバックアップ、端末ID、操作者ID、時刻の監査記録
- Service Worker による画面資産のキャッシュ

## 導入

1. このディレクトリを同一オリジンのHTTPSサーバーに配置します。
2. サークル設定 → 拡張設定 →「URLからモッドを導入」に `https://配布先/manifest.json` を指定します（JSONアップロード方式なら `manifest.json` を選択）。
3. 権限を確認して有効化し、「オフラインレジ」を開いた状態で一度オンライン同期します。

## ホスト側の接続点

エントリーポイントの `activate(host)` は次を使用します。

- `host.routes.register(path, render)` — 画面登録
- `host.api.get('/products?include=stock')` — `{id,name,price,stock}[]`
- `host.api.post('/sales/sync', transaction, options)` — 冪等な売上登録
- 任意: `host.currentUser.id`, `host.ui.toast`, `host.events.emit`

サーバーは `idempotencyKey` または `Idempotency-Key` を一意に扱い、同じ取引の再送に成功レスポンスを返してください。複数端末の同時オフライン販売では実在庫超過を完全には防げないため、同期時に在庫競合を記録し、管理画面で調整できるようにしてください。

## テスト

Node.js 20以上で `npm test` を実行します。実システムの拡張API名が異なる場合は、`src/index.js` の `host` 接続部分だけを合わせればコア処理はそのまま使えます。
