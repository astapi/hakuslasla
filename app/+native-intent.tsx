import { sanitizeInviteCode } from '@/lib/inviteLink';

const INVITE_PATH = '/lootdive/invite';

const toSettingsPath = (code: string | null | undefined): string => {
  const inviteCode = sanitizeInviteCode(code);
  return inviteCode ? `/settings?inviteCode=${inviteCode}` : '/settings';
};

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'lootdive://placeholder');

    if (url.protocol === 'lootdive:' && (url.hostname === 'invite' || url.pathname === '/invite')) {
      return toSettingsPath(url.searchParams.get('code'));
    }

    if (url.protocol === 'https:' && url.hostname === 'astapi.net' && url.pathname === INVITE_PATH) {
      return toSettingsPath(url.searchParams.get('code'));
    }

    return path;
  } catch {
    return path;
  }
}
