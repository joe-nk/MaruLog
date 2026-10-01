# MaruLog

クイズの正解・不正解を、〇と×で素早く記録するローカルWebアプリです。
参加者それぞれが自分のスマートフォンで開いて使う、1端末1人の運用を前提にしています。

## 起動

## 基本操作

- 赤い `〇`: 正解を記録
- 青い `×`: 不正解を記録
- 黄色の `スルー`: ルールに応じたスルー処理
- `Undo`: 直前のデータ変更を取り消す
- `Reset`: 得点カウンタを初期化する
- `Dark`: ダークモードを切り替える
- `Config`: ルール、data添字、表示、S式を編集する

通常画面の表示は表示テンプレートで決まります。初期値は次の形式です。

```text
${data[0]}〇${data[1]}×
```

テンプレートでは `${data[i]}`（`data[0]`〜`data[255]`）と `${score}` が使えます。

例:

```text
正解 ${data[0]} / 不正解 ${data[1]} / 得点 ${score}pt
```

## 標準ルール

ConfigのRuleから選択できます。すべてのルールで、〇と×のカウンタが参照するdata添字を編集できます。

| ルール | 計算・動作 |
| --- | --- |
| `n〇m×` | 表示テンプレートで `data` 値を表示。〇/×で指定カウンタを増加 |
| `NY` | `correct * data[〇係数] - incorrect * data[×係数]` |
| `10by10` | `correct * (data[基準値] - incorrect)` |
| `7by7` | `correct * (data[基準値] - incorrect)` |
| `Freeze` | n回目の誤答でn回休み。休み中は〇/×を受け付けず、スルーで残り休みを1減少 |

初期の関連data値は `config.js` で設定しています。現在の初期値は次の通りです。

- NYの〇係数: `data[2] = 1`
- NYの×係数: `data[3] = 1`
- 10by10の基準値: `data[4] = 10`
- 7by7の基準値: `data[5] = 7`
- Freezeの残り休み: `data[6] = 0`

Configでは、各ルールの「data index」と「data value」を直接編集できます。ルール式の基準値を変更したい場合は、ここを変更してください。

## S式 custom

Ruleを `S式 custom` にすると、ボタンごとのS式likeフックを実行します。

- `$correct`: 〇カウンタのdata添字
- `$incorrect`: ×カウンタのdata添字
- `$i`: `$correct` の別名
- `@`: dataの読み取り
- `#`: dataへの書き込み

初期フック:

```text
正解   (# $correct (+ (@ $correct) 1))
不正解 (# $incorrect (+ (@ $incorrect) 1))
スルー (# $correct (@ $correct))
```

演算子の詳細は [`eval.txt`](./eval.txt)、参照実装は [`parser.ts`](./parser.ts) と [`eval.ts`](./eval.ts) にあります。

## data[128..255] エディタ

Config下部のエディタは1行1要素です。最初の行が `data[128]`、最後の行が `data[255]` に対応します。

入力できる値は、32-bit signed integer、`true`、`false` です。

## 設定と保存

初期設定は [`config.js`](./config.js) で変更できます。画面上で変更した設定・得点・dataはブラウザの `localStorage` に保存されます。

同じ端末・同じブラウザでは前回の状態が復元されます。別の参加者の端末には影響しません。

## ファイル構成

- [`index.html`](./index.html): 画面構造
- [`styles.css`](./styles.css): 最小限のUIとダークモード
- [`app.js`](./app.js): UI、標準ルール、S式like評価、ローカル保存
- [`config.js`](./config.js): 初期設定
- [`parser.ts`](./parser.ts) / [`eval.ts`](./eval.ts): TypeScriptの参照実装
