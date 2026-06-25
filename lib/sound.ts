import { Audio } from 'expo-av';
import { CharacterType } from '@/types';
import { settingsRepository } from '@/db/repositories/settingsRepository';

// SEの種類
export type BattleSoundType = 'player_attack' | 'enemy_attack';

// サウンドファイルのマッピング
const SOUND_FILES = {
  // プレイヤー攻撃SE（キャラクタータイプ別）
  player_attack: {
    warrior: require('@/assets/sounds/attack_warrior.mp3'),
    elementalist: require('@/assets/sounds/attack_elementalist.mp3'),
    ranger: require('@/assets/sounds/attack_warrior.mp3'),
    frostmage: require('@/assets/sounds/attack_frostmage.mp3'),
    tamer: require('@/assets/sounds/attack_warrior.mp3'),
  },
  // 敵攻撃SE（共通）
  enemy_attack: require('@/assets/sounds/attack_enemy.mp3'),
  // 戦闘BGM
  battle_bgm: require('@/assets/sounds/battle_bgm.mp3'),
} as const;

// プリロードされたサウンドオブジェクト
let preloadedSounds: {
  player_attack: { [key in CharacterType]?: Audio.Sound };
  enemy_attack?: Audio.Sound;
  battle_bgm?: Audio.Sound;
} = {
  player_attack: {},
};

// サウンド設定のキャッシュ
let soundSettings = {
  bgmEnabled: true,
  seEnabled: true,
};

// プリロード完了フラグ
let isPreloaded = false;

const SE_THROTTLE_MS = 120;
const lastSoundPlayedAt: Partial<Record<BattleSoundType, number>> = {};

// 設定を読み込む
export const loadSoundSettings = async (): Promise<void> => {
  try {
    const [bgmEnabled, seEnabled] = await Promise.all([
      settingsRepository.getBgmEnabled(),
      settingsRepository.getSeEnabled(),
    ]);
    soundSettings = { bgmEnabled, seEnabled };
  } catch (error) {
    console.warn('Failed to load sound settings:', error);
  }
};

// 設定を更新（設定画面から呼ばれる）
export const updateSoundSettings = (bgmEnabled: boolean, seEnabled: boolean): void => {
  soundSettings = { bgmEnabled, seEnabled };
};

// サウンドのプリロード（戦闘開始時に呼ぶ）
export const preloadBattleSounds = async (characterType: CharacterType): Promise<void> => {
  try {
    // 設定を読み込む
    await loadSoundSettings();

    // オーディオモードを設定（消音モード時は再生しない）
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });

    // プレイヤー攻撃SE
    const { sound: playerSound } = await Audio.Sound.createAsync(
      SOUND_FILES.player_attack[characterType],
      { shouldPlay: false }
    );
    preloadedSounds.player_attack[characterType] = playerSound;

    // 敵攻撃SE
    const { sound: enemySound } = await Audio.Sound.createAsync(
      SOUND_FILES.enemy_attack,
      { shouldPlay: false }
    );
    preloadedSounds.enemy_attack = enemySound;

    // 戦闘BGM（ループ設定）
    const { sound: bgmSound } = await Audio.Sound.createAsync(
      SOUND_FILES.battle_bgm,
      { shouldPlay: false, isLooping: true, volume: 0.5 }
    );
    preloadedSounds.battle_bgm = bgmSound;

    isPreloaded = true;
  } catch (error) {
    console.warn('Failed to preload battle sounds:', error);
  }
};

// サウンドの解放（戦闘終了時に呼ぶ）
export const unloadBattleSounds = async (): Promise<void> => {
  try {
    // BGMを停止
    if (preloadedSounds.battle_bgm) {
      await preloadedSounds.battle_bgm.stopAsync();
      await preloadedSounds.battle_bgm.unloadAsync();
    }

    for (const sound of Object.values(preloadedSounds.player_attack)) {
      if (sound) {
        await sound.unloadAsync();
      }
    }
    if (preloadedSounds.enemy_attack) {
      await preloadedSounds.enemy_attack.unloadAsync();
    }
    preloadedSounds = { player_attack: {} };
    isPreloaded = false;
  } catch (error) {
    console.warn('Failed to unload battle sounds:', error);
  }
};

// SEを再生
export const playBattleSound = async (
  type: BattleSoundType,
  characterType?: CharacterType
): Promise<void> => {
  // SE無効なら再生しない
  if (!soundSettings.seEnabled) return;

  const now = Date.now();
  if (now - (lastSoundPlayedAt[type] ?? 0) < SE_THROTTLE_MS) return;
  lastSoundPlayedAt[type] = now;

  try {
    let sound: Audio.Sound | undefined;

    if (type === 'player_attack' && characterType) {
      sound = preloadedSounds.player_attack[characterType];
    } else if (type === 'enemy_attack') {
      sound = preloadedSounds.enemy_attack;
    }

    if (sound) {
      // 再生位置を最初に戻してから再生（連続再生対応）
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch (error) {
    console.warn('Failed to play battle sound:', error);
  }
};

// BGMを再生
export const playBattleBgm = async (): Promise<void> => {
  // BGM無効なら再生しない
  if (!soundSettings.bgmEnabled) return;

  try {
    const bgm = preloadedSounds.battle_bgm;
    if (bgm) {
      await bgm.setPositionAsync(0);
      await bgm.playAsync();
    }
  } catch (error) {
    console.warn('Failed to play battle BGM:', error);
  }
};

// BGMを停止
export const stopBattleBgm = async (): Promise<void> => {
  try {
    const bgm = preloadedSounds.battle_bgm;
    if (bgm) {
      await bgm.stopAsync();
    }
  } catch (error) {
    console.warn('Failed to stop battle BGM:', error);
  }
};

// BGMを一時停止
export const pauseBattleBgm = async (): Promise<void> => {
  try {
    const bgm = preloadedSounds.battle_bgm;
    if (bgm) {
      await bgm.pauseAsync();
    }
  } catch (error) {
    console.warn('Failed to pause battle BGM:', error);
  }
};

// BGMを再開
export const resumeBattleBgm = async (): Promise<void> => {
  // BGM無効なら再開しない
  if (!soundSettings.bgmEnabled) return;

  try {
    const bgm = preloadedSounds.battle_bgm;
    if (bgm) {
      await bgm.playAsync();
    }
  } catch (error) {
    console.warn('Failed to resume battle BGM:', error);
  }
};
