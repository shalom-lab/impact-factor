import { Octokit } from '@octokit/rest';

export async function verifyGitHubAccessSimple(
  repo: string,
  token: string
): Promise<{ defaultBranch: string; canRead: boolean; canWrite: boolean }> {
  const parts = String(repo)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length !== 2) throw new Error('仓库格式错误，应为 "owner/repo"');

  const [owner, repoName] = parts;
  if (!token || !token.trim()) throw new Error('缺少 token');

  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
    const defaultBranch = data.default_branch ?? 'main';

    if (data.permissions) {
      return {
        defaultBranch,
        canRead: Boolean(data.permissions.pull),
        canWrite: Boolean(data.permissions.push || data.permissions.admin)
      };
    }

    let canRead = false;
    try {
      await octokit.rest.repos.listBranches({ owner, repo: repoName, per_page: 1 });
      canRead = true;
    } catch {
      canRead = false;
    }

    let canWrite = false;
    try {
      const me = await octokit.rest.users.getAuthenticated();
      const username = me.data.login;
      if (username) {
        const perm = await octokit.rest.repos.getCollaboratorPermissionLevel({
          owner,
          repo: repoName,
          username
        });
        const level = perm.data.permission;
        canWrite = level === 'admin' || level === 'write';
      }
    } catch {
      canWrite = false;
    }

    return { defaultBranch, canRead, canWrite };
  } catch (err: unknown) {
    const error = err as { status?: number; response?: { status?: number }; message?: string };
    const status = error?.status || error?.response?.status;
    if (status === 401) throw new Error('Token 无效或已过期（401）');
    if (status === 403)
      throw new Error('Token 权限不足或被禁止（403）。对于细粒度 token，请检查是否为该仓库授权。');
    if (status === 404) throw new Error('仓库不存在或 Token 未被授权访问该仓库（404）');
    throw new Error(`验证失败: ${error?.message ?? '未知错误'}`);
  }
}

export function createOctokit(token: string) {
  return new Octokit({ auth: token });
}

function normalizeDir(dataPath: string): string {
  return dataPath.trim().replace(/^\/+/, '').replace(/\/+$/, '') || 'data';
}

function decodeBase64Content(content: string): string {
  return atob(content.replace(/\n/g, ''));
}

function decodeBase64ToBuffer(content: string): ArrayBuffer {
  const binary = decodeBase64Content(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function encodeTextToBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export type RepoSpreadsheetMeta = {
  fileName: string;
  path: string;
  size: number;
  sha: string;
};

export async function listRepoSpreadsheets(
  token: string,
  repo: string,
  branch: string,
  dataPath: string
): Promise<RepoSpreadsheetMeta[]> {
  const [owner, repoName] = repo.split('/');
  const dir = normalizeDir(dataPath);
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path: dir,
      ref: branch
    });

    if (!Array.isArray(data)) return [];

    return data
      .filter(
        (item) =>
          item.type === 'file' &&
          /\.(csv|xlsx|xls)$/i.test(item.name) &&
          !item.name.startsWith('.')
      )
      .map((item) => ({
        fileName: item.name,
        path: item.path,
        size: item.size ?? 0,
        sha: item.sha ?? ''
      }));
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error?.status === 404) return [];
    throw err;
  }
}

export async function fetchRepoSpreadsheetContent(
  token: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<{ fileName: string; text?: string; buffer?: ArrayBuffer }> {
  const [owner, repoName] = repo.split('/');
  const octokit = createOctokit(token);
  const fileName = filePath.split('/').pop() ?? filePath;

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo: repoName,
    path: filePath,
    ref: branch
  });

  if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
    throw new Error(`无法读取文件: ${filePath}`);
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) {
    return { fileName, text: decodeBase64Content(data.content) };
  }

  return { fileName, buffer: decodeBase64ToBuffer(data.content) };
}

export async function pushSpreadsheetToRepo(
  token: string,
  repo: string,
  branch: string,
  dataPath: string,
  file: File,
  sha?: string
): Promise<string> {
  const [owner, repoName] = repo.split('/');
  const path = `${normalizeDir(dataPath)}/${file.name}`;
  const octokit = createOctokit(token);
  const lower = file.name.toLowerCase();

  const content = lower.endsWith('.csv')
    ? encodeTextToBase64(await file.text())
    : encodeBufferToBase64(await file.arrayBuffer());

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path,
    message: `Upload ${file.name} via SheetView`,
    content,
    branch,
    ...(sha ? { sha } : {})
  });

  return data.content?.sha ?? '';
}
