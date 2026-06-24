import { describe, expect, it } from 'vitest';
import { isUniqueItem } from '../../utils/item';
import itemsData from '../../data/json/items.json';
import ja from '../../locales/ja.json';
import en from '../../locales/en.json';
import zh from '../../locales/zh.json';
import ko from '../../locales/ko.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import de from '../../locales/de.json';

const locales = { ja, en, zh, ko, es, fr, de };

describe('utils/item', () => {
  it('isUniqueItem は fixedMods を持つアイテムをユニークとして判定する', () => {
    expect(
      isUniqueItem({
        fixedMods: [{ type: 'hp_regen', value: 20, tier: 0 }],
      })
    ).toBe(true);
  });

  it('isUniqueItem は通常ドロップ装備をユニークとして扱わない', () => {
    expect(isUniqueItem({ fixedMods: undefined })).toBe(false);
  });
});

describe('アイテム翻訳', () => {
  it('evasion系統の通常ドロップ装備名が全ロケールに存在する', () => {
    const itemIds = Object.keys(itemsData.items).filter(
      (id) => id.includes('_evasion_') && !id.startsWith('uber_')
    );

    for (const [locale, messages] of Object.entries(locales)) {
      for (const itemId of itemIds) {
        expect(
          messages.items[itemId as keyof typeof messages.items]?.name,
          `${locale}: ${itemId} の翻訳が存在しない`
        ).toBeTruthy();
      }
    }
  });
});
