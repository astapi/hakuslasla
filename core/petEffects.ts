/**
 * ペットのバフ効果を CombinedModEffects に統合する純粋関数。
 * ATK/DEF の increased% 系と maxHp(フラット) は基礎ステータス側で扱うため、
 * ここでは扱わず usePlayerStore.getTotalStats() 側で取り込む。
 */

import { PetBuff } from '@/types';
import { CombinedModEffects } from './types';

export function applyPetBuff(
  mods: CombinedModEffects,
  buff: PetBuff | null | undefined,
  multiplier = 1
): CombinedModEffects {
  if (!buff) return mods;
  return {
    ...mods,
    hpRegen: mods.hpRegen + (buff.hpRegen ?? 0) * multiplier,
    attackSpeedPct: mods.attackSpeedPct + (buff.attackSpeedPct ?? 0) * multiplier,
    poisonChance: mods.poisonChance + (buff.poisonChance ?? 0) * multiplier,
    igniteChance: mods.igniteChance + (buff.igniteChance ?? 0) * multiplier,
    freezeChance: mods.freezeChance + (buff.freezeChance ?? 0) * multiplier,
    criticalChance: mods.criticalChance + (buff.critChancePct ?? 0) * multiplier,
    lifestealPct: mods.lifestealPct + (buff.lifestealPct ?? 0) * multiplier,
    freezeChanceCapPct:
      mods.freezeChanceCapPct + (buff.freezeChanceCapPct ?? 0) * multiplier,
  };
}
