/**
 * 実クリアビルドの総当たりPvP
 *
 * tools/build-explorer/data/builds.json のS3ビルドを PvpBuildSnapshot に変換し、
 * 総当たりで対戦させて決着時間の分布・時間切れ率・draw率・side0勝率を出す。
 *
 * 使い方:
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/runPvpMatrix.ts
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/runPvpMatrix.ts --sample 100
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/runPvpMatrix.ts --full
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/runPvpMatrix.ts --replay 0 1 12345
 */

import * as fs from 'fs';
import * as path from 'path';

import { runPvpBattle } from '../../core/pvpEngine';
import { derivePvpSeed } from '../../core/pvp/rng';
import { getPvpRuleset } from '../../core/pvp/ruleset';
import type { PvpBuildSnapshot, PvpResult } from '../../core/pvp/types';
import { DEFAULT_BATTLE_CONFIG } from '../../core/types';
import { createRng } from '../../core/simulation';
import { buildToSimInput, type BuildRecord } from '../../tools/build-explorer/simBuild';

const RULESET_VERSION = 1;
const TPS = DEFAULT_BATTLE_CONFIG.ticksPerSecond;

// ========================================
// ビルド読み込み
// ========================================

interface LoadedBuild {
  index: number;
  docId: string;
  name: string;
  type: string;
  level: number;
  snapshot: PvpBuildSnapshot;
  archetype: string;
}

/** ビルドのアーキタイプを主要MODから雑に分類する（観測用。バランス調整には使わない） */
function classifyArchetype(snapshot: PvpBuildSnapshot): string {
  const m = snapshot.mods;
  if (m.heavyStrike) return 'heavyStrike';
  if (m.noDirectDamage) return 'noDirectDamage';
  if (m.hpToShield) return 'shield';
  if (m.evasion >= 800) return 'evasion';
  if (m.poisonChance >= 50) return 'poison';
  if (m.igniteChance >= 50) return 'ignite';
  if (m.freezeChance > 0 || m.chillChance >= 30) return 'chillFreeze';
  if (m.criticalChance >= 40) return 'crit';
  return 'other';
}

function loadBuilds(): LoadedBuild[] {
  const file = path.join(__dirname, '..', '..', 'tools', 'build-explorer', 'data', 'builds.json');
  const all = JSON.parse(fs.readFileSync(file, 'utf8')) as BuildRecord[];
  const s3 = all.filter((r) => Number(r.data.season) === 3);
  return s3.map((record, index) => {
    const { playerStats, modEffects } = buildToSimInput(record.data);
    const snapshot: PvpBuildSnapshot = { stats: playerStats, mods: modEffects };
    return {
      index,
      docId: record.docId,
      name: record.data.name ?? record.docId,
      type: record.data.type,
      level: record.data.level,
      snapshot,
      archetype: classifyArchetype(snapshot),
    };
  });
}

// ========================================
// 対戦シード
// ========================================

/** 対戦ペアから決定的にシードを作る（0にならない） */
function matchSeed(i: number, j: number): number {
  return derivePvpSeed(derivePvpSeed(i + 1, j + 1), 0);
}

// ========================================
// 集計
// ========================================

interface Stats {
  matches: number;
  side0Wins: number;
  side1Wins: number;
  draws: number;
  timeouts: number;
  kos: number;
  totalTicks: number;
  ticks: number[];
  /** KO決着に限った side0 勝利数（先攻有利の有無を見る診断用） */
  koSide0Wins: number;
  /** 時間切れのうち残HP割合が完全同値だった数（防衛側の不戦勝） */
  timeoutExactTies: number;
}

function emptyStats(): Stats {
  return {
    matches: 0, side0Wins: 0, side1Wins: 0, draws: 0,
    timeouts: 0, kos: 0, totalTicks: 0, ticks: [],
    koSide0Wins: 0, timeoutExactTies: 0,
  };
}

function record(stats: Stats, r: PvpResult): void {
  stats.matches += 1;
  stats.totalTicks += r.elapsedTicks;
  stats.ticks.push(r.elapsedTicks);
  if (r.winner === 'draw') stats.draws += 1;
  else if (r.winner === 0) stats.side0Wins += 1;
  else stats.side1Wins += 1;
  if (r.reason === 'timeout') {
    stats.timeouts += 1;
    if (r.finalHpPct[0] === r.finalHpPct[1]) stats.timeoutExactTies += 1;
  }
  if (r.reason === 'ko') {
    stats.kos += 1;
    if (r.winner === 0) stats.koSide0Wins += 1;
  }
}

const pct = (n: number, d: number) => (d === 0 ? '0.00%' : `${((n / d) * 100).toFixed(2)}%`);

function histogram(ticks: number[]): void {
  const buckets: { label: string; max: number }[] = [
    { label: '  0-5s ', max: 5 },
    { label: '  5-10s', max: 10 },
    { label: ' 10-15s', max: 15 },
    { label: ' 15-20s', max: 20 },
    { label: ' 20-30s', max: 30 },
    { label: ' 30-45s', max: 45 },
    { label: ' 45-60s', max: 60 },
    { label: ' 60-90s', max: 90 },
    { label: ' 90s+  ', max: Infinity },
  ];
  const counts = new Array(buckets.length).fill(0);
  for (const t of ticks) {
    const sec = t / TPS;
    for (let b = 0; b < buckets.length; b++) {
      if (sec <= buckets[b].max) { counts[b] += 1; break; }
    }
  }
  const total = ticks.length || 1;
  console.log('\n決着時間の分布');
  for (let b = 0; b < buckets.length; b++) {
    const ratio = counts[b] / total;
    const bar = '█'.repeat(Math.round(ratio * 50));
    console.log(`  ${buckets[b].label} ${String(counts[b]).padStart(7)}  ${pct(counts[b], total).padStart(7)} ${bar}`);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

// ========================================
// リプレイ
// ========================================

function replay(builds: LoadedBuild[], a: number, b: number, seed: number): void {
  const A = builds[a];
  const B = builds[b];
  if (!A || !B) throw new Error(`ビルドの添字が範囲外: ${a}, ${b} (0..${builds.length - 1})`);
  console.log(`side0 [${a}] ${A.name} Lv${A.level} ${A.type} (${A.archetype}) HP${A.snapshot.stats.maxHp} ATK${A.snapshot.stats.atk} DEF${A.snapshot.stats.def}`);
  console.log(`side1 [${b}] ${B.name} Lv${B.level} ${B.type} (${B.archetype}) HP${B.snapshot.stats.maxHp} ATK${B.snapshot.stats.atk} DEF${B.snapshot.stats.def}`);
  console.log(`seed=${seed} rulesetVersion=${RULESET_VERSION}\n`);

  const r = runPvpBattle({ sides: [A.snapshot, B.snapshot], seed, rulesetVersion: RULESET_VERSION });
  for (const e of r.events) {
    const sec = (e.tick / TPS).toFixed(2).padStart(6);
    console.log(`${sec}s  side${e.side}  ${e.type.padEnd(16)} ${JSON.stringify(e.data)}`);
  }
  console.log(`\n結果: winner=${r.winner} reason=${r.reason} ticks=${r.elapsedTicks} (${(r.elapsedTicks / TPS).toFixed(2)}s)`);
  console.log(`最終HP    : ${r.finalHp[0]} / ${r.finalHp[1]}`);
  console.log(`最終シールド: ${r.finalShield[0]} / ${r.finalShield[1]}`);
  console.log(`残存割合  : ${(r.finalHpPct[0] * 100).toFixed(1)}% / ${(r.finalHpPct[1] * 100).toFixed(1)}%  (HP+シールド)`);
  console.log(`イベント数: ${r.events.length}`);
}

// ========================================
// main
// ========================================

function main(): void {
  const argv = process.argv.slice(2);
  const allBuilds = loadBuilds();

  const replayIdx = argv.indexOf('--replay');
  if (replayIdx >= 0) {
    const a = Number(argv[replayIdx + 1] ?? 0);
    const b = Number(argv[replayIdx + 2] ?? 1);
    const seed = Number(argv[replayIdx + 3] ?? matchSeed(a, b));
    replay(allBuilds, a, b, seed);
    return;
  }

  const full = argv.includes('--full');
  let sample = 50;
  const sampleIdx = argv.indexOf('--sample');
  if (sampleIdx >= 0) sample = Number(argv[sampleIdx + 1] ?? 50);

  let builds = allBuilds;
  if (!full && sample < allBuilds.length) {
    // seed固定のランダム抽出（再現可能）
    const rng = createRng(20260821);
    const pool = [...allBuilds];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    builds = pool.slice(0, sample);
  }

  const n = builds.length;
  const totalMatches = (n * (n - 1)) / 2;
  const ruleset = getPvpRuleset(RULESET_VERSION);
  console.log(`PvP総当たり: ${n}ビルド / ${totalMatches.toLocaleString()}試合  (rulesetVersion=${ruleset.version})`);
  console.log(`damageScale=${ruleset.damageScale} playerAccuracy=${ruleset.playerAccuracy} ` +
    `suddenDeath=${ruleset.suddenDeathStartSec}s+${ruleset.suddenDeathRampPctPerSec}%/s timeLimit=${ruleset.timeLimitSec}s`);

  const overall = emptyStats();
  const byArchetype = new Map<string, { wins: number; losses: number; draws: number }>();
  const bump = (key: string, field: 'wins' | 'losses' | 'draws') => {
    let e = byArchetype.get(key);
    if (!e) { e = { wins: 0, losses: 0, draws: 0 }; byArchetype.set(key, e); }
    e[field] += 1;
  };

  const start = Date.now();
  let done = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const seed = matchSeed(builds[i].index, builds[j].index);
      const r = runPvpBattle({
        sides: [builds[i].snapshot, builds[j].snapshot],
        seed,
        rulesetVersion: RULESET_VERSION,
      });
      record(overall, r);
      if (r.winner === 'draw') {
        bump(builds[i].archetype, 'draws');
        bump(builds[j].archetype, 'draws');
      } else {
        const winner = r.winner === 0 ? i : j;
        const loser = r.winner === 0 ? j : i;
        bump(builds[winner].archetype, 'wins');
        bump(builds[loser].archetype, 'losses');
      }
      done += 1;
      if (full && done % 5000 === 0) {
        const elapsed = (Date.now() - start) / 1000;
        process.stderr.write(`  ${done.toLocaleString()} / ${totalMatches.toLocaleString()} (${elapsed.toFixed(0)}s)\n`);
      }
    }
  }
  const elapsedMs = Date.now() - start;

  const sorted = [...overall.ticks].sort((a, b) => a - b);
  console.log('\n=== 全体 ===');
  console.log(`試合数        : ${overall.matches.toLocaleString()}`);
  console.log(`side0 勝率    : ${pct(overall.side0Wins, overall.matches)} (${overall.side0Wins.toLocaleString()})`);
  console.log(`side1 勝率    : ${pct(overall.side1Wins, overall.matches)} (${overall.side1Wins.toLocaleString()})`);
  console.log(`draw 率       : ${pct(overall.draws, overall.matches)} (${overall.draws.toLocaleString()})`);
  console.log(`KO 率         : ${pct(overall.kos, overall.matches)}`);
  console.log(`KO限定 side0勝率: ${pct(overall.koSide0Wins, overall.kos)}  ← 先攻有利が無ければ50%近傍`);
  console.log(`時間切れ率    : ${pct(overall.timeouts, overall.matches)} (${overall.timeouts.toLocaleString()})`);
  console.log(`  うち完全同値: ${overall.timeoutExactTies.toLocaleString()} (防衛側の不戦勝)`);
  console.log(`平均ティック  : ${(overall.totalTicks / overall.matches).toFixed(1)} (${(overall.totalTicks / overall.matches / TPS).toFixed(2)}s)`);
  console.log(`中央値        : ${percentile(sorted, 0.5)} (${(percentile(sorted, 0.5) / TPS).toFixed(2)}s)`);
  console.log(`p10 / p90     : ${(percentile(sorted, 0.1) / TPS).toFixed(2)}s / ${(percentile(sorted, 0.9) / TPS).toFixed(2)}s`);
  console.log(`最短 / 最長   : ${(sorted[0] / TPS).toFixed(2)}s / ${(sorted[sorted.length - 1] / TPS).toFixed(2)}s`);
  console.log(`実行時間      : ${(elapsedMs / 1000).toFixed(2)}s (${(elapsedMs / overall.matches).toFixed(3)} ms/試合)`);

  histogram(overall.ticks);

  console.log('\n=== アーキタイプ別（観測のみ。§3.3によりこれを理由に係数は変えない） ===');
  const rows = [...byArchetype.entries()].sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses));
  console.log('  archetype       試合数    勝率');
  for (const [key, v] of rows) {
    const total = v.wins + v.losses + v.draws;
    console.log(`  ${key.padEnd(16)}${String(total).padStart(7)}  ${pct(v.wins, total).padStart(7)}`);
  }
}

main();
