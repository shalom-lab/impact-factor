import { Octokit } from '@octokit/rest';
import { decodeBase64ToBuffer, decodeBase64Utf8 } from './encoding';
import { assertFileSize, repoFilePath, sanitizeFileName, validateDataPath, validateFileName } from './validation';

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

function createOctokit(token: string) {
  return new Octokit({ auth: token });
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
  const dir = validateDataPath(dataPath);
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

/**
 * 读取仓库文件内容。
 * GitHub Contents API：≤1MB 才在 JSON 里返回 base64 content；
 * 1–100MB 需用 Git Blob API / raw 媒体类型，否则 content 为空字符串。
 */
export async function fetchRepoSpreadsheetContent(
  token: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<{ fileName: string; text?: string; buffer?: ArrayBuffer; size: number }> {
  const [owner, repoName] = repo.split('/');
  const octokit = createOctokit(token);
  const fileName = filePath.split('/').pop() ?? filePath;

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo: repoName,
    path: filePath,
    ref: branch
  });

  if (Array.isArray(data) || data.type !== 'file') {
    throw new Error(`无法读取文件: ${filePath}`);
  }

  const size = data.size ?? 0;
  assertFileSize(size, fileName);

  if (size <= 0) {
    throw new Error(`文件为空: ${fileName}`);
  }

  const hasInlineBase64 =
    'content' in data &&
    typeof data.content === 'string' &&
    data.content.length > 0 &&
    data.encoding === 'base64';

  let base64: string;
  if (hasInlineBase64) {
    base64 = data.content;
  } else {
    // >1MB：Contents JSON 的 content 为空，改用 Blob API
    const blob = await octokit.rest.git.getBlob({
      owner,
      repo: repoName,
      file_sha: data.sha
    });
    if (!blob.data.content) {
      throw new Error(`无法获取大文件内容（${(size / 1024 / 1024).toFixed(1)}MB）: ${fileName}`);
    }
    base64 = blob.data.content;
  }

  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) {
    return { fileName, text: decodeBase64Utf8(base64), size };
  }

  const buffer = decodeBase64ToBuffer(base64);
  if (!buffer.byteLength) {
    throw new Error(`文件解码后为空: ${fileName}`);
  }

  return { fileName, buffer, size };
}

async function fetchFileSha(
  token: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | undefined> {
  const [owner, repoName] = repo.split('/');
  const octokit = createOctokit(token);
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path,
      ref: branch
    });
    if (!Array.isArray(data) && data.type === 'file' && 'sha' in data) {
      return data.sha;
    }
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error?.status === 404) return undefined;
    throw err;
  }
  return undefined;
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
  const safeName = sanitizeFileName(file.name);
  const path = repoFilePath(dataPath, safeName);
  const octokit = createOctokit(token);

  assertFileSize(file.size, safeName);

  const lower = safeName.toLowerCase();
  const content = lower.endsWith('.csv')
    ? encodeTextToBase64(await file.text())
    : encodeBufferToBase64(await file.arrayBuffer());

  async function commit(currentSha?: string) {
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path,
      message: `Upload ${safeName} via SheetView`,
      content,
      branch,
      ...(currentSha ? { sha: currentSha } : {})
    });
    return data.content?.sha ?? '';
  }

  try {
    return await commit(sha);
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error?.status === 409) {
      const freshSha = await fetchFileSha(token, repo, branch, path);
      return commit(freshSha);
    }
    throw err;
  }
}

export async function deleteRepoSpreadsheet(
  token: string,
  repo: string,
  branch: string,
  dataPath: string,
  fileName: string,
  sha?: string
): Promise<void> {
  const [owner, repoName] = repo.split('/');
  const path = repoFilePath(dataPath, validateFileName(fileName));
  const octokit = createOctokit(token);

  let fileSha = sha;
  if (!fileSha) {
    fileSha = await fetchFileSha(token, repo, branch, path);
    if (!fileSha) throw new Error(`文件不存在: ${fileName}`);
  }

  await octokit.rest.repos.deleteFile({
    owner,
    repo: repoName,
    path,
    message: `Delete ${fileName} via SheetView`,
    sha: fileSha,
    branch
  });
}
