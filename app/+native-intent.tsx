const INVITE_PATH = '/lootdive/invite';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'lootdive://placeholder');

    if (url.protocol === 'lootdive:' && (url.hostname === 'invite' || url.pathname === '/invite')) {
      return '/settings';
    }

    if (url.protocol === 'https:' && url.hostname === 'astapi.net' && url.pathname === INVITE_PATH) {
      return '/settings';
    }

    return path;
  } catch {
    return path;
  }
}
