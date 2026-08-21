import { createEmptyModEffects } from '../../../core/modEffects';
import type { CombinedModEffects, Stats } from '../../../core/types';
import type { PvpBuildSnapshot, PvpEvent } from '../../../core/pvp/types';

/** MODを部分指定で作る */
export function mods(overrides: Partial<CombinedModEffects> = {}): CombinedModEffects {
  return { ...createEmptyModEffects(), ...overrides };
}

/** ビルドスナップショットを作る */
export function build(
  stats: Stats,
  overrides: Partial<CombinedModEffects> = {}
): PvpBuildSnapshot {
  return { stats, mods: mods(overrides) };
}

/** イベントの side を反転させる（対称性テスト用） */
export function mirrorEvents(events: PvpEvent[]): PvpEvent[] {
  return events.map((e) => ({ ...e, side: (e.side === 0 ? 1 : 0) as 0 | 1 }));
}

/** 実クリア者相当の2ビルド（docs/pvp-design.md §3.3 の実データ） */
export const SALT = build({ maxHp: 6803, atk: 6405, def: 2223 }, { attackSpeedPct: 68 });
export const MAKOPI = build({ maxHp: 4241, atk: 3272, def: 2224 }, { attackSpeedPct: 46 });
