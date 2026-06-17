export const DEFAULT_REPO = 'shalom-lab/impact-factor';
export const DEFAULT_DATA_PATH = 'data';

/** localStorage 键前缀，可按部署站点修改（如 gh-bookhub） */
export const STORAGE_PREFIX = 'gh-sheetview';

export const STORAGE_KEYS = {
  token: `${STORAGE_PREFIX}-token`,
  repo: `${STORAGE_PREFIX}-repo`,
  dataPath: `${STORAGE_PREFIX}-data-path`
} as const;

export function normalizeRepo(repo: string): string {
  return repo.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export function repoUrl(repo: string): string {
  return `https://github.com/${normalizeRepo(repo)}`;
}
