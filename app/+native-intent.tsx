const INVITE_PATH = '/lootdive/invite';
const STORE_GOBLIN_KING_PATH = '/lootdive/store-goblin-king';
const STORE_GOBLIN_KING_ROUTE = '/battle/uber_uber_goblin_king?startFloor=1&staticBattle=1&screenshotBattle=1';

const storeGoblinKingRoute = (url: URL): string => {
  const lang = url.searchParams.get('lang');
  return lang ? `${STORE_GOBLIN_KING_ROUTE}&lang=${encodeURIComponent(lang)}` : STORE_GOBLIN_KING_ROUTE;
};

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'lootdive://placeholder');

    if (url.protocol === 'lootdive:' && (url.hostname === 'invite' || url.pathname === '/invite')) {
      return '/settings';
    }

    if (url.protocol === 'https:' && url.hostname === 'astapi.net' && url.pathname === INVITE_PATH) {
      return '/settings';
    }

    if (
      url.protocol === 'lootdive:' &&
      (url.hostname === 'store-goblin-king' || url.pathname === '/store-goblin-king')
    ) {
      return storeGoblinKingRoute(url);
    }

    if (url.protocol === 'https:' && url.hostname === 'astapi.net' && url.pathname === STORE_GOBLIN_KING_PATH) {
      return storeGoblinKingRoute(url);
    }

    return path;
  } catch {
    return path;
  }
}
