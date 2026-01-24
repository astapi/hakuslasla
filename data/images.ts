import { ImageSourcePropType } from 'react-native';
import { Item } from '@/types';

export type ChestRarity = 'normal' | 'magic' | 'rare' | 'unique';

// プレイヤー画像
export const playerImages = {
  // ホーム画面用（立ち絵）
  standing: require('@/assets/images/characters/warrior.png') as ImageSourcePropType,
  // 戦闘画面用（戦闘ポーズ）
  battle: require('@/assets/images/characters/warrior_battle.png') as ImageSourcePropType,
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
