import { getAccessToken } from './google-sa-token.mjs';

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const DRIVE_SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

function toText(value) {
  return String(value ?? '').trim();
}

export function parseDriveId(value) {
  const raw = toText(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const idParam = toText(parsed.searchParams.get('id'));
    if (idParam) return idParam;
    const foldersMatch = parsed.pathname.match(/\/folders\/([^/?#]+)/i);
    if (foldersMatch) return foldersMatch[1];
    const fileMatch = parsed.pathname.match(/\/(?:file\/d|spreadsheets\/d)\/([^/?#]+)/i);
    if (fileMatch) return fileMatch[1];
  } catch {}
  const folderMatch = raw.match(/\/folders\/([A-Za-z0-9_-]+)/i);
  if (folderMatch) return folderMatch[1];
  const fileMatch = raw.match(/\/(?:file\/d|spreadsheets\/d)\/([A-Za-z0-9_-]+)/i);
  if (fileMatch) return fileMatch[1];
  return raw;
}

export function driveFolderUrl(folderId) {
  const id = parseDriveId(folderId);
  return id ? `https://drive.google.com/drive/folders/${id}` : '';
}

export function driveFileUrl(fileId) {
  const id = parseDriveId(fileId);
  return id ? `https://drive.google.com/file/d/${id}/view` : '';
}

export function googleSheetUrl(sheetId, gid = '0') {
  const id = parseDriveId(sheetId);
  const safeGid = toText(gid) || '0';
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit?gid=${encodeURIComponent(safeGid)}#gid=${encodeURIComponent(safeGid)}` : '';
}

export function createDriveClient({
  keyPath,
  scope = 'https://www.googleapis.com/auth/drive.readonly',
} = {}) {
  let tokenPromise = null;

  const getToken = async () => {
    if (!tokenPromise) {
      tokenPromise = getAccessToken({ keyPath, scope });
    }
    return tokenPromise;
  };

  const requestJson = async (pathname, params = {}) => {
    const token = await getToken();
    const url = new URL(`https://www.googleapis.com/drive/v3/${pathname.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Drive API ${response.status}: ${await response.text()}`);
    }
    return response.json();
  };

  return {
    async getFile(fileId, {
      fields = 'id,name,mimeType,webViewLink,webContentLink,parents,size,modifiedTime,shortcutDetails',
    } = {}) {
      const id = parseDriveId(fileId);
      if (!id) throw new Error('Drive file id is required.');
      const file = await requestJson(`files/${encodeURIComponent(id)}`, {
        fields,
        supportsAllDrives: 'true',
      });
      return normalizeDriveFile(file);
    },

    async listFolder(folderId, {
      pageSize = 1000,
      fields = 'nextPageToken,files(id,name,mimeType,webViewLink,webContentLink,parents,size,modifiedTime,shortcutDetails)',
    } = {}) {
      const id = parseDriveId(folderId);
      if (!id) throw new Error('Drive folder id is required.');
      const files = [];
      let pageToken = '';
      do {
        const payload = await requestJson('files', {
          q: `'${id.replace(/'/g, "\\'")}' in parents and trashed = false`,
          fields,
          pageSize,
          pageToken,
          orderBy: 'folder,name_natural',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
        });
        files.push(...(Array.isArray(payload.files) ? payload.files.map(normalizeDriveFile) : []));
        pageToken = toText(payload.nextPageToken);
      } while (pageToken);
      return files;
    },
  };
}

function normalizeDriveFile(file = {}) {
  const mimeType = toText(file.mimeType);
  const shortcutTarget = file.shortcutDetails && typeof file.shortcutDetails === 'object'
    ? file.shortcutDetails
    : null;
  return {
    id: toText(shortcutTarget?.targetId || file.id),
    originalId: toText(file.id),
    name: toText(file.name),
    mimeType: toText(shortcutTarget?.targetMimeType || mimeType),
    originalMimeType: mimeType,
    webViewLink: toText(file.webViewLink),
    webContentLink: toText(file.webContentLink),
    parents: Array.isArray(file.parents) ? file.parents.map(toText).filter(Boolean) : [],
    size: Number(file.size || 0) || 0,
    modifiedTime: toText(file.modifiedTime),
    isShortcut: mimeType === 'application/vnd.google-apps.shortcut',
  };
}

export function isDriveFolder(file) {
  return toText(file?.mimeType) === DRIVE_FOLDER_MIME;
}

export function isDriveSpreadsheet(file) {
  const mimeType = toText(file?.mimeType);
  if (mimeType === DRIVE_SPREADSHEET_MIME) return true;
  const name = toText(file?.name).toLowerCase();
  const href = toText(file?.webViewLink).toLowerCase();
  return name.endsWith('.gsheet') || href.includes('/spreadsheets/d/');
}

export async function listDriveTree({
  rootFolderId,
  driveClient = createDriveClient(),
  maxDepth = 5,
} = {}) {
  const rootId = parseDriveId(rootFolderId);
  if (!rootId) throw new Error('rootFolderId is required.');
  const root = await driveClient.getFile(rootId);
  const files = [];
  const folders = [root];
  const queue = [{ id: rootId, depth: 0 }];
  const seenFolders = new Set([rootId]);

  while (queue.length) {
    const current = queue.shift();
    if (!current || current.depth > maxDepth) continue;
    const children = await driveClient.listFolder(current.id);
    for (const child of children) {
      files.push({
        ...child,
        parentId: current.id,
        depth: current.depth + 1,
      });
      if (isDriveFolder(child) && !seenFolders.has(child.id) && current.depth + 1 < maxDepth) {
        seenFolders.add(child.id);
        folders.push({
          ...child,
          parentId: current.id,
          depth: current.depth + 1,
        });
        queue.push({ id: child.id, depth: current.depth + 1 });
      }
    }
  }

  return {
    root: {
      ...root,
      depth: 0,
    },
    files,
    folders,
  };
}
