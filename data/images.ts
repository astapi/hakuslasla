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

/**
 * モンスター画像マッピング
 * キー: monsters.jsonのimageフィールドの値
 * 値: 対応する画像ファイル
 *
 * 新しいモンスター画像を追加する場合:
 * 1. assets/images/monsters/ に画像ファイルを配置
 * 2. 以下のmonsterImagesにエントリを追加
 * 3. monsters.jsonのimageフィールドにキー名を設定
 */
export const monsterImages: Record<string, ImageSourcePropType> = {
  // === 利用可能な画像 ===
  slime: require('@/assets/images/monsters/slime.png'),
  goblin: require('@/assets/images/monsters/goblin.png'),
  wolf: require('@/assets/images/monsters/wolf.png'),
  skeleton: require('@/assets/images/monsters/skeleton.png'),
  orc: require('@/assets/images/monsters/orc.png'),
  troll: require('@/assets/images/monsters/troll.png'),
  killer_rabbit: require('@/assets/images/monsters/killer_rabbit.png'),
  killer_bee: require('@/assets/images/monsters/killer_bee.png'),
  giant_bat: require('@/assets/images/monsters/giant_bat.png'),
  rock_lizard: require('@/assets/images/monsters/rock_lizard.png'),
  golem: require('@/assets/images/monsters/golem.png'),
  mummy: require('@/assets/images/monsters/mummy.png'),
  lich: require('@/assets/images/monsters/lich.png'),
  gargoyle: require('@/assets/images/monsters/gargoyle.png'),
  skeleton_knight: require('@/assets/images/monsters/skeleton_knight.png'),
  goblin_warrior: require('@/assets/images/monsters/goblin_warrior.png'),
  // ゴブリンの砦
  goblin_archer: require('@/assets/images/monsters/goblin_archer.png'),
  goblin_shaman: require('@/assets/images/monsters/goblin_shaman.png'),
  goblin_knight: require('@/assets/images/monsters/goblin_knight.png'),
  goblin_champion: require('@/assets/images/monsters/goblin_champion.png'),
  goblin_king: require('@/assets/images/monsters/goblin_king.png'),
  // 魔王城
  death_knight: require('@/assets/images/monsters/death_knight.png'),
  demon: require('@/assets/images/monsters/daemon.png'),
  wyvern: require('@/assets/images/monsters/wyvern.png'),
  // 氷結の洞窟
  yeti: require('@/assets/images/monsters/yeti.png'),
  // 竜の巣穴
  drake: require('@/assets/images/monsters/drake.png'),
  fire_dragon: require('@/assets/images/monsters/fire_dragon.png'),
  ice_dragon: require('@/assets/images/monsters/ice_dragon.png'),
  thunder_dragon: require('@/assets/images/monsters/thunder_dragon.png'),
  elder_dragon: require('@/assets/images/monsters/elder_dragon.png'),
  // 神域の神殿
  holy_dragon: require('@/assets/images/monsters/holy_dragon.png'),
  // 混沌の領域
  chaos_dragon: require('@/assets/images/monsters/chaos_dragon.png'),
};

/**
 * モンスター画像を取得
 * @param imageKey monsters.jsonのimageフィールドの値
 * @returns 対応する画像、未登録の場合はデフォルト画像（スライム）
 */
export const getMonsterImage = (imageKey: string): ImageSourcePropType => {
  return monsterImages[imageKey] || defaultMonsterImage;
};
