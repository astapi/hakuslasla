#!/bin/bash

# App Store Connect デプロイスクリプト
# 使用方法: ./scripts/deploy-ios.sh [--no-clean]
# オプション:
#   --no-clean  prebuild時に--cleanオプションをスキップ（ネイティブコードの変更を保持）

set -e  # エラー時に停止

# 引数解析
NO_CLEAN=false
for arg in "$@"; do
    case $arg in
        --no-clean)
            NO_CLEAN=true
            shift
            ;;
    esac
done

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# プロジェクトルートに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  App Store Connect デプロイスクリプト${NC}"
echo -e "${GREEN}========================================${NC}"

# .envファイルの読み込み
if [ -f .env ]; then
    echo -e "${YELLOW}[1/5] .envファイルを読み込み中...${NC}"
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
else
    echo -e "${RED}エラー: .envファイルが見つかりません${NC}"
    echo "cp .env.example .env で作成し、認証情報を設定してください"
    exit 1
fi

# 認証情報の確認
if [ -z "$APPLE_ID" ] || [ -z "$APP_SPECIFIC_PASSWORD" ]; then
    echo -e "${RED}エラー: APPLE_ID または APP_SPECIFIC_PASSWORD が設定されていません${NC}"
    exit 1
fi

# 設定
APP_NAME="LootDive"
WORKSPACE="ios/${APP_NAME}.xcworkspace"
SCHEME="$APP_NAME"
ARCHIVE_PATH="build/${APP_NAME}.xcarchive"
EXPORT_PATH="build/output"
IPA_PATH="${EXPORT_PATH}/${APP_NAME}.ipa"
BUILD_NUMBER_FILE=".ios-build-number"

# Step 1: Build Number のインクリメント
echo -e "${YELLOW}[1/6] Build Number をインクリメント中...${NC}"
if [ -f "$BUILD_NUMBER_FILE" ]; then
    CURRENT_BUILD_NUMBER=$(cat "$BUILD_NUMBER_FILE")
else
    CURRENT_BUILD_NUMBER=1
fi
NEW_BUILD_NUMBER=$((CURRENT_BUILD_NUMBER + 1))
echo "$NEW_BUILD_NUMBER" > "$BUILD_NUMBER_FILE"
export IOS_BUILD_NUMBER="$NEW_BUILD_NUMBER"
echo -e "  Build Number: ${CURRENT_BUILD_NUMBER} -> ${NEW_BUILD_NUMBER}"

# Step 2: Expo Prebuild
echo -e "${YELLOW}[2/6] Expo prebuild を実行中...${NC}"
if [ "$NO_CLEAN" = true ]; then
    echo -e "  (--no-clean モード: ネイティブコードの変更を保持)"
    npx expo prebuild --platform ios
else
    npx expo prebuild --clean --platform ios
fi

# ワークスペースの存在確認
if [ ! -d "$WORKSPACE" ]; then
    echo -e "${RED}エラー: $WORKSPACE が見つかりません${NC}"
    exit 1
fi

# Step 3: Archive
echo -e "${YELLOW}[3/6] アーカイブを作成中...${NC}"
xcodebuild -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    archive

# アーカイブの存在確認
if [ ! -d "$ARCHIVE_PATH" ]; then
    echo -e "${RED}エラー: アーカイブの作成に失敗しました${NC}"
    exit 1
fi

# Step 4: Export IPA
echo -e "${YELLOW}[4/6] IPA をエクスポート中...${NC}"

# ExportOptions.plist の存在確認
if [ ! -f "ExportOptions.plist" ]; then
    echo -e "${RED}エラー: ExportOptions.plist が見つかりません${NC}"
    exit 1
fi

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist ExportOptions.plist \
    -allowProvisioningUpdates

# IPAの存在確認
if [ ! -f "$IPA_PATH" ]; then
    echo -e "${RED}エラー: IPA のエクスポートに失敗しました${NC}"
    exit 1
fi

# Step 5: Upload to App Store Connect
echo -e "${YELLOW}[5/6] App Store Connect にアップロード中...${NC}"
xcrun altool --upload-app \
    -f "$IPA_PATH" \
    -u "$APPLE_ID" \
    -p "$APP_SPECIFIC_PASSWORD"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  デプロイ完了！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "App Store Connect でビルドを確認してください:"
echo "https://appstoreconnect.apple.com"
