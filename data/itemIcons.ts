import { ImageSourcePropType } from 'react-native';
import { EquipmentSlot, WeaponType } from '@/types';

/**
 * スロットごとのデフォルトアイコン設定
 * 画像は assets/images/items/ に配置
 */
export const SLOT_ICONS: Record<EquipmentSlot, {
  image: ImageSourcePropType;
  label: string;
}> = {
  weapon: {
    image: require('@/assets/images/items/weapon.png'),
    label: '武器',
  },
  armor: {
    image: require('@/assets/images/items/armor.png'),
    label: '防具',
  },
  gloves: {
    image: require('@/assets/images/items/gloves.png'),
    label: '手袋',
  },
  boots: {
    image: require('@/assets/images/items/boots.png'),
    label: '靴',
  },
  accessory: {
    image: require('@/assets/images/items/accessory.png'),
    label: 'アクセ',
  },
};

/**
 * 武器種類ごとのアイコン設定
 */
export const WEAPON_TYPE_ICONS: Record<WeaponType, ImageSourcePropType> = {
  sword: require('@/assets/images/items/weapon.png'),
  staff: require('@/assets/images/items/staff.png'),
};

/**
 * アイテム固有アイコン（ユニークアイテム用）
 * itemId → 画像のマッピング
 * 設定がない場合はスロットのデフォルトアイコンを使用
 */
export const ITEM_ICONS: Record<string, ImageSourcePropType> = {
  uber_bandit_coat: require('@/assets/images/items/unique/uber_bandit_coat.png'),
  uber_bandit_crown: require('@/assets/images/items/unique/uber_bandit_crown.png'),
  uber_bandit_dagger: require('@/assets/images/items/unique/uber_bandit_dagger.png'),
  uber_bandit_evasion_steps: require('@/assets/images/items/unique/uber_bandit_evasion_steps.png'),
  uber_bandit_grip: require('@/assets/images/items/unique/uber_bandit_grip.png'),
  uber_bandit_steps: require('@/assets/images/items/unique/uber_bandit_steps.png'),
  uber_crown_of_end: require('@/assets/images/items/unique/uber_crown_of_end.png'),
  uber_demon_armor: require('@/assets/images/items/unique/uber_demon_armor.png'),
  uber_demon_blade: require('@/assets/images/items/unique/uber_demon_blade.png'),
  uber_demon_crown: require('@/assets/images/items/unique/uber_demon_crown.png'),
  uber_demon_evasion_grip: require('@/assets/images/items/unique/uber_demon_evasion_grip.png'),
  uber_demon_grip: require('@/assets/images/items/unique/uber_demon_grip.png'),
  uber_demon_steps: require('@/assets/images/items/unique/uber_demon_steps.png'),
  uber_double_strike_ring: require('@/assets/images/items/unique/uber_double_strike_ring.png'),
  uber_end_evasion_crown: require('@/assets/images/items/unique/uber_end_evasion_crown.png'),
  uber_endblade: require('@/assets/images/items/unique/uber_endblade.png'),
  uber_endgrasp: require('@/assets/images/items/unique/uber_endgrasp.png'),
  uber_endplate: require('@/assets/images/items/unique/uber_endplate.png'),
  uber_endstride: require('@/assets/images/items/unique/uber_endstride.png'),
  uber_goblin_blade: require('@/assets/images/items/unique/uber_goblin_blade.png'),
  uber_goblin_evasion_cloak: require('@/assets/images/items/unique/uber_goblin_evasion_cloak.png'),
  uber_goblin_grip: require('@/assets/images/items/unique/uber_goblin_grip.png'),
  uber_goblin_plate: require('@/assets/images/items/unique/uber_goblin_plate.png'),
  uber_goblin_stomp: require('@/assets/images/items/unique/uber_goblin_stomp.png'),
  uber_kings_crown: require('@/assets/images/items/unique/uber_kings_crown.png'),
  uber_kraken_claw: require('@/assets/images/items/unique/uber_kraken_claw.png'),
  uber_kraken_eye: require('@/assets/images/items/unique/uber_kraken_eye.png'),
  uber_kraken_fin: require('@/assets/images/items/unique/uber_kraken_fin.png'),
  uber_kraken_shell: require('@/assets/images/items/unique/uber_kraken_shell.png'),
  uber_kraken_tentacle: require('@/assets/images/items/unique/uber_kraken_tentacle.png'),
  uber_uber_double_strike_ring: require('@/assets/images/items/unique/uber_uber_double_strike_ring.png'),
  uber_uber_goblin_stomp: require('@/assets/images/items/unique/uber_uber_goblin_stomp.png'),
  uber_uber_kraken_mantle: require('@/assets/images/items/unique/uber_uber_kraken_mantle.png'),
  uber_uber_kraken_pendant: require('@/assets/images/items/unique/uber_uber_kraken_pendant.png'),
  uber_vampire_evasion_charm: require('@/assets/images/items/unique/uber_vampire_evasion_charm.png'),
  uber_vampire_fang: require('@/assets/images/items/unique/uber_vampire_fang.png'),
  uber_vampire_grip: require('@/assets/images/items/unique/uber_vampire_grip.png'),
  uber_vampire_heart: require('@/assets/images/items/unique/uber_vampire_heart.png'),
  uber_vampire_plate: require('@/assets/images/items/unique/uber_vampire_plate.png'),
  uber_vampire_stride: require('@/assets/images/items/unique/uber_vampire_stride.png'),
};

const EVASION_ITEM_ICONS: Partial<Record<EquipmentSlot, ImageSourcePropType>> = {
  armor: require('@/assets/images/items/evasion_armor.png'),
  gloves: require('@/assets/images/items/evasion_gloves.png'),
  boots: require('@/assets/images/items/evasion_boots.png'),
  accessory: require('@/assets/images/items/evasion_accessory.png'),
};

/**
 * アイテムのアイコンを取得
 * 優先順位: 固有アイコン > 武器種類アイコン > スロットデフォルト
 */
export function getItemIcon(itemId: string, slot: EquipmentSlot, weaponType?: WeaponType): ImageSourcePropType {
  if (ITEM_ICONS[itemId]) {
    return ITEM_ICONS[itemId];
  }
  if (itemId.includes('_evasion_') && EVASION_ITEM_ICONS[slot]) {
    return EVASION_ITEM_ICONS[slot];
  }
  if (slot === 'weapon' && weaponType) {
    return WEAPON_TYPE_ICONS[weaponType];
  }
  return SLOT_ICONS[slot].image;
}

/**
 * スロットのアイコンを取得
 */
export function getSlotIcon(slot: EquipmentSlot): ImageSourcePropType {
  return SLOT_ICONS[slot].image;
}

/**
 * スロットのラベルを取得
 */
export function getSlotLabel(slot: EquipmentSlot): string {
  return SLOT_ICONS[slot].label;
}
