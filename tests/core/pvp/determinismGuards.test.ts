import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 決定性を壊す書き方が PvP エンジンに混入していないことの静的チェック
 * （docs/pvp-p1-engine-spec.md §6）
 */
describe('core/pvp - 決定性ガード', () => {
  const files = [
    'core/pvpEngine.ts',
    'core/pvp/rng.ts',
    'core/pvp/ruleset.ts',
    'core/pvp/types.ts',
  ];

  /** コメントを除去したソース（説明文中の Math.random 等を誤検出しないため） */
  const read = (rel: string) =>
    fs
      .readFileSync(path.resolve(__dirname, '../../..', rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each(files)('%s に Math.pow / ** が無い', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/Math\.pow\s*\(/);
    // べき乗演算子（コメント内の ** は除くため演算子として使われる形だけを見る）
    expect(src).not.toMatch(/[\w)\]]\s\*\*\s/);
  });

  it.each(files)('%s に Math.random が無い', (file) => {
    expect(read(file)).not.toMatch(/Math\.random/);
  });

  it.each(files)('%s に Date / performance.now が無い', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/Date\.now|new Date\(/);
    expect(src).not.toMatch(/performance\.now/);
  });

  it('pvpEngine は bossBehaviors / battleEngine / gaugeBattle / endContent を参照しない', () => {
    const src = read('core/pvpEngine.ts');
    expect(src).not.toMatch(/from '\.\/bossBehaviors'/);
    expect(src).not.toMatch(/from '\.\/battleEngine'/);
    expect(src).not.toMatch(/from '\.\/gaugeBattle'/);
    expect(src).not.toMatch(/from '\.\/endContent'/);
    expect(src).not.toMatch(/from '\.\/combatEffects'/);
  });
});
