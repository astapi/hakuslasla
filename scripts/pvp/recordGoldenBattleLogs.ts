/**
 * ゴールデン戦闘ログの採取・検証
 *
 * core/combatEffects.ts を core/combat/ へ純粋抽出するリファクタで
 * 「PvEの挙動が1ビットも変わっていない」ことを機械的に保証するための安全網。
 *
 * 複数の敵 × 複数のMODセット × 複数シードで createBattleEngine を回し、
 * 発生した全 BattleEvent を決定的にシリアライズしてハッシュ化する。
 *
 * 実行:
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/recordGoldenBattleLogs.ts --record
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/recordGoldenBattleLogs.ts --verify
 *
 * --record : scripts/pvp/golden/battleLogs.json にベースラインを書き出す
 * --verify : 現在のコードの結果とベースラインを比較。差分があれば
 *            最初に食い違ったイベントの位置（index / tick / type）を表示して非0終了する
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { createBattleEngine, createRng } from '../../core';
import { createEmptyModEffects } from '../../core/modEffects';
import type {
  BattleEvent,
  CombinedModEffects,
  EnemyConfig,
  Stats,
} from '../../core/types';
import monstersData from '../../data/json/monsters.json';

// ========================================
// 採取条件
// ========================================

const MAX_TICKS = 6000; // 200秒

/** UberUber魔王クリア者相当のステータス（毒・発火が乗る程度に殴り合いが続く） */
const END_GAME_STATS: Stats = {
  maxHp: 6800,
  atk: 6400,
  def: 2220,
};

/**
 * 通常敵・Uberボス・UberUberボスを含む10体。
 * 各敵に対して「一撃で終わらず、DoT・チル・回復が最低数ティックは回る」よう
 * プレイヤーステータスを敵の階層に合わせている。
 */
const ENEMY_TARGETS: { enemyId: string; playerStats: Stats }[] = [
  { enemyId: 'slime', playerStats: { maxHp: 120, atk: 4, def: 4 } },
  { enemyId: 'goblin_warrior', playerStats: { maxHp: 200, atk: 6, def: 8 } },
  { enemyId: 'skeleton_knight', playerStats: { maxHp: 300, atk: 8, def: 12 } },
  { enemyId: 'demon_lord', playerStats: { maxHp: 1500, atk: 120, def: 90 } },
  { enemyId: 'true_final_boss', playerStats: { maxHp: 12000, atk: 1800, def: 1400 } },
  { enemyId: 'uber_goblin_king', playerStats: END_GAME_STATS },
  { enemyId: 'uber_kraken', playerStats: END_GAME_STATS },
  { enemyId: 'uber_true_final_boss', playerStats: END_GAME_STATS },
  { enemyId: 'uber_uber_goblin_king', playerStats: END_GAME_STATS },
  { enemyId: 'uber_uber_demon_lord', playerStats: END_GAME_STATS },
];

const SEEDS = [12345, 777, 20260821] as const;

type ModSet = { name: string; mods: CombinedModEffects };

const withMods = (
  name: string,
  overrides: Partial<CombinedModEffects>
): ModSet => ({
  name,
  mods: { ...createEmptyModEffects(), ...overrides },
});

const MOD_SETS: ModSet[] = [
  // 空MOD（何も乗っていない素の状態）
  withMods('empty', {}),
  // 毒ビルド
  withMods('poison', {
    attackSpeedPct: 40,
    poisonChance: 60,
    poisonDamagePct: 120,
    poisonDamageMorePct: [50],
    poisonMaxStacks: 4,
    poisonLifesteal: 25,
    poisonDamageReduction: 15,
    poisonMultiStack: 1.5,
    hpRegen: 60,
    hpRegenPct: 1,
  }),
  // 発火ビルド
  withMods('ignite', {
    attackSpeedPct: 40,
    igniteChance: 70,
    igniteDamagePct: 150,
    igniteDamageMorePct: [40],
    igniteDurationPct: 60,
    igniteTickSpeedPct: 50,
    igniteLifesteal: 15,
    igniteDamageReduction: 10,
    igniteStackingDamage: true,
    hpOnHit: 30,
  }),
  // チル/フリーズビルド
  withMods('chillFreeze', {
    attackSpeedPct: 40,
    chillChance: 60,
    chillEffectPct: 40,
    chillDurationPct: 50,
    freezeChance: 30,
    freezeDurationPct: 100,
    freezeChanceCapPct: 5,
    chillFreezeDamageMult: 1.3,
    hpRegen: 40,
  }),
  // クリ追撃ビルド
  withMods('critFollowUp', {
    attackSpeedPct: 40,
    criticalChance: 45,
    criticalDamage: 120,
    criticalFollowUpAttack: true,
    followUpAttackPct: 30,
    hpOnCrit: 50,
    critLifestealPct: 10,
    kingSlam: true,
    royalRoar: true,
    uberCriticalFollowUp: true,
  }),
  // シールド/回避ビルド
  withMods('shieldEvade', {
    attackSpeedPct: 20,
    evasion: 900,
    evasionIncreasedPct: 60,
    evasionMorePct: [10],
    shield: 800,
    shieldIncreasedPct: 50,
    shieldMorePct: [20],
    shieldOnEvadeStreakHitPct: 10,
    shieldOn10AttacksPct: 15,
    shieldRechargeDelayMs: 2000,
    shieldRechargePct: 10,
    shieldBlocksDot: true,
    hpToShield: true,
    damageReductionPct: 15,
    damageDeferPct: 20,
    blockChance: 20,
    hpOnTakenHit: 40,
    retaliateDefPct: 20,
  }),
  // Uberツリー固有能力（重撃・防御転換・灼熱加速・時間経過強化・乱軍の王）
  withMods('uberTree', {
    attackSpeedPct: 30,
    heavyStrike: true,
    defHpToAtk: true,
    igniteIntensify: true,
    igniteChance: 40,
    poisonChance: 40,
    poisonMultiStack: 1.5,
    chillChance: 40,
    chillFreezeDamageMult: 1.3,
    timeAtkIncPct: 5,
    timeDefIncPct: 5,
    timeHpRegen: 50,
    warlordEnrage: true,
    autoCleanseIntervalMs: 8000,
    chillResistPct: 20,
    freezeResistPct: 20,
    poisonResistPct: 20,
    igniteResistPct: 20,
    repeatHitDamageReductionPct: 10,
    lowHpDamageReductionPct: 20,
    hpRegenToAtkPct: 50,
    hpRegen: 100,
  }),
  // 通常ダメージ無効キーストーン（DoTのみで削る）
  withMods('dotOnly', {
    attackSpeedPct: 40,
    noDirectDamage: true,
    poisonChance: 100,
    poisonDamagePct: 200,
    poisonMaxStacks: 6,
    igniteChance: 100,
    igniteDamagePct: 200,
    igniteDurationPct: 50,
  }),
];

// ========================================
// シリアライズ
// ========================================

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

/** キー順に依存しない決定的なJSON化 */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
};

const hash8 = (input: string): string =>
  createHash('sha256').update(input).digest('hex').slice(0, 8);

const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

/** 1イベント = "tick|type|dataDigest" */
const encodeEvent = (event: BattleEvent): string =>
  `${event.tick}|${event.type}|${hash8(stableStringify(event.data))}`;

// ========================================
// 実行
// ========================================

interface BattleRecord {
  key: string;
  enemyId: string;
  modSet: string;
  seed: number;
  eventCount: number;
  eventsHash: string;
  events: string[];
  final: {
    playerHp: number;
    enemyHp: number;
    playerShield: number;
    winner: string | null;
    elapsedTicks: number;
    isFinished: boolean;
    playerAttackCount: number;
    enemyPoisonStacks: number;
  };
}

const runBattle = (
  enemyId: string,
  playerStats: Stats,
  modSet: ModSet,
  seed: number
): BattleRecord => {
  const enemy = enemyMap.get(enemyId);
  if (!enemy) throw new Error(`enemy not found: ${enemyId}`);

  const rng = createRng(seed);
  const { engine, events: introEvents } = createBattleEngine({
    playerStats,
    playerCurrentHp: playerStats.maxHp,
    playerMods: modSet.mods,
    enemy: { ...enemy, attackSpeed: enemy.attackSpeed ?? 1 },
    dungeonId: enemyId,
    rng,
  });

  const encoded: string[] = introEvents.map(encodeEvent);

  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    if (engine.isFinished()) break;
    const tickEvents = engine.advanceTicks(1);
    for (const event of tickEvents) encoded.push(encodeEvent(event));
  }

  const state = engine.getState();

  return {
    key: `${enemyId}::${modSet.name}::${seed}`,
    enemyId,
    modSet: modSet.name,
    seed,
    eventCount: encoded.length,
    eventsHash: sha256(encoded.join('\n')),
    events: encoded,
    final: {
      playerHp: state.player.currentHp,
      enemyHp: state.enemy.currentHp,
      playerShield: state.playerShield,
      winner: state.winner,
      elapsedTicks: state.elapsedTicks,
      isFinished: state.isFinished,
      playerAttackCount: state.playerAttackCount,
      enemyPoisonStacks: state.enemyPoisonStacks.length,
    },
  };
};

const runAll = (): BattleRecord[] => {
  const records: BattleRecord[] = [];
  for (const target of ENEMY_TARGETS) {
    for (const modSet of MOD_SETS) {
      for (const seed of SEEDS) {
        records.push(runBattle(target.enemyId, target.playerStats, modSet, seed));
      }
    }
  }
  return records;
};

const GOLDEN_PATH = path.join(__dirname, 'golden', 'battleLogs.json');

interface GoldenFile {
  generatedAt: string;
  maxTicks: number;
  targets: { enemyId: string; playerStats: Stats }[];
  modSets: string[];
  seeds: number[];
  totalHash: string;
  records: BattleRecord[];
}

const record = (): void => {
  const records = runAll();
  const golden: GoldenFile = {
    generatedAt: new Date().toISOString(),
    maxTicks: MAX_TICKS,
    targets: ENEMY_TARGETS,
    modSets: MOD_SETS.map((m) => m.name),
    seeds: [...SEEDS],
    totalHash: sha256(records.map((r) => `${r.key}:${r.eventsHash}`).join('\n')),
    records,
  };

  fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(golden), 'utf8');

  const totalEvents = records.reduce((sum, r) => sum + r.eventCount, 0);
  const sizeKb = Math.round(fs.statSync(GOLDEN_PATH).size / 1024);
  console.log(`ゴールデンログを記録しました: ${GOLDEN_PATH}`);
  console.log(`  戦闘数: ${records.length} / 総イベント数: ${totalEvents} / サイズ: ${sizeKb}KB`);
  console.log(`  totalHash: ${golden.totalHash}`);
};

const verify = (): void => {
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error(`ゴールデンログがありません: ${GOLDEN_PATH}`);
    console.error('先に --record を実行してください。');
    process.exit(1);
  }

  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')) as GoldenFile;
  const goldenByKey = new Map(golden.records.map((r) => [r.key, r]));

  const current = runAll();
  const failures: string[] = [];

  for (const cur of current) {
    const exp = goldenByKey.get(cur.key);
    if (!exp) {
      failures.push(`[${cur.key}] ゴールデンに該当レコードがありません（採取条件が変わっています）`);
      continue;
    }
    if (exp.eventsHash === cur.eventsHash) {
      // イベント列が一致していれば最終stateも比較する
      const expFinal = stableStringify(exp.final);
      const curFinal = stableStringify(cur.final);
      if (expFinal !== curFinal) {
        failures.push(
          `[${cur.key}] 最終stateが不一致\n    expected: ${expFinal}\n    actual  : ${curFinal}`
        );
      }
      continue;
    }

    // 最初の不一致位置を特定
    const len = Math.max(exp.events.length, cur.events.length);
    let firstDiff = -1;
    for (let i = 0; i < len; i++) {
      if (exp.events[i] !== cur.events[i]) {
        firstDiff = i;
        break;
      }
    }

    const describe = (entry: string | undefined): string => {
      if (entry === undefined) return '(イベント無し)';
      const [tick, type, digest] = entry.split('|');
      return `tick=${tick} type=${type} data#${digest}`;
    };

    failures.push(
      [
        `[${cur.key}] イベント列が不一致`,
        `    イベント数: expected=${exp.eventCount} actual=${cur.eventCount}`,
        `    最初の不一致 index=${firstDiff}`,
        `      expected: ${describe(exp.events[firstDiff])}`,
        `      actual  : ${describe(cur.events[firstDiff])}`,
        `    最終state expected: ${stableStringify(exp.final)}`,
        `    最終state actual  : ${stableStringify(cur.final)}`,
      ].join('\n')
    );
  }

  const currentTotalHash = sha256(current.map((r) => `${r.key}:${r.eventsHash}`).join('\n'));

  if (failures.length > 0) {
    console.error(`ゴールデンログ検証: 失敗 (${failures.length}/${current.length} 戦闘で差分)`);
    for (const f of failures.slice(0, 20)) console.error(f);
    if (failures.length > 20) console.error(`  ... 他 ${failures.length - 20} 件`);
    console.error(`  totalHash: expected=${golden.totalHash} actual=${currentTotalHash}`);
    process.exit(1);
  }

  const totalEvents = current.reduce((sum, r) => sum + r.eventCount, 0);
  console.log(
    `ゴールデンログ検証: OK (${current.length} 戦闘 / ${totalEvents} イベント 完全一致)`
  );
  console.log(`  totalHash: ${currentTotalHash}`);
};

const main = (): void => {
  const args = process.argv.slice(2);
  if (args.includes('--record')) {
    record();
    return;
  }
  if (args.includes('--verify') || args.length === 0) {
    verify();
    return;
  }
  console.error('usage: recordGoldenBattleLogs.ts [--record|--verify]');
  process.exit(1);
};

main();
