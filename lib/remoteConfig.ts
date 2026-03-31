import remoteConfig from '@react-native-firebase/remote-config';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const DEFAULTS = {
  min_app_version: '1.0.0',
  maintenance_mode: false,
  maintenance_message: '',
};

const APP_STORE_URL = 'https://apps.apple.com/app/id6758569313';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.astapi.LootDive';

/**
 * Remote Configの初期化とフェッチ
 */
export async function initRemoteConfig(): Promise<void> {
  const rc = remoteConfig();

  // 開発中は短いキャッシュ、本番は5分
  await rc.setConfigSettings({
    minimumFetchIntervalMillis: __DEV__ ? 0 : 300_000,
  });

  await rc.setDefaults(DEFAULTS);
  await rc.fetchAndActivate();
}

/**
 * セマンティックバージョンの比較
 * current < minimum なら true を返す
 */
function isVersionOlder(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const cur = parse(current);
  const min = parse(minimum);

  for (let i = 0; i < 3; i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

export type AppStatus =
  | { type: 'ok' }
  | { type: 'update_required'; storeUrl: string }
  | { type: 'maintenance'; message: string };

/**
 * アプリの状態をチェック
 */
export function checkAppStatus(): AppStatus {
  const rc = remoteConfig();

  // メンテナンスモードチェック
  const isMaintenance = rc.getValue('maintenance_mode').asBoolean();
  if (isMaintenance) {
    return {
      type: 'maintenance',
      message: rc.getValue('maintenance_message').asString(),
    };
  }

  // 強制アップデートチェック
  const minVersion = rc.getValue('min_app_version').asString();
  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';

  if (isVersionOlder(currentVersion, minVersion)) {
    const storeUrl = Platform.select({
      ios: APP_STORE_URL,
      default: PLAY_STORE_URL,
    });
    return { type: 'update_required', storeUrl };
  }

  return { type: 'ok' };
}
