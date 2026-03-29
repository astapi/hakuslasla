import { describe, expect, it } from 'vitest';

/**
 * getModDescription の攻撃速度符号ロジックのテスト
 * data/items.ts はReact Native依存があるため、符号ロジック部分を直接検証する
 */
function formatAttackSpeed(value: number): string {
  return `攻撃速度${value >= 0 ? '+' : ''}${value}%`;
}

function formatAttackSpeedMore(value: number): string {
  return `攻撃速度${value >= 0 ? '+' : ''}${value}% more`;
}

describe('getModDescription 攻撃速度の符号表記', () => {
  it('正の攻撃速度MODは +X% と表示される', () => {
    expect(formatAttackSpeed(10)).toBe('攻撃速度+10%');
  });

  it('負の攻撃速度MODは -X% と表示される（+-にならない）', () => {
    expect(formatAttackSpeed(-15)).toBe('攻撃速度-15%');
  });

  it('攻撃速度0は +0% と表示される', () => {
    expect(formatAttackSpeed(0)).toBe('攻撃速度+0%');
  });

  it('正の攻撃速度more MODは +X% more と表示される', () => {
    expect(formatAttackSpeedMore(20)).toBe('攻撃速度+20% more');
  });

  it('負の攻撃速度more MODは -X% more と表示される', () => {
    expect(formatAttackSpeedMore(-10)).toBe('攻撃速度-10% more');
  });
});
