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
    settings
  } = useApp();

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
              <h3>{selectedFile.title}</h3>
              <span className="file-meta__badge">{selectedFile.fileName}</span>
            </div>
            <div className="file-meta__stats">
              <span>{new Date(selectedFile.lastModified).toLocaleString()}</span>
              <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              <span>{rows.length} 行</span>
            </div>
          </div>
        ) : null}

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
