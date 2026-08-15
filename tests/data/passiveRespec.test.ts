import { describe, it, expect, beforeEach } from 'vitest';
import {
  canRefundNode,
  canUnlockNode,
  getAllPassiveNodes,
  getStartNodeId,
  isConnectedFromStart,
  setActivePassiveClass,
  setActivePassiveSeason,
} from '../../data/passiveTree';
import type { CharacterType } from '../../types';

/**
 * リスペックでツリーが分断される（浮島ノードが残る）バグの回帰テスト。
 *
 * 旧実装は canRefundNode が「直接の子の前提条件」しか見ておらず、
 * S3ツリーで requiredNodes に OR 条件が入ったことで、
 * 返却によりスタートから到達できないノードを残せてしまっていた。
 * （実際にS3クリアデータ251件中81件が不正な構成になっていた）
 */

const CLASSES: CharacterType[] = ['warrior', 'ranger', 'tamer', 'frostmage', 'elementalist'];

/** スタートから貪欲に count 個まで解放した、正当なツリーを作る */
function buildValidTree(count: number): string[] {
  const start = getStartNodeId();
  const unlocked = [start];
  const all = getAllPassiveNodes();
  for (let i = 0; i < count; i++) {
    const next = all.find((n) => canUnlockNode(n.id, unlocked));
    if (!next) break;
    unlocked.push(next.id);
  }
  return unlocked;
}

describe('isConnectedFromStart', () => {
  beforeEach(() => {
    setActivePassiveSeason(3);
    setActivePassiveClass('warrior');
  });

  it('スタートのみは連結とみなす', () => {
    expect(isConnectedFromStart([getStartNodeId()])).toBe(true);
  });

  it('空配列は連結とみなす（未取得状態）', () => {
    expect(isConnectedFromStart([])).toBe(true);
  });

  it('正当に解放したツリーは連結と判定される', () => {
    const tree = buildValidTree(20);
    expect(tree.length).toBeGreaterThan(5);
    expect(isConnectedFromStart(tree)).toBe(true);
  });

  it('スタートを含まない集合は非連結', () => {
    const tree = buildValidTree(20);
    const withoutStart = tree.filter((id) => id !== getStartNodeId());
    expect(isConnectedFromStart(withoutStart)).toBe(false);
  });

  it('スタートから到達できない浮島を含む集合は非連結', () => {
    const start = getStartNodeId();
    // 遠くのノードだけを持つ状態（前提を満たさない浮島）
    const far = getAllPassiveNodes()
      .filter((n) => n.id !== start && (n.requiredNodes?.length ?? 0) > 0)
      .slice(-5)
      .map((n) => n.id);
    expect(isConnectedFromStart([start, ...far])).toBe(false);
  });
});

describe('canRefundNode（リスペックでツリーを壊せないこと）', () => {
  it('どのクラスでも、返却によって浮島を作れない', () => {
    setActivePassiveSeason(3);
    for (const cls of CLASSES) {
      setActivePassiveClass(cls);
      const tree = buildValidTree(25);
      expect(tree.length).toBeGreaterThan(5);

      for (const id of tree) {
        if (!canRefundNode(id, tree)) continue;
        // 返却が許可されたなら、返却後も必ず連結でなければならない
        const remaining = tree.filter((x) => x !== id);
        expect(
          isConnectedFromStart(remaining),
          `[${cls}] ${id} の返却で浮島が発生した`
        ).toBe(true);
      }
    }
  });

  it('スタートノードは返却できない', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass('warrior');
    const tree = buildValidTree(10);
    expect(canRefundNode(getStartNodeId(), tree)).toBe(false);
  });

  it('取得していないノードは返却できない', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass('warrior');
    const tree = buildValidTree(10);
    const notOwned = getAllPassiveNodes().find((n) => !tree.includes(n.id))!;
    expect(canRefundNode(notOwned.id, tree)).toBe(false);
  });

  it('末端ノード（誰も依存していない）は返却できる', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass('warrior');
    const tree = buildValidTree(15);
    const last = tree[tree.length - 1];
    expect(canRefundNode(last, tree)).toBe(true);
    expect(isConnectedFromStart(tree.filter((x) => x !== last))).toBe(true);
  });

  it('S2ツリーでも浮島を作れない', () => {
    setActivePassiveSeason(2);
    setActivePassiveClass('warrior');
    const tree = buildValidTree(20);
    for (const id of tree) {
      if (!canRefundNode(id, tree)) continue;
      expect(isConnectedFromStart(tree.filter((x) => x !== id))).toBe(true);
    }
  });
});
