import { describe, it, expect } from 'vitest';
import { createBossEffectState, createBossIntroEvents } from '../../core/bossBehaviors';
import {
  DEMON_LORD_ENRAGE,
  getBaseBossId,
  getEnemyAtkMultiplier,
  getEnemyDamageReductionPct,
  getEnemyEnrageAtkMult,
  getEnemyRegenPerSecond,
  getPlayerPoisonFromBoss,
  isEndContentDungeon,
  isUberBoss,
  isUberUberBoss,
  UBER_UBER_BOSS_BY_UBER,
  UBER_UBER_DUNGEON_IDS,
} from '../../core/endContent';
import monstersData from '../../data/json/monsters.json';
import dungeonsData from '../../data/json/dungeons.json';
import dungeonListData from '../../data/json/dungeonList.json';

const ID = 'uber_uber_demon_lord';

describe('UberUber魔王 判定', () => {
  it('UberUberボスとして判定される', () => {
    expect(isUberUberBoss(ID)).toBe(true);
    expect(isUberBoss(ID)).toBe(true);
  });

  it('ベースIDは demon_lord', () => {
    expect(getBaseBossId(ID)).toBe('demon_lord');
  });

  it('uber_demon_lord から解決される', () => {
    expect(UBER_UBER_BOSS_BY_UBER['uber_demon_lord']).toBe(ID);
  });

  it('UBER_UBER_DUNGEON_IDS / エンドコンテンツに含まれる', () => {
    expect(UBER_UBER_DUNGEON_IDS).toContain(ID);
    expect(isEndContentDungeon(ID)).toBe(true);
  });
});

describe('UberUber魔王 データ定義', () => {
  it('モンスターが定義されている', () => {
    const m = (monstersData as any).monsters[ID];
    expect(m).toBeDefined();
    expect(m.maxHp).toBe(1300000);
    expect(m.isBoss).toBe(true);
  });

  it('ダンジョンが定義され、チケット必須である', () => {
    const d = (dungeonsData as any).dungeons[ID];
    expect(d).toBeDefined();
    expect(d.boss.monsterId).toBe(ID);
    expect(d.requiresTicket).toBe(true);
  });

  it('ダンジョン一覧に登録されている（選択画面に出るために必須）', () => {
    const ids = (dungeonListData as any).dungeons.map((x: { id: string }) => x.id);
    expect(ids).toContain(ID);
  });
});

describe('UberUber魔王 ステータス補正', () => {
  it('敵ATK倍率が設定されている', () => {
    expect(getEnemyAtkMultiplier(ID)).toBe(1.6);
    expect(getEnemyAtkMultiplier('uber_demon_lord')).toBe(1);
  });

  it('HP再生がUberより大幅に強化されている', () => {
    expect(getEnemyRegenPerSecond(ID)).toBe(10000);
    expect(getEnemyRegenPerSecond('uber_demon_lord')).toBe(1400);
  });

  it('ダメージ軽減がUberより高い', () => {
    expect(getEnemyDamageReductionPct(ID)).toBe(8);
    expect(getEnemyDamageReductionPct('uber_demon_lord')).toBe(4);
  });

  it('プレイヤーへの毒がUberより強い', () => {
    expect(getPlayerPoisonFromBoss(ID)?.damage).toBe(300);
    expect(getPlayerPoisonFromBoss('uber_demon_lord')?.damage).toBe(180);
  });
});

describe('UberUber魔王 滅びの刻限（エンレイジ）', () => {
  it('猶予時間内は等倍', () => {
    expect(getEnemyEnrageAtkMult(ID, 0)).toBe(1);
    expect(getEnemyEnrageAtkMult(ID, DEMON_LORD_ENRAGE.graceSec)).toBe(1);
  });

  it('猶予経過後は毎秒 atkRatePerSec ずつ線形に増加する', () => {
    const { graceSec, atkRatePerSec } = DEMON_LORD_ENRAGE;
    expect(getEnemyEnrageAtkMult(ID, graceSec + 10)).toBeCloseTo(1 + 10 * atkRatePerSec, 5);
    expect(getEnemyEnrageAtkMult(ID, graceSec + 100)).toBeCloseTo(1 + 100 * atkRatePerSec, 5);
  });

  it('時間経過で単調増加し、上限がない', () => {
    const a = getEnemyEnrageAtkMult(ID, 100);
    const b = getEnemyEnrageAtkMult(ID, 200);
    const c = getEnemyEnrageAtkMult(ID, 400);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('他のボスには適用されない', () => {
    expect(getEnemyEnrageAtkMult('uber_demon_lord', 999)).toBe(1);
    expect(getEnemyEnrageAtkMult('uber_uber_kraken', 999)).toBe(1);
  });
});

describe('UberUber魔王 戦闘開始時の効果', () => {
  it('フリーズ耐性50%が設定される', () => {
    const intro = createBossIntroEvents(0, ID);
    expect(intro.initBossEffects?.enemyFreezeResistPct).toBe(50);
  });

  it('Uber魔王にはフリーズ耐性が付かない', () => {
    const intro = createBossIntroEvents(0, 'uber_demon_lord');
    expect(intro.initBossEffects?.enemyFreezeResistPct).toBeUndefined();
  });

  it('初期状態のフリーズ耐性は0', () => {
    expect(createBossEffectState().enemyFreezeResistPct).toBe(0);
  });
});
