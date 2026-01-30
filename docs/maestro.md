# Maestro E2E

## 前提
- Expo Dev Client or ネイティブビルド（Expo Goは不可）
- Androidエミュレータ or iOS Simulator
- appId: `com.astapi.LootDive`

## 実行（Android）
1) Dev Client起動
- `npm run android`

2) E2E実行（毎回データリセット）
- `bash scripts/maestro/run-android-e2e.sh`

## 実行（iOS）
1) Dev Client起動
- `npm run ios`

2) E2E実行
- `bash scripts/maestro/run-ios-e2e.sh`

## 収録フロー
- `.maestro/smoke.yaml`
  - Dev ClientをopenLinkで起動 → どの画面からでもホームへ復帰 → ダンジョン → 戦闘 → 結果

## 注意
- 端末の入力方式（手書き入力）はE2E用端末で無効化して固定してください
