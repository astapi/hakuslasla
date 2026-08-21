/**
 * PvP用のRNGストリーム派生
 *
 * 1つの seed から「側0用」「側1用」「行動順コイントス用」の3本の独立ストリームを
 * 決定的な整数演算だけで派生させる。
 *
 * なぜ側ごとに分けるか（docs/pvp-p1-engine-spec.md §5.2）:
 * 全ての判定が `chance > 0` でショートサーキットするため、単一ストリームを共有すると
 * 「相手のビルドを変えると自分のクリ結果が変わる」という不健全な結合が生まれる。
 *
 * seed の制約:
 * - `createRng(0)` は xorshift の状態が常に0になり永久に0を返すため seed=0 は禁止
 *   （`assertValidPvpSeed` が弾く）
 * - 派生後のサブシードも `| 1` で必ず奇数（≠0）にして同じ事故を回避する
 */

import { createRng } from '../simulation';

/** PvP戦闘で使う3本のRNGストリーム */
export interface PvpRngStreams {
  /** 側ごとの独立ストリーム。[0]=挑戦者 [1]=防衛者 */
  sides: [() => number, () => number];
  /** 行動順のコイントス専用ストリーム */
  order: () => number;
}

/**
 * PvPのseedとして妥当かを検証する。
 * 非決定要因（Math.random / Date.now）の混入を型ではなく実行時にも弾く。
 */
export function assertValidPvpSeed(seed: number): void {
  if (typeof seed !== 'number' || !Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error(`PvP seed must be a finite integer: ${String(seed)}`);
  }
  if (seed === 0) {
    // createRng(0) は常に 0 を返す（xorshiftの不動点）
    throw new Error('PvP seed must not be 0 (createRng(0) is a fixed point)');
  }
}

/**
 * seed とストリーム番号から派生シードを作る（splitmix32相当の整数ミックス）
 *
 * Math.imul と 32bit ビット演算だけを使うため、HermesとNode V8で完全に一致する。
 * 最後に `| 1` して 0 を回避する。
 */
export function derivePvpSeed(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b9)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) | 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) | 0;
  x = (x ^ (x >>> 15)) | 0;
  return x | 1;
}

/** seed から3本のストリームを派生する */
export function createPvpRngStreams(seed: number): PvpRngStreams {
  assertValidPvpSeed(seed);
  return {
    sides: [
      createRng(derivePvpSeed(seed, 0)),
      createRng(derivePvpSeed(seed, 1)),
    ],
    order: createRng(derivePvpSeed(seed, 2)),
  };
}
