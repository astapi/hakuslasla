import { describe, it, expect } from 'vitest';
import {
  PVP_RULESET_LATEST,
  PVP_RULESET_V1,
  getPvpRuleset,
  listPvpRulesetVersions,
} from '../../../core/pvp/ruleset';

describe('core/pvp/ruleset', () => {
  it('v1 は設計書の決定値を持つ', () => {
    expect(PVP_RULESET_V1).toMatchObject({
      version: 1,
      damageScale: 0.15,
      playerAccuracy: 500,
      suddenDeathStartSec: 45,
      suddenDeathRampPctPerSec: 5,
      timeLimitSec: 90,
      statusResistMode: 'chanceReduction',
      statusResistCapPct: 90,
      poisonResistAppliesTo: 'damage',
      igniteResistEnabled: true,
      royalRoarCleansesIgnite: true,
      autoCleanseCleansesIgnite: true,
      warlordEnrageCheckPhase: 'tick',
      maxActionsPerTick: 5,
      damageScaleAppliesToRetaliate: true,
      suddenDeathAppliesToDot: true,
    });
  });

  it('getPvpRuleset でバージョンから引ける', () => {
    expect(getPvpRuleset(1)).toBe(PVP_RULESET_V1);
    expect(listPvpRulesetVersions()).toEqual([1]);
    expect(PVP_RULESET_LATEST).toBe(PVP_RULESET_V1);
  });

  it('未知のバージョンは例外', () => {
    expect(() => getPvpRuleset(99)).toThrow(/unknown PvP ruleset version/);
  });

  it('ルールセットは凍結されている（過去バージョンの書き換え防止）', () => {
    expect(Object.isFrozen(PVP_RULESET_V1)).toBe(true);
  });
});
