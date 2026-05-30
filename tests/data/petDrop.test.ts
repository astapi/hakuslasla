import { afterEach, describe, expect, it, vi } from 'vitest';
import { MONSTER_PET_DROPS, getPet, tryPetDrop } from '@/data/pets';
import dungeonsData from '@/data/json/dungeons.json';

/**
 * tryPetDrop のドロップ率ボーナス（テイマーのクラス固有能力など）のテスト
 * pet_slime は通常レア（基本ドロップ率 0.5%）
 */
describe('tryPetDrop ドロップ率ボーナス', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('対応ペットがいないモンスターは常にnull', () => {
    expect(tryPetDrop('unknown_monster', 100)).toBeNull();
  });

  it('ボーナスなしでは基本ドロップ率（0.5%）で判定される', () => {
    // 0.8% の乱数 → 基本0.5%を超えるためドロップしない
    vi.spyOn(Math, 'random').mockReturnValue(0.008);
    expect(tryPetDrop('slime')).toBeNull();
  });

  it('ボーナス+0.5%でドロップ率が1.0%に上がり、同じ乱数でドロップする', () => {
    // 0.8% の乱数 → ボーナス込み1.0%未満なのでドロップする
    vi.spyOn(Math, 'random').mockReturnValue(0.008);
    expect(tryPetDrop('slime', 0.5)).toBe('pet_slime');
  });
});

describe('MONSTER_PET_DROPS マッピング整合性', () => {
  it('マッピング先のペットIDがすべて pets.json に存在する', () => {
    for (const petId of Object.values(MONSTER_PET_DROPS)) {
      expect(getPet(petId), `${petId} が pets.json に未定義`).toBeDefined();
    }
  });

  it('アイスドラゴンのペットはフリーズ上限+1%を持つ', () => {
    const def = getPet('pet_ice_dragon');
    expect(def?.buff.freezeChanceCapPct).toBe(1);
    expect(def?.buff.freezeChance).toBe(1.5);
  });
});

describe('各ダンジョンに最低1体のペットドロップが存在する', () => {
  // 通常ダンジョン（出現モンスターを持つもの）を対象。Uber/異次元/デバッグは除外。
  const standardDungeons = Object.values(
    dungeonsData.dungeons as Record<
      string,
      {
        id: string;
        monsters?: { monsterId: string }[];
        boss?: { monsterId: string };
      }
    >
  ).filter(
    (d) =>
      (d.monsters?.length ?? 0) > 0 &&
      !/^(uber|debug)|dimensional/.test(d.id)
  );

  it.each(standardDungeons.map((d) => [d.id, d] as const))(
    '%s に少なくとも1体ペットドロップ対象の敵がいる',
    (_id, dungeon) => {
      const monsterIds = [
        ...(dungeon.monsters ?? []).map((m) => m.monsterId),
        ...(dungeon.boss ? [dungeon.boss.monsterId] : []),
      ];
      const hasPet = monsterIds.some((mid) => MONSTER_PET_DROPS[mid]);
      expect(hasPet, `${dungeon.id} にペットドロップ対象がいない`).toBe(true);
    }
  );
});
