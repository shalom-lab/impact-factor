import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { DEFAULT_DATA_PATH, normalizeRepo } from '../constants';
import { pushSpreadsheetToRepo, verifyGitHubAccessSimple } from '../lib/github';
import { loadDataFromGitHub } from '../lib/loadData';
import { parseUploadedFile } from '../lib/parseData';
import { clearSettings, loadSettings, saveCredentials } from '../lib/storage';
import { validateDataPath } from '../lib/validation';
import type { AppSettings, CsvFileMeta, StoredCredentials, StoredFileEntry } from '../types';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type AppContextValue = {
  settings: AppSettings;
  files: CsvFileMeta[];
  selectedFile: CsvFileMeta | null;
  rows: Record<string, unknown>[];
  loadState: LoadState;
  errorMessage: string | null;
  infoMessage: string | null;
  verifying: boolean;
  uploading: boolean;
  syncing: boolean;
  configured: boolean;
  setSelectedFile: (file: CsvFileMeta | null) => void;
  saveAndVerifySettings: (draft: StoredCredentials) => Promise<{
    settings: AppSettings;
    loadWarnings: string[];
  }>;
  clearAllSettings: () => void;
  uploadFiles: (files: File[]) => Promise<void>;
  refreshData: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function entryToMeta(entry: StoredFileEntry): CsvFileMeta {
  const size = new Blob([JSON.stringify(entry.rows)]).size;
  return {
    fileName: entry.fileName,
    title: entry.title,
    size,
    lastModified: entry.uploadedAt
  };
}

function withVerifiedAccess(
  credentials: StoredCredentials,
  access: Awaited<ReturnType<typeof verifyGitHubAccessSimple>>
): AppSettings {
  return {
    token: credentials.token.trim(),
    repo: normalizeRepo(credentials.repo),
    dataPath: credentials.dataPath.trim() || DEFAULT_DATA_PATH,
    defaultBranch: access.defaultBranch,
    canRead: access.canRead,
    canWrite: access.canWrite
  };
}

function resolveSelection(
  files: StoredFileEntry[],
  prev: CsvFileMeta | null
): CsvFileMeta | null {
  if (files.length === 0) return null;
  if (files.length === 1) return entryToMeta(files[0]);
  if (prev && files.some((f) => f.fileName === prev.fileName)) return prev;
  return null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [localFiles, setLocalFiles] = useState<StoredFileEntry[]>([]);
  const [fileShas, setFileShas] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<CsvFileMeta | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const loadRequestId = useRef(0);

  const configured = Boolean(settings.token?.trim() && settings.repo?.trim());
  const files = useMemo(() => localFiles.map(entryToMeta), [localFiles]);

  const applyLoadResult = useCallback(
    (result: Awaited<ReturnType<typeof loadDataFromGitHub>>, requestId: number) => {
      if (requestId !== loadRequestId.current) return;

      setLocalFiles(result.files);
      setFileShas(result.fileShas);
      setSelectedFile((prev) => resolveSelection(result.files, prev));

      if (result.loadErrors.length && result.files.length === 0) {
        setErrorMessage(result.loadErrors.join('；'));
        setInfoMessage(result.hint ?? null);
      } else if (result.loadErrors.length) {
        setErrorMessage(null);
        setInfoMessage(`部分文件加载失败：${result.loadErrors.join('；')}`);
      } else {
        setErrorMessage(null);
        setInfoMessage(result.hint ?? null);
      }
    },
    []
  );

  const loadAllData = useCallback(
    async (cfg: AppSettings) => {
      const requestId = ++loadRequestId.current;
      const result = await loadDataFromGitHub(cfg);
      applyLoadResult(result, requestId);
      return result;
    },
    [applyLoadResult]
  );

  const refreshData = useCallback(async () => {
    if (!settings.token?.trim()) return;
    setVerifying(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const access = await verifyGitHubAccessSimple(settings.repo, settings.token);
      if (!access.canRead) throw new Error('Token 无法读取该仓库');

      const updated = withVerifiedAccess(settings, access);
      setSettings(updated);
      await loadAllData(updated);
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }, [settings, loadAllData]);

  useEffect(() => {
    async function init() {
      const cfg = loadSettings();
      if (!cfg.token?.trim()) return;

      setVerifying(true);
      setLoadState('loading');
      try {
        const access = await verifyGitHubAccessSimple(cfg.repo, cfg.token);
        if (!access.canRead) throw new Error('Token 无法读取该仓库');

        const updated = withVerifiedAccess(cfg, access);
        setSettings(updated);
        await loadAllData(updated);
        setLoadState('ready');
      } catch (err) {
        setErrorMessage((err as Error).message);
        setLoadState('error');
      } finally {
        setVerifying(false);
      }
    }
    init();
  }, [loadAllData]);

  useEffect(() => {
    if (!selectedFile) {
      setRows([]);
      setLoadState(localFiles.length ? 'ready' : 'idle');
      return;
    }

    const entry = localFiles.find((f) => f.fileName === selectedFile.fileName);
    if (entry) {
      setRows(entry.rows);
      setLoadState('ready');
    } else {
      setRows([]);
      setSelectedFile(null);
      setLoadState(localFiles.length ? 'ready' : 'idle');
    }
  }, [selectedFile, localFiles]);

  const saveAndVerifySettings = useCallback(
    async (draft: StoredCredentials) => {
      const credentials: StoredCredentials = {
        token: draft.token.trim(),
        repo: normalizeRepo(draft.repo),
        dataPath: validateDataPath(draft.dataPath)
      };

      if (!credentials.repo || !credentials.repo.includes('/')) {
        throw new Error('仓库格式应为 owner/repo');
      }
      if (!credentials.token) throw new Error('请填写 GitHub Token');

      const access = await verifyGitHubAccessSimple(credentials.repo, credentials.token);
      if (!access.canRead) throw new Error('Token 无法读取该仓库');

      saveCredentials(credentials);
      const newSettings = withVerifiedAccess(credentials, access);
      setSettings(newSettings);
      setErrorMessage(null);
      setInfoMessage(null);
      setLoadState('loading');

      const loadResult = await loadAllData(newSettings);
      setLoadState('ready');

      return { settings: newSettings, loadWarnings: loadResult.loadErrors };
    },
    [loadAllData]
  );

  const clearAllSettings = useCallback(() => {
    clearSettings();
    setSettings(loadSettings());
    setLocalFiles([]);
    setFileShas({});
    setSelectedFile(null);
    setRows([]);
    setErrorMessage(null);
    setInfoMessage(null);
  }, []);

  const uploadFiles = useCallback(
    async (fileList: File[]) => {
      if (!settings.token?.trim()) {
        throw new Error('请先在设置页配置 Token');
      }
      if (!settings.canWrite) {
        throw new Error('Token 无写入权限，无法上传');
      }

      setUploading(true);
      setErrorMessage(null);

      const parsed = await Promise.all(fileList.map(parseUploadedFile));
      const now = new Date().toISOString();
      const successes: StoredFileEntry[] = [];
      const newShas = { ...fileShas };
      const uploadErrors: string[] = [];
      const renames: string[] = [];

      setSyncing(true);
      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const parsedFile = parsed[i];
          if (parsedFile.originalFileName) {
            renames.push(`${parsedFile.originalFileName} → ${parsedFile.fileName}`);
          }
          try {
            const sha = await pushSpreadsheetToRepo(
              settings.token,
              settings.repo,
              settings.defaultBranch,
              settings.dataPath,
              file,
              newShas[parsedFile.fileName]
            );
            if (sha) newShas[parsedFile.fileName] = sha;
            successes.push({
              fileName: parsedFile.fileName,
              title: parsedFile.title,
              uploadedAt: now,
              rows: parsedFile.rows
            });
          } catch (err) {
            uploadErrors.push(`${parsedFile.fileName}: ${(err as Error).message}`);
          }
        }
      } finally {
        setSyncing(false);
        setUploading(false);
      }

      if (!successes.length) {
        throw new Error(uploadErrors.join('；'));
      }

      const mergedMap = new Map(localFiles.map((f) => [f.fileName, f]));
      for (const entry of successes) {
        mergedMap.set(entry.fileName, entry);
      }
      const merged = Array.from(mergedMap.values());
      setLocalFiles(merged);
      setFileShas(newShas);

      const last = successes[successes.length - 1];
      setSelectedFile(entryToMeta(last));

      const parts: string[] = [];
      if (renames.length) parts.push(`文件名已自动清理：${renames.join('；')}`);
      if (uploadErrors.length) parts.push(`部分文件上传失败：${uploadErrors.join('；')}`);
      setInfoMessage(parts.length ? parts.join(' ') : null);
    },
    [settings, localFiles, fileShas]
  );

  const value: AppContextValue = {
    settings,
    files,
    selectedFile,
    rows,
    loadState,
    errorMessage,
    infoMessage,
    verifying,
    uploading,
    syncing,
    configured,
    setSelectedFile,
    saveAndVerifySettings,
    clearAllSettings,
    uploadFiles,
    refreshData
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
