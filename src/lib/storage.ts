import { DEFAULT_DATA_PATH, DEFAULT_REPO, normalizeRepo, STORAGE_KEYS, STORAGE_PREFIX } from '../constants';
import type { AppSettings, StoredCredentials } from '../types';
import { validateDataPath } from './validation';

const LEGACY_KEYS = {
  settings: 'impact-factor:settings',
  data: 'impact-factor:data',
  dataCache: `${STORAGE_PREFIX}-data-cache`,
  owner: `${STORAGE_PREFIX}-owner`
} as const;

function runtimeDefaults(credentials: StoredCredentials): AppSettings {
  return {
    token: credentials.token,
    repo: normalizeRepo(credentials.repo) || DEFAULT_REPO,
    dataPath: credentials.dataPath.trim() || DEFAULT_DATA_PATH,
    defaultBranch: 'main',
    canRead: false,
    canWrite: false
  };
}

function readCredentials(): StoredCredentials {
  migrateLegacyIfNeeded();

  return {
    token: localStorage.getItem(STORAGE_KEYS.token) ?? '',
    repo: localStorage.getItem(STORAGE_KEYS.repo) ?? DEFAULT_REPO,
    dataPath: localStorage.getItem(STORAGE_KEYS.dataPath) ?? DEFAULT_DATA_PATH
  };
}

function migrateLegacyIfNeeded(): void {
  if (localStorage.getItem(STORAGE_KEYS.token) && localStorage.getItem(STORAGE_KEYS.repo)) {
    return;
  }

  const token = localStorage.getItem(STORAGE_KEYS.token) ?? '';
  const owner = localStorage.getItem(LEGACY_KEYS.owner);
  const repoName = localStorage.getItem(STORAGE_KEYS.repo);
  if (token && owner && repoName && !repoName.includes('/')) {
    writeCredentials({
      token,
      repo: `${owner}/${repoName}`,
      dataPath: localStorage.getItem(STORAGE_KEYS.dataPath) ?? DEFAULT_DATA_PATH
    });
    localStorage.removeItem(LEGACY_KEYS.owner);
    return;
  }

  const legacyRaw = localStorage.getItem(LEGACY_KEYS.settings);
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw) as {
        token?: string;
        repo?: string;
        dataPath?: string;
      };
      writeCredentials({
        token: parsed.token ?? '',
        repo: parsed.repo ?? DEFAULT_REPO,
        dataPath: parsed.dataPath ?? DEFAULT_DATA_PATH
      });
      localStorage.removeItem(LEGACY_KEYS.settings);
    } catch {
      // ignore
    }
  }
}

function cleanupLegacyStorage(): void {
  localStorage.removeItem(LEGACY_KEYS.data);
  localStorage.removeItem(LEGACY_KEYS.dataCache);
}

export function loadSettings(): AppSettings {
  cleanupLegacyStorage();
  return runtimeDefaults(readCredentials());
}

export function saveCredentials(credentials: StoredCredentials): void {
  writeCredentials(credentials);
}

function writeCredentials(credentials: StoredCredentials): void {
  localStorage.setItem(STORAGE_KEYS.token, credentials.token.trim());
  localStorage.setItem(STORAGE_KEYS.repo, normalizeRepo(credentials.repo) || DEFAULT_REPO);
  localStorage.setItem(STORAGE_KEYS.dataPath, validateDataPath(credentials.dataPath));
}

export function clearSettings(): void {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.repo);
  localStorage.removeItem(STORAGE_KEYS.dataPath);
  localStorage.removeItem(LEGACY_KEYS.owner);
  localStorage.removeItem(LEGACY_KEYS.settings);
  cleanupLegacyStorage();
}
