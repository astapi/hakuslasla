import { describe, it, expect, afterEach } from 'vitest';

import {
  setActivePassiveSeason,
  getAllPassiveNodes,
  getStartNode,
  getPassiveNode,
  LATEST_PASSIVE_SEASON,
} from '../../data/passiveTree';
import legacyJson from '../../data/json/passiveTree.json';
import s3Json from '../../data/json/passiveTree_s3.json';

describe('data/passiveTree シーズン別ツリー切替', () => {
  // 各テスト後にデフォルト（最新シーズン）へ戻す
  afterEach(() => {
    setActivePassiveSeason(LATEST_PASSIVE_SEASON);
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

  it('切替後も start ノードが取得できる', () => {
    setActivePassiveSeason(2);
    expect(getStartNode()?.id).toBe(legacyJson.startNodeId);

    setActivePassiveSeason(3);
    expect(getStartNode()?.id).toBe(s3Json.startNodeId);
  });

  it('アクティブツリーに存在するノードIDは getPassiveNode で取得できる', () => {
    setActivePassiveSeason(3);
    const firstNodeId = s3Json.nodes[0].id;
    expect(getPassiveNode(firstNodeId)?.id).toBe(firstNodeId);
  });
});
