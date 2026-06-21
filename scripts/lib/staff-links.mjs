function toText(value) {
  return String(value || '').trim();
}

export const STAFF_LINK_GROUPS = Object.freeze([
  {
    id: 'ops',
    label: 'Worker Ops',
    aliases: ['ops', 'desk', 'queue', 'queues', 'sheet', 'sheets'],
    links: [
      {
        id: 'ops-desk',
        label: 'Dex ops desk',
        url: 'dex ops desk',
      },
      {
        id: 'ops-import',
        label: 'Sheets import dry run',
        url: 'dex ops import sheets --kind submissions --file ./exports/submissions.csv --dry-run',
      },
      {
        id: 'worker-admin',
        label: 'Worker admin API',
        url: 'https://dex-api.spring-fog-8edd.workers.dev/admin/ops/tickets',
      },
    ],
  },
  {
    id: 'repos',
    label: 'GitHub Repos',
    aliases: ['repo', 'repos', 'github'],
    links: [
      {
        id: 'site-repo',
        label: 'Site repo',
        url: 'https://github.com/dexdsl/dexdsl.github.io/',
      },
      {
        id: 'api-repo',
        label: 'API repo',
        url: 'https://github.com/dexdsl/dex-api',
      },
    ],
  },
  {
    id: 'platforms',
    label: 'Platforms',
    aliases: ['platform', 'platforms', 'billing'],
    links: [
      {
        id: 'stripe',
        label: 'Stripe dashboard',
        url: 'https://dashboard.stripe.com/login',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    aliases: ['admin', 'ops'],
    links: [
      {
        id: 'cloudflare',
        label: 'Cloudflare',
        url: 'https://dash.cloudflare.com/',
      },
      {
        id: 'google-admin',
        label: 'Google Admin',
        url: 'https://admin.google.com/',
      },
      {
        id: 'auth0',
        label: 'Auth0',
        url: 'https://manage.auth0.com/',
      },
    ],
  },
  {
    id: 'site',
    label: 'Site',
    aliases: ['site', 'status', 'directory'],
    links: [
      {
        id: 'directory-prod',
        label: 'Directory (prod)',
        url: 'https://dexdsl.org/',
      },
      {
        id: 'directory-gh',
        label: 'Directory (GitHub Pages)',
        url: 'https://dexdsl.github.io/',
      },
      {
        id: 'status',
        label: 'Status',
        url: 'https://dexdsl.github.io/status/',
      },
    ],
  },
]);

export function normalizeLinkToken(value) {
  return toText(value).toLowerCase();
}

function matchesGroupToken(group, token) {
  if (!token) return true;
  if (group.id === token) return true;
  if (normalizeLinkToken(group.label) === token) return true;
  if (Array.isArray(group.aliases) && group.aliases.some((alias) => normalizeLinkToken(alias) === token)) return true;
  return false;
}

export function listStaffLinkGroups(groupToken = '') {
  const token = normalizeLinkToken(groupToken);
  if (!token) return STAFF_LINK_GROUPS;
  return STAFF_LINK_GROUPS.filter((group) => matchesGroupToken(group, token));
}

export function flattenStaffLinks(groups = STAFF_LINK_GROUPS) {
  const out = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const link of Array.isArray(group.links) ? group.links : []) {
      out.push({
        ...link,
        groupId: group.id,
        groupLabel: group.label,
      });
    }
  }
  return out;
}
