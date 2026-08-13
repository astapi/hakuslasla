import { canEngraveOnSlot, getEngraveDef, makeEngravedMod } from '@/data/engraveMods';
import itemsData from '@/data/json/items.json';
import type { Item, ItemMod } from '@/types';

/** レア/通常装備の上限MOD数（ユニークと同数） */
export const MAX_ITEM_MODS = 4;

/**
 * アイテムが「ユニーク（fixedMods固定）」か判定。
 * items.json のベース定義に fixedMods があればユニーク。
 */
export function isUniqueItem(item: Item): boolean {
  const base = (itemsData as { items: Record<string, { fixedMods?: unknown }> }).items[item.id];
  return Boolean(base && Array.isArray(base.fixedMods));
}

/** アイテムに既に刻印MODが付いているか */
export function hasEngravedMod(item: Item): boolean {
  return (item.mods ?? []).some((m) => m.engraved);
}

export type EngraveError =
  | 'unique'          // ユニークには彫れない
  | 'already'         // 既に刻印済み
  | 'slot'            // このスロットには彫れないMOD
  | 'unknown'         // 不明な刻印
  | 'duplicate';      // 同種MODが既にある（置換対象に選べば可）

export interface EngravePreview {
  ok: boolean;
  error?: EngraveError;
  /** 4MOD時に置換対象の選択が必要か */
  needsReplaceChoice: boolean;
  /** 既存の同種MODインデックス（あれば置換候補として提示） */
  duplicateIndex: number | null;
}

/**
 * 刻印を適用できるか判定（適用はしない）。
 */
export function previewEngrave(item: Item, engraveId: string): EngravePreview {
  const def = getEngraveDef(engraveId);
  if (!def) return { ok: false, error: 'unknown', needsReplaceChoice: false, duplicateIndex: null };
  if (isUniqueItem(item)) return { ok: false, error: 'unique', needsReplaceChoice: false, duplicateIndex: null };
  if (hasEngravedMod(item)) return { ok: false, error: 'already', needsReplaceChoice: false, duplicateIndex: null };
  if (!canEngraveOnSlot(def, item.slot, item.weaponType)) {
    return { ok: false, error: 'slot', needsReplaceChoice: false, duplicateIndex: null };
  }

  const mods = item.mods ?? [];
  const duplicateIndex = mods.findIndex((m) => m.type === def.modType);
  // 3MOD以下 → 追加。4MOD → いずれか1つを置換（同種があればそれを優先候補に）
  const needsReplaceChoice = mods.length >= MAX_ITEM_MODS && duplicateIndex < 0;

  return {
    ok: true,
    needsReplaceChoice,
    duplicateIndex: duplicateIndex >= 0 ? duplicateIndex : null,
  };
}

/**
 * 刻印を適用した新しいアイテムを返す（元は変更しない）。
 * @param replaceIndex 4MODで同種MODが無い場合に置換するMODのindex。
 *   未指定かつ4MODなら適用不可（needsReplaceChoiceのケース）。
 */
export function applyEngrave(
  item: Item,
  engraveId: string,
  replaceIndex?: number
): { item: Item } | { error: EngraveError } {
  const preview = previewEngrave(item, engraveId);
  if (!preview.ok) return { error: preview.error ?? 'unknown' };

  const def = getEngraveDef(engraveId)!;
  const newMod = makeEngravedMod(def);
  const mods: ItemMod[] = [...(item.mods ?? [])];

  if (preview.duplicateIndex !== null) {
    // 同種MODを刻印値で置換
    mods[preview.duplicateIndex] = newMod;
  } else if (mods.length < MAX_ITEM_MODS) {
    // 空きあり → 追加
    mods.push(newMod);
  } else {
    // 4MOD → 指定スロットを置換
    if (replaceIndex === undefined || replaceIndex < 0 || replaceIndex >= mods.length) {
      return { error: 'slot' };
    }
    mods[replaceIndex] = newMod;
  }

  return { item: { ...item, mods } };
}
