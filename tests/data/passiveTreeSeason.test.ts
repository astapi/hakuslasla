import { describe, it, expect, afterEach } from 'vitest';

import {
  setActivePassiveSeason,
  setActivePassiveClass,
  getAllPassiveNodes,
  getStartNode,
  getStartNodeId,
  getPassiveNode,
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
});
