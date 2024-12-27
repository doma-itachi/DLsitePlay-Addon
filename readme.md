# DLsitePlay Addon
## 概要
PC / Android上で動作する、DLsitePlayに新しい機能を追加する拡張機能です。

### 主な機能
- 読書進捗の保存&復帰

## インストール
### PC (Chromium系)
[ここから](https://chrome.google.com/webstore/detail/dlsiteplay-addon/mhakhgmbhcjmeppkcbfpbajohjhoplgf)拡張機能をインストールしてください

### Android
1. [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser&hl=ja&gl=US)を端末にインストールする
2. Kiwi Browser上で[ここから](https://chrome.google.com/webstore/detail/dlsiteplay-addon/mhakhgmbhcjmeppkcbfpbajohjhoplgf)拡張機能をインストールする
3. オプションでKiwi BrowserからDLsitePlayをインストールしてください

<!--詳しい導入方法は[こちら]()-->
### Firefox版(レガシー)
> レガシーバージョンです！今後はサポートされません。
>https://addons.mozilla.org/ja/firefox/addon/dlsiteplay_addon/

## 機能
### 実装済み
- 読書進捗の保存＆ページ復帰
- データのバックアップ＆復元

## 貢献
### バグ・不具合を報告
バグや不具合を発見したらissueで報告してくれると助かります

### プルリクエスト
フォークしてプルリクエストを送信してください

#### 開発
```ps1
# モジュールをインストールします
> npm i
# 必要な修正を行います
> code .
# watchモードでビルドします。スクリプトを更新すると自動でビルドされます
# ブラウザで拡張機能をリロード＆ページをリロードします
# ts以外のファイル(manifest, cssなど)は変更しても適用されないので注意！
> npm run dev
```


## パッケージ化
以下のコマンドでパッケージ化できます
```bash
npm i
npm run build
```

## ライセンス
Copyright (c) 2022 itachi_doma  
このプロジェクトはMITライセンスの下で公開されています
