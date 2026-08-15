import type { EquipmentSlot, ItemMod, ModType } from '@/types';

/**
 * 刻印クラフト（engrave）の定義。
 *
 * 刻印＝レア/通常装備に「狙ったMODを1つ確定で彫り込む」クラフト。
 * - 数値は素のT1相当で固定（単一ランク）。ドロップ厳選(運)を確定(刻印)で置き換える位置づけ。
 * - スロット制限はレアのMOD制限を尊重（盛りすぎ防止）。
 * - 毒系・全 _more_pct・cap系(各chance/クリ率/ブロック率)は対象外。
 * - hp_on_hit / evasion_increased_pct / hp_regen_to_atk_pct はドロップに出ない「刻印限定MOD」。
 */
export interface EngraveDef {
  /** 刻印通貨のID（= 付与するMOD種別と1:1） */
  id: ModType;
  /** 付与するMOD種別 */
  modType: ModType;
  /** 固定値（素のT1相当） */
  value: number;
  /** 彫り込めるスロット（レアのスロット制限に準拠）。省略時は全スロット可 */
  slots?: EquipmentSlot[];
  /** 武器に彫る場合の武器種別制限（例: ignite系は staff のみ） */
  weaponTypes?: string[];
  /** 表示・ソート用の並び順 */
  order: number;
}

export const ENGRAVE_DEFS: EngraveDef[] = [
  // --- 刻印限定MOD（ドロップに出ない・レアへの新戦力）---
  { id: 'hp_on_hit', modType: 'hp_on_hit', value: 80, slots: ['armor', 'gloves', 'boots', 'accessory'], order: 10 },
  { id: 'evasion_increased_pct', modType: 'evasion_increased_pct', value: 15, slots: ['gloves', 'boots', 'accessory'], order: 11 },
  { id: 'hp_regen_to_atk_pct', modType: 'hp_regen_to_atk_pct', value: 25, slots: ['accessory'], order: 12 },
  { id: 'ignite_damage_pct', modType: 'ignite_damage_pct', value: 90, slots: ['weapon'], weaponTypes: ['staff'], order: 13 },
  // --- 通常スケーリングMODの狙い撃ち（ドロップにも出るが刻印で確定）---
  { id: 'atk_increased_pct', modType: 'atk_increased_pct', value: 30, order: 20 },
  { id: 'critical_damage', modType: 'critical_damage', value: 100, order: 21 },
  { id: 'hp_bonus', modType: 'hp_bonus', value: 300, order: 22 },
  { id: 'def_increased_pct', modType: 'def_increased_pct', value: 30, order: 23 },
  { id: 'attack_speed_pct', modType: 'attack_speed_pct', value: 30, slots: ['gloves'], order: 24 },
  { id: 'hp_regen', modType: 'hp_regen', value: 50, order: 25 },
  { id: 'damage_reduction_pct', modType: 'damage_reduction_pct', value: 5, slots: ['armor'], order: 26 },
  { id: 'evasion', modType: 'evasion', value: 32, slots: ['gloves', 'boots', 'accessory'], order: 27 },
];

/**
 * 終焉以降のエンドコンテンツで刻印がドロップする確率。
 * ボスは確定、通常敵は低確率。
 * （多階層ダンジョンでは通常敵の撃破数が多いため、通常確率は低く抑える）
 */
export const ENGRAVE_DROP_CHANCE_BOSS = 1.0;
export const ENGRAVE_DROP_CHANCE_NORMAL = 0.04;

const ENGRAVE_BY_ID = new Map<string, EngraveDef>(ENGRAVE_DEFS.map((d) => [d.id, d]));

export const getEngraveDef = (id: string): EngraveDef | undefined => ENGRAVE_BY_ID.get(id);

export const isEngraveModId = (id: string): boolean => ENGRAVE_BY_ID.has(id);

/** その刻印が指定スロット（＋武器種別）の装備に彫れるか */
export const canEngraveOnSlot = (
  def: EngraveDef,
  slot: EquipmentSlot,
  weaponType?: string
): boolean => {
  if (def.slots && !def.slots.includes(slot)) return false;
  if (slot === 'weapon' && def.weaponTypes) {
    if (!weaponType || !def.weaponTypes.includes(weaponType)) return false;
  }
  return true;
};

/** 刻印から付与するItemMod（engravedフラグ付き）を生成 */
export const makeEngravedMod = (def: EngraveDef): ItemMod => ({
  type: def.modType,
  value: def.value,
  tier: 1, // 数値は素のT1相当（表示は「刻印」）
  engraved: true,
});
