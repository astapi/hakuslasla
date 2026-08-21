/**
 * core/combat — 「どちら側に効くか」に依存しない中立の戦闘ルール層
 *
 * PvE（core/battleEngine.ts → core/combatEffects.ts）と
 * PvP（core/pvpEngine.ts・P1で追加予定）の両方から使う。
 *
 * ルール:
 * - BattleEvent は組み立てない。数値結果と状態だけを返す。
 *   （BattleEvent の型名は 'player_attack' / 'enemy_attack' のようにPvE固有のため）
 * - player / enemy に固定された参照を持たない。攻撃側・防御側を入れ替えて呼べる。
 * - 式・丸め・RNGの呼び出し順序と回数は core/combatEffects.ts の元実装と完全に同一。
 */

export {
  executeAttack,
  calculateIncomingDamage,
  calculateHitChance,
  rollHit,
  calculateLifesteal,
  calculateHpRegen,
} from './damage';

export type { AttackOutcome } from './damage';

export {
  tryApplyPoison,
  processPoisonDamage,
  tryApplyIgnite,
  processIgniteDamage,
  isPoisoned,
  isIgnited,
} from './dot';

export type {
  PoisonApplyOutcome,
  PoisonDamageOutcome,
  IgniteDamageOutcome,
} from './dot';

export {
  tryApplyChill,
  processChillState,
  tryApplyFreeze,
  processFreezeState,
} from './status';

export type {
  ChillProcessOutcome,
  FreezeApplyOutcome,
  FreezeProcessOutcome,
} from './status';

export { createEmptyStatusView } from './types';

export type { CombatantView, StatusView } from './types';
