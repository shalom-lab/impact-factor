import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { normalizeRepo } from '../constants';
import { pushSpreadsheetToRepo, verifyGitHubAccessSimple } from '../lib/github';
import { loadDataFromGitHub } from '../lib/loadData';
import { parseUploadedFile } from '../lib/parseData';
import { clearSettings, loadSettings, saveCredentials } from '../lib/storage';
import type { AppSettings, CsvFileMeta, StoredCredentials, StoredFileEntry } from '../types';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type AppContextValue = {
  settings: AppSettings;
  files: CsvFileMeta[];
  localFiles: StoredFileEntry[];
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
  setErrorMessage: (msg: string | null) => void;
  saveAndVerifySettings: (draft: StoredCredentials) => Promise<AppSettings>;
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
    relativePath: `local://${entry.fileName}`,
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
    dataPath: credentials.dataPath.trim(),
    defaultBranch: access.defaultBranch,
    canRead: access.canRead,
    canWrite: access.canWrite
  };
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

  const configured = Boolean(settings.token?.trim() && settings.repo?.trim());
  const files = useMemo(() => localFiles.map(entryToMeta), [localFiles]);

  const applyLoadResult = useCallback((result: Awaited<ReturnType<typeof loadDataFromGitHub>>) => {
    setLocalFiles(result.files);
    setFileShas(result.fileShas);

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

    if (result.files.length === 1) {
      setSelectedFile(entryToMeta(result.files[0]));
    } else if (result.files.length === 0) {
      setSelectedFile(null);
    }
  }, []);

  const loadAllData = useCallback(
    async (cfg: AppSettings) => {
      const result = await loadDataFromGitHub(cfg);
      applyLoadResult(result);
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
        const updated = withVerifiedAccess(cfg, access);
        setSettings(updated);
        await loadAllData(updated);
        setLoadState('ready');
      } catch (err) {
        setErrorMessage(`Token 已失效: ${(err as Error).message}`);
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
    }
  }, [selectedFile, localFiles]);

  const saveAndVerifySettings = useCallback(
    async (draft: StoredCredentials): Promise<AppSettings> => {
      const credentials: StoredCredentials = {
        token: draft.token.trim(),
        repo: normalizeRepo(draft.repo),
        dataPath: draft.dataPath.trim()
      };

      if (!credentials.repo || !credentials.repo.includes('/')) {
        throw new Error('仓库格式应为 owner/repo');
      }
      if (!credentials.dataPath) throw new Error('请填写数据路径');
      if (!credentials.token) throw new Error('请填写 GitHub Token');

      const access = await verifyGitHubAccessSimple(credentials.repo, credentials.token);
      if (!access.canRead) throw new Error('Token 无法读取该仓库');

      saveCredentials(credentials);
      const newSettings = withVerifiedAccess(credentials, access);
      setSettings(newSettings);
      setErrorMessage(null);
      setInfoMessage(null);
      setLoadState('loading');
      await loadAllData(newSettings);
      setLoadState('ready');
      return newSettings;
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

      try {
        const parsed = await Promise.all(fileList.map(parseUploadedFile));
        const now = new Date().toISOString();
        const newShas = { ...fileShas };

        setSyncing(true);
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const sha = await pushSpreadsheetToRepo(
            settings.token,
            settings.repo,
            settings.defaultBranch,
            settings.dataPath,
            file,
            fileShas[file.name]
          );
          if (sha) newShas[file.name] = sha;
        }
        setSyncing(false);

        const newEntries: StoredFileEntry[] = parsed.map((p) => ({
          fileName: p.fileName,
          title: p.title,
          uploadedAt: now,
          rows: p.rows
        }));

        const mergedMap = new Map(localFiles.map((f) => [f.fileName, f]));
        for (const entry of newEntries) {
          mergedMap.set(entry.fileName, entry);
        }
        const merged = Array.from(mergedMap.values());
        setLocalFiles(merged);
        setFileShas(newShas);
        setInfoMessage(null);

        const last = newEntries[newEntries.length - 1];
        setSelectedFile(entryToMeta(last));
      } finally {
        setUploading(false);
        setSyncing(false);
      }
    },
    [settings, localFiles, fileShas]
  );

  const value: AppContextValue = {
    settings,
    files,
    localFiles,
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
    setErrorMessage,
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
