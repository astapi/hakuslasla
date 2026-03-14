export type InviteLinkSource = 'universal' | 'scheme';

export type InviteLinkPayload = {
  code: string | null;
  source: InviteLinkSource;
  url: string;
};

const INVITE_CODE_LENGTH = 6;
const INVITE_PATH = '/lootdive/invite';
const CUSTOM_SCHEME = 'lootdive:';

let pendingInviteLink: InviteLinkPayload | null = null;

export const sanitizeInviteCode = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, INVITE_CODE_LENGTH);
};

const isUniversalInviteLink = (url: URL): boolean => {
  return url.protocol === 'https:' && url.hostname === 'astapi.net' && url.pathname === INVITE_PATH;
};

const isSchemeInviteLink = (url: URL): boolean => {
  if (url.protocol !== CUSTOM_SCHEME) {
    return false;
  }

  return url.hostname === 'invite' || url.pathname === '/invite';
};

export const parseInviteLink = (urlString: string | null | undefined): InviteLinkPayload | null => {
  if (!urlString) return null;

  try {
    const url = new URL(urlString);
    if (!isUniversalInviteLink(url) && !isSchemeInviteLink(url)) {
      return null;
    }

    const code = sanitizeInviteCode(url.searchParams.get('code'));
    if (!code) {
      return null;
    }

    return {
      code: code || null,
      source: isUniversalInviteLink(url) ? 'universal' : 'scheme',
      url: urlString,
    };
  } catch {
    return null;
  }
};

export const setPendingInviteLink = (payload: InviteLinkPayload | null): void => {
  pendingInviteLink = payload;
};

export const consumePendingInviteLink = (): InviteLinkPayload | null => {
  const current = pendingInviteLink;
  pendingInviteLink = null;
  return current;
};
