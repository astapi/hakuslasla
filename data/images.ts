import { ImageSourcePropType } from 'react-native';
import { Item, CharacterType } from '@/types';

export type ChestRarity = 'normal' | 'magic' | 'rare' | 'unique';

// プレイヤー画像タイプ
interface PlayerImageSet {
  standing: ImageSourcePropType;  // ホーム画面用（立ち絵）
  battle: ImageSourcePropType;     // 戦闘画面用（戦闘ポーズ）
  standingScale?: number;          // 立ち絵のスケール補正（デフォルト1.0）
  battleScale?: number;            // 戦闘画像のスケール補正（デフォルト1.0）
}

// クラス別プレイヤー画像マッピング
export const characterImages: Record<CharacterType, PlayerImageSet> = {
  warrior: {
    standing: require('@/assets/images/characters/warrior.png') as ImageSourcePropType,
    battle: require('@/assets/images/characters/warrior_battle.png') as ImageSourcePropType,
    battleScale: 0.7,
  },
  elementalist: {
    standing: require('@/assets/images/characters/elementalist.png') as ImageSourcePropType,
    battle: require('@/assets/images/characters/elementalist_battle.png') as ImageSourcePropType,
  },
  ranger: {
    standing: require('@/assets/images/characters/ranger.png') as ImageSourcePropType,
    battle: require('@/assets/images/characters/ranger_battle.png') as ImageSourcePropType,
  },
  frostmage: {
    standing: require('@/assets/images/characters/frostmage.png') as ImageSourcePropType,
    battle: require('@/assets/images/characters/frostmage_battle.png') as ImageSourcePropType,
    standingScale: 0.75,
    battleScale: 0.75,
  },
  tamer: {
    standing: require('@/assets/images/characters/tamer.png') as ImageSourcePropType,
    battle: require('@/assets/images/characters/tamer_battle.png') as ImageSourcePropType,
  },
};

// プレイヤー画像（後方互換性のため残す、デフォルトはwarrior）
export const playerImages = characterImages.warrior;

/**
 * キャラクタータイプから画像セットを取得
 */
export const getCharacterImages = (type: CharacterType): PlayerImageSet => {
  return characterImages[type] ?? characterImages.warrior;
};

// ダンジョン背景画像マッピング（戦闘画面・ダンジョン選択画面で共通利用）
export const dungeonBackgroundImages: Record<string, ImageSourcePropType> = {
  grassland: require('@/assets/images/backgrounds/grassland.jpg'),
  cave: require('@/assets/images/backgrounds/cave.jpg'),
  ruins: require('@/assets/images/backgrounds/ruins.jpg'),
  goblin_fort: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  bandit_hideout: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  demon_castle: require('@/assets/images/backgrounds/demon_castle.jpg'),
  vampire_mansion: require('@/assets/images/backgrounds/vampire_mansion.jpg'),
  ice_cave: require('@/assets/images/backgrounds/ice_cave.jpg'),
  underwater_cave: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  volcano: require('@/assets/images/backgrounds/volcano.jpg'),
  orc_fortress: require('@/assets/images/backgrounds/orc_fortress.jpg'),
  dark_forest: require('@/assets/images/backgrounds/dark_forest.jpg'),
  sky_tower: require('@/assets/images/backgrounds/sky_tower.jpg'),
  hell_gate: require('@/assets/images/backgrounds/hell_gate.jpg'),
  dragon_nest: require('@/assets/images/backgrounds/dragon_nest.jpg'),
  sacred_temple: require('@/assets/images/backgrounds/sacred_temple.jpg'),
  chaos_realm: require('@/assets/images/backgrounds/chaos_realm.jpg'),
  final_land: require('@/assets/images/backgrounds/final_land.jpg'),
  dimensional_rush_1: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_2: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_3: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_4: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_5: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_6: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_corridor: require('@/assets/images/backgrounds/dimensional_corridor.jpg'),
  uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  uber_bandit_leader: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  uber_vampire: require('@/assets/images/backgrounds/vampire_mansion.jpg'),
  uber_kraken: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  uber_demon_lord: require('@/assets/images/backgrounds/demon_castle.jpg'),
  uber_true_final_boss: require('@/assets/images/backgrounds/final_land.jpg'),
  uber_uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  uber_uber_bandit_leader: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  uber_uber_kraken: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  uber_uber_demon_lord: require('@/assets/images/backgrounds/demon_castle.jpg'),
  debug_uber_uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  debug_uber_uber_bandit_leader: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  debug_uber_uber_kraken: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  debug_uber_uber_demon_lord: require('@/assets/images/backgrounds/demon_castle.jpg'),
};

export const getDungeonBackgroundImage = (dungeonId: string): ImageSourcePropType | undefined => {
  return dungeonBackgroundImages[dungeonId];
};

export const chestImages: Record<ChestRarity, ImageSourcePropType> = {
  normal: require('@/assets/images/chests/normal.png'),
  magic: require('@/assets/images/chests/magic.png'),
  rare: require('@/assets/images/chests/rare.png'),
  unique: require('@/assets/images/chests/unique.png'),
};

export const getChestRarityForItem = (item: Item): ChestRarity => {
  if (item.mods?.some((mod) => mod.tier === 0)) {
    return 'unique';
  }
  const modCount = item.mods?.length ?? 0;
  if (modCount <= 0) return 'normal';
  if (modCount <= 2) return 'magic';
  return 'rare';
};

export const getChestImageForItem = (item: Item): ImageSourcePropType => {
  return chestImages[getChestRarityForItem(item)];
};

// モンスター画像のスケール補正（キャンバス内の描画比率が大きいものを縮小）
export const monsterBattleScales: Record<string, number> = {
  slime: 0.7,
  killer_rabbit: 0.7,
  goblin: 0.7,
  killer_bee: 0.7,
  wolf: 0.7,
  mimic: 0.7,
  giant_bat: 0.8,
  goblin_warrior: 0.8,
  skeleton: 0.8,
  rock_lizard: 0.8,
  orc: 0.8,
  skeleton_knight: 0.8,
  golem: 0.8,
  mummy: 0.8,
  lich: 0.8,
  gargoyle: 0.8,
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
  mimic: require('@/assets/images/monsters/mimic.png'),
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
  // ヴァンパイアの館
  zombie: require('@/assets/images/monsters/zombie.png'),
  ghoul: require('@/assets/images/monsters/ghoul.png'),
  banshee: require('@/assets/images/monsters/banshee.png'),
  wraith: require('@/assets/images/monsters/wraith.png'),
  vampire: require('@/assets/images/monsters/vampire.png'),
  // 氷結の洞窟
  yeti: require('@/assets/images/monsters/yeti.png'),
  ice_golem: require('@/assets/images/monsters/ice_golem.png'),
  frost_wolf: require('@/assets/images/monsters/frost_wolf.png'),
  ice_witch: require('@/assets/images/monsters/ice_witch.png'),
  frost_wyrm: require('@/assets/images/monsters/frost_wyrm.png'),
  // 竜の巣穴
  drake: require('@/assets/images/monsters/drake.png'),
  fire_dragon: require('@/assets/images/monsters/fire_dragon.png'),
  ice_dragon: require('@/assets/images/monsters/ice_dragon.png'),
  thunder_dragon: require('@/assets/images/monsters/thunder_dragon.png'),
  elder_dragon: require('@/assets/images/monsters/elder_dragon.png'),
  // 神域の神殿
  holy_dragon: require('@/assets/images/monsters/holy_dragon.png'),
  divine_knight: require('@/assets/images/monsters/divine_knight.png'),
  seraph: require('@/assets/images/monsters/seraph.png'),
  temple_guardian: require('@/assets/images/monsters/temple_guardian.png'),
  valkyrie: require('@/assets/images/monsters/valkyrie.png'),
  // 混沌の領域
  chaos_dragon: require('@/assets/images/monsters/chaos_dragon.png'),
  chaos_knight: require('@/assets/images/monsters/chaos_knight.png'),
  void_walker: require('@/assets/images/monsters/void_walker.png'),
  abomination: require('@/assets/images/monsters/abomination.png'),
  elder_thing: require('@/assets/images/monsters/elder_thing.png'),
  // 深淵の森
  shadow_wolf: require('@/assets/images/monsters/shadow_wolf.png'),
  forest_witch: require('@/assets/images/monsters/forest_witch.png'),
  chimera: require('@/assets/images/monsters/chimera.png'),
  nightmare: require('@/assets/images/monsters/nightmare.png'),
  dark_treant: require('@/assets/images/monsters/treant.png'),
  // 終焉の地
  apocalypse_knight: require('@/assets/images/monsters/apocalypse_knight.png'),
  world_eater: require('@/assets/images/monsters/world_eater.png'),
  primordial_titan: require('@/assets/images/monsters/primordial_titan.png'),
  god_slayer: require('@/assets/images/monsters/god_slayer.png'),
  end_bringer: require('@/assets/images/monsters/end_bringer.png'),
  true_final_boss: require('@/assets/images/monsters/true_final_boss.png'),
  // 盗賊のアジト
  bandit: require('@/assets/images/monsters/bandit.png'),
  bandit_archer: require('@/assets/images/monsters/bandit_archer.png'),
  bandit_swordsman: require('@/assets/images/monsters/bandit_swordsman.png'),
  bandit_brute: require('@/assets/images/monsters/bandit_brute.png'),
  bandit_leader: require('@/assets/images/monsters/bandit_leader.png'),
  // オークの要塞
  orc_mage: require('@/assets/images/monsters/orc_mage.png'),
  uruk_hai: require('@/assets/images/monsters/Uruk-hai.png'),
  cyclops: require('@/assets/images/monsters/Cyclops.png'),
  // 海底洞窟
  giant_crab: require('@/assets/images/monsters/giant_crab.png'),
  sahuagin: require('@/assets/images/monsters/sahuagin.png'),
  merman: require('@/assets/images/monsters/merman.png'),
  sea_serpent: require('@/assets/images/monsters/sea_serpent.png'),
  kraken: require('@/assets/images/monsters/Kraken.png'),
  kelpy: require('@/assets/images/monsters/kelpy.png'),
  // 灼熱の火山
  lava_slime: require('@/assets/images/monsters/larva_slime.png'),
  magma_golem: require('@/assets/images/monsters/magma_golem.png'),
  salamander: require('@/assets/images/monsters/salamander.png'),
  flame_knight: require('@/assets/images/monsters/flame_knight.png'),
  phoenix: require('@/assets/images/monsters/phoenix.png'),
  // 天空の塔
  griffon: require('@/assets/images/monsters/griffin.png'),
  sky_knight: require('@/assets/images/monsters/sky_knight.png'),
  storm_harpy: require('@/assets/images/monsters/storm_harpy.png'),
  thunder_bird: require('@/assets/images/monsters/thunder_bird.png'),
  cloud_giant: require('@/assets/images/monsters/cloud_giant.png'),
  // 地獄の門
  hell_hound: require('@/assets/images/monsters/hell_hound.png'),
  infernal_knight: require('@/assets/images/monsters/infernal_knight.png'),
  succubus: require('@/assets/images/monsters/succubus.png'),
  balrog: require('@/assets/images/monsters/balrog.png'),
  cerberus: require('@/assets/images/monsters/cerberus.png'),
  // 魔王城
  dark_mage: require('@/assets/images/monsters/dark_mage.png'),
  demon_lord: require('@/assets/images/monsters/daemon_load.png'),
};

/**
 * モンスター画像を取得
 * @param imageKey monsters.jsonのimageフィールドの値
 * @returns 対応する画像、未登録の場合はデフォルト画像（スライム）
 */
export const getMonsterImage = (imageKey: string): ImageSourcePropType => {
  return monsterImages[imageKey] || defaultMonsterImage;
};
