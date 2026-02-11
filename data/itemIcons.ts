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
  // ユニークアイテムの例（将来追加）
  // 'goblin_dagger': require('@/assets/images/items/unique/goblin_dagger.png'),
  // 'dragon_sword': require('@/assets/images/items/unique/dragon_sword.png'),
};

/**
 * アイテムのアイコンを取得
 * 優先順位: 固有アイコン > 武器種類アイコン > スロットデフォルト
 */
export function getItemIcon(itemId: string, slot: EquipmentSlot, weaponType?: WeaponType): ImageSourcePropType {
  if (ITEM_ICONS[itemId]) {
    return ITEM_ICONS[itemId];
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
