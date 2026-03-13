import { ItemBase } from '@/types';

export function isUniqueItem(item: Pick<ItemBase, 'fixedMods'>): boolean {
  return (item.fixedMods?.length ?? 0) > 0;
}
