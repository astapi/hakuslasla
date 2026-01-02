import { ImageSourcePropType } from 'react-native';

// プレイヤー画像
export const playerImages = {
  // ホーム画面用（立ち絵）
  standing: require('@/assets/images/characters/warrior.png') as ImageSourcePropType,
  // 戦闘画面用（戦闘ポーズ）
  battle: require('@/assets/images/characters/warrior_battle.png') as ImageSourcePropType,
};

// デフォルトモンスター画像（未設定時のフォールバック）
const defaultMonsterImage = require('@/assets/images/monsters/slime.png') as ImageSourcePropType;

// モンスター画像
export const monsterImages: Record<string, ImageSourcePropType> = {
  // 草原モンスター
  slime: require('@/assets/images/monsters/slime.png'),
  wild_rabbit: defaultMonsterImage, // TODO: 画像追加
  goblin: require('@/assets/images/monsters/goblin.png'),
  bee: defaultMonsterImage, // TODO: 画像追加
  wolf: require('@/assets/images/monsters/wolf.png'),
  // 洞窟モンスター
  bat: defaultMonsterImage, // TODO: 画像追加
  goblin_warrior: require('@/assets/images/monsters/goblin.png'), // ゴブリン流用
  skeleton: require('@/assets/images/monsters/skeleton.png'),
  rock_lizard: defaultMonsterImage, // TODO: 画像追加
  orc: require('@/assets/images/monsters/orc.png'),
  // 遺跡モンスター
  skeleton_knight: require('@/assets/images/monsters/skeleton.png'), // スケルトン流用
  golem: defaultMonsterImage, // TODO: 画像追加
  mummy: defaultMonsterImage, // TODO: 画像追加
  lich: defaultMonsterImage, // TODO: 画像追加
  gargoyle: defaultMonsterImage, // TODO: 画像追加
  troll: require('@/assets/images/monsters/troll.png'),
};

// モンスター画像取得（未登録でもデフォルト画像を返す）
export const getMonsterImage = (id: string): ImageSourcePropType => {
  return monsterImages[id] || defaultMonsterImage;
};
