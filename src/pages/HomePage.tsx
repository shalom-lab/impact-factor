import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileList } from '../components/FileList';
import { DataTable } from '../components/DataTable';
import { useApp } from '../context/AppContext';

export function HomePage() {
  const {
    files,
    selectedFile,
    setSelectedFile,
    rows,
    loadState,
    errorMessage,
    infoMessage,
    verifying,
    configured,
    refreshData,
    settings,
    downloadFile,
    deleteFile,
    fileAction
  } = useApp();
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDownload() {
    if (!selectedFile) return;
    setActionError(null);
    try {
      await downloadFile(selectedFile.fileName);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!selectedFile) return;
    const name = selectedFile.fileName;
    if (!window.confirm(`确定从仓库删除「${name}」吗？此操作不可撤销。`)) return;

    setActionError(null);
    try {
      await deleteFile(name);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  if (!configured) {
    return (
      <div className="page page--center">
        <div className="empty-state">
          <div className="empty-state__icon">🔐</div>
          <h2>欢迎使用 SheetView</h2>
          <p>请先配置 GitHub 仓库与 Token，即可加载数据。</p>
          <Link to="/settings" className="btn btn--primary">
            前往设置
          </Link>
        </div>
      </div>
    );
  }

  const busy = fileAction !== null;

  return (
    <div className="page page--home">
      <aside className="home-sidebar">
        <div className="panel-head">
          <h2>数据文件</h2>
          <button type="button" className="btn-icon" onClick={refreshData} disabled={verifying} title="刷新">
            ↻
          </button>
        </div>
        <FileList files={files} selectedFile={selectedFile} onSelect={setSelectedFile} />
      </aside>

      <section className="home-main">
        {selectedFile ? (
          <div className="file-meta file-meta--compact">
            <div className="file-meta__row">
              <div className="file-meta__title">
                <h3>{selectedFile.title}</h3>
                <span className="file-meta__badge">{selectedFile.fileName}</span>
              </div>
              <div className="file-meta__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleDownload}
                  disabled={busy}
                >
                  {fileAction === 'download' ? '下载中…' : '下载'}
                </button>
                {settings.canWrite ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={handleDelete}
                    disabled={busy}
                  >
                    {fileAction === 'delete' ? '删除中…' : '删除'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="file-meta__stats">
              <span>{new Date(selectedFile.lastModified).toLocaleString()}</span>
              <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              <span>{rows.length} 行</span>
            </div>
          </div>
        ) : null}

        {actionError ? <div className="alert alert--error">{actionError}</div> : null}
        {errorMessage ? <div className="alert alert--error">{errorMessage}</div> : null}
        {infoMessage ? <div className="alert alert--info">{infoMessage}</div> : null}
        {loadState === 'loading' || verifying ? (
          <div className="alert alert--info">数据加载中…</div>
        ) : null}

        {!files.length && !verifying && !errorMessage ? (
          <div className="alert alert--info">
            仓库 <code>{settings.dataPath}/</code> 暂无数据，请{' '}
            <Link to="/upload">上传 CSV / XLSX</Link>。
          </div>
        ) : null}

        <DataTable rows={rows} />
      </section>
    </div>
  );
}
