import { ImageSourcePropType } from 'react-native';

// プレイヤー画像
export const playerImages = {
  // ホーム画面用（立ち絵）
  standing: require('@/assets/images/characters/warrior.png') as ImageSourcePropType,
  // 戦闘画面用（戦闘ポーズ）
  battle: require('@/assets/images/characters/warrior_battle.png') as ImageSourcePropType,
};

// モンスター画像
export const monsterImages: Record<string, ImageSourcePropType> = {
  slime: require('@/assets/images/monsters/slime.png'),
  goblin: require('@/assets/images/monsters/goblin.png'),
  wolf: require('@/assets/images/monsters/wolf.png'),
  skeleton: require('@/assets/images/monsters/skeleton.png'),
  orc: require('@/assets/images/monsters/orc.png'),
  troll: require('@/assets/images/monsters/troll.png'),
};

// モンスター画像取得
export const getMonsterImage = (id: string): ImageSourcePropType | undefined => {
  return monsterImages[id];
};
