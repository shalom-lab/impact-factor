import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { FileList } from './components/FileList';
import { DataTable } from './components/DataTable';
import type { CsvFileMeta, DataManifest } from './types';
import './App.css';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function App() {
  const [manifest, setManifest] = useState<DataManifest | null>(null);
  const [selectedFile, setSelectedFile] = useState<CsvFileMeta | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchManifest() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data-manifest.json?ts=${Date.now()}`);
        if (!response.ok) throw new Error('无法获取数据索引');
        const data = (await response.json()) as DataManifest;
        setManifest(data);
      } catch (error) {
        setErrorMessage((error as Error).message);
      }
    }
    fetchManifest();
  }, []);

  useEffect(() => {
    if (!selectedFile) return;

    let isCancelled = false;
    setLoadState('loading');
    setErrorMessage(null);

    fetch(`${import.meta.env.BASE_URL}${selectedFile.relativePath}?ts=${Date.now()}`)
      .then((response) => {
        if (!response.ok) throw new Error('无法加载 CSV 文件');
        return response.text();
      })
      .then((text) => {
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true
        });
        if (parsed.errors.length) {
          throw new Error(parsed.errors[0].message);
        }
        if (!isCancelled) {
          setRows(parsed.data);
          setLoadState('ready');
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage((error as Error).message);
          setRows([]);
          setLoadState('error');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedFile]);

  const infoPanel = useMemo(() => {
    if (!selectedFile) return null;
    return (
      <div className="file-meta">
        <h3>{selectedFile.title}</h3>
        <dl>
          <div>
            <dt>原始文件</dt>
            <dd>{selectedFile.fileName}</dd>
          </div>
          <div>
            <dt>最后更新时间</dt>
            <dd>{new Date(selectedFile.lastModified).toLocaleString()}</dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{(selectedFile.size / 1024).toFixed(1)} KB</dd>
          </div>
        </dl>
      </div>
    );
  }, [selectedFile]);

  return (
    <div className="app-shell">
      <aside>
        <header>
          <h1>Impact Factor Data</h1>
          <p>自动扫描 /data 目录，实时展示 CSV 数据集。</p>
        </header>
        <FileList files={manifest?.files ?? []} selectedFile={selectedFile} onSelect={setSelectedFile} />
      </aside>
      <main>
        {infoPanel}
        {errorMessage ? <div className="error">{errorMessage}</div> : null}
        {loadState === 'loading' ? <div className="loading">数据加载中…</div> : null}
        <DataTable rows={rows} />
      </main>
    </div>
  );
}

