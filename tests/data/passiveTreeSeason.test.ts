import { describe, it, expect, afterEach } from 'vitest';

import {
  setActivePassiveSeason,
  setActivePassiveClass,
  getAllPassiveNodes,
  getStartNode,
  getStartNodeId,
  getPassiveNode,
  calculatePassiveEffects,
  LATEST_PASSIVE_SEASON,
} from '../../data/passiveTree';
import legacyJson from '../../data/json/passiveTree.json';
import s3Json from '../../data/json/passiveTree_s3.json';

describe('data/passiveTree シーズン別ツリー切替', () => {
  // 各テスト後にデフォルト（最新シーズン）へ戻す
  afterEach(() => {
    setActivePassiveSeason(LATEST_PASSIVE_SEASON);
    setActivePassiveClass(undefined);
  });

  it('season <= 2 では legacy ツリー、season >= 3 では s3 ツリーのノード数になる', () => {
    setActivePassiveSeason(2);
    expect(getAllPassiveNodes().length).toBe(legacyJson.nodes.length);

    setActivePassiveSeason(3);
    expect(getAllPassiveNodes().length).toBe(s3Json.nodes.length);
  });

  it('season=1 も legacy ツリー（後方互換）として扱われる', () => {
    setActivePassiveSeason(1);
    expect(getAllPassiveNodes().length).toBe(legacyJson.nodes.length);
  });

  it('S2(legacy)はクラス別スタートを持たず共通 startNodeId を返す', () => {
    setActivePassiveSeason(2);
    setActivePassiveClass('warrior');
    // legacy には startNodeIds が無いため、クラスを設定しても共通 startNodeId
    expect(getStartNode()?.id).toBe(legacyJson.startNodeId);
  });

  it('S3はクラスに応じたスタートノードを返す', () => {
    setActivePassiveSeason(3);
    const starts = s3Json.startNodeIds as Record<string, string>;
    setActivePassiveClass('warrior');
    expect(getStartNodeId()).toBe(starts.warrior);
    setActivePassiveClass('ranger');
    expect(getStartNodeId()).toBe(starts.ranger);
    setActivePassiveClass('tamer');
    expect(getStartNode()?.id).toBe(starts.tamer);
  });

  it('S3でクラス未設定時は最初のクラススタートにフォールバックする', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass(undefined);
    const starts = Object.values(s3Json.startNodeIds as Record<string, string>);
    expect(starts).toContain(getStartNodeId());
  });

  it('アクティブツリーに存在するノードIDは getPassiveNode で取得できる', () => {
    setActivePassiveSeason(3);
    const firstNodeId = s3Json.nodes[0].id;
    expect(getPassiveNode(firstNodeId)?.id).toBe(firstNodeId);
  });

  it('S3のウォリアー強化ノードは被弾回復・ブロック・遅延を集計する', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass('warrior');

    const effects = calculatePassiveEffects(['cri_b1_n', 'cri_b1_k', 'cri_b2_k', 'cri_b3_k']);

    expect(effects.hp_on_taken_hit).toBe(175);
    expect(effects.block_chance).toBe(19);
    expect(effects.damage_defer_pct).toBe(12);
    expect(effects.repeat_hit_damage_reduction_pct).toBe(15);
  });

  it('S3の発火強化ノードは吸収と発火中被ダメ軽減を集計する', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass('elementalist');

    const effects = calculatePassiveEffects(['ign_b1_n', 'ign_b1_k', 'ign_b2_n', 'ign_b2_k', 'ign_b3_n', 'ign_b3_k']);

    expect(effects.ignite_lifesteal).toBe(61);
    expect(effects.ignite_damage_reduction).toBe(37);
    expect(effects.ignite_damage_more_pct).toEqual([12, 40]);
  });

  it('S3のフロスト強化ノードは最大チル/フリーズ倍率と防御効果を集計する', () => {
    setActivePassiveSeason(3);
    setActivePassiveClass('frostmage');

    const effects = calculatePassiveEffects(['frz_b1_k', 'frz_b2_k', 'frz_b3_n', 'frz_b3_k']);

    expect(effects.chill_freeze_damage_mult).toBe(1.35);
    expect(effects.damage_defer_pct).toBe(22);
    expect(effects.repeat_hit_damage_reduction_pct).toBe(12);
    expect(effects.auto_cleanse_interval_ms).toBe(8000);
  });
});
