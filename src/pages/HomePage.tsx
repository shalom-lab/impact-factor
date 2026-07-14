import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DismissibleAlert } from '../components/DismissibleAlert';
import { FileList } from '../components/FileList';
import { SheetViewer } from '../components/SheetViewer';
import { useApp } from '../context/AppContext';

export function HomePage() {
  const {
    files,
    selectedFile,
    setSelectedFile,
    sheets,
    loadState,
    errorMessage,
    infoMessage,
    verifying,
    configured,
    refreshData,
    settings,
    downloadFile,
    deleteFile,
    dismissError,
    dismissInfo,
    fileAction
  } = useApp();
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function handleDownload() {
    if (!selectedFile) return;
    setActionError(null);
    try {
      await downloadFile(selectedFile.fileName);
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  function requestDelete(fileName: string) {
    setDeleteTarget(fileName);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteFile(deleteTarget);
      setDeleteTarget(null);
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
        <FileList
          files={files}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
          canDelete={settings.canWrite}
          deleteDisabled={busy}
          onDelete={(file) => requestDelete(file.fileName)}
        />
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
                    onClick={() => requestDelete(selectedFile.fileName)}
                    disabled={busy}
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </div>
            <div className="file-meta__stats">
              <span>{new Date(selectedFile.lastModified).toLocaleString()}</span>
              <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              <span>{selectedFile.sheetCount} 个工作表</span>
              <span>{selectedFile.rowCount.toLocaleString()} 行</span>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <DismissibleAlert variant="error" onDismiss={() => setActionError(null)}>
            {actionError}
          </DismissibleAlert>
        ) : null}
        {errorMessage ? (
          <DismissibleAlert variant="error" onDismiss={dismissError}>
            {errorMessage}
          </DismissibleAlert>
        ) : null}
        {infoMessage ? (
          <DismissibleAlert variant="info" onDismiss={dismissInfo}>
            {infoMessage}
          </DismissibleAlert>
        ) : null}
        {loadState === 'loading' || verifying ? (
          <div className="alert alert--info">数据加载中…</div>
        ) : null}

        {!files.length && !verifying && !errorMessage ? (
          <div className="alert alert--info">
            仓库 <code>{settings.dataPath}/</code> 暂无数据，请{' '}
            <Link to="/upload">上传 CSV / XLSX</Link>。
          </div>
        ) : null}

        {sheets.length ? (
          <SheetViewer key={selectedFile?.fileName ?? 'none'} fileKey={selectedFile?.fileName ?? 'none'} sheets={sheets} />
        ) : (
          <p className="empty-hint">选择左侧文件，或前往上传页面添加数据。</p>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={`确定从仓库删除「${deleteTarget ?? ''}」吗？此操作不可撤销，文件将从 GitHub 仓库中永久移除。`}
        confirmLabel="删除"
        cancelLabel="取消"
        variant="danger"
        loading={fileAction === 'delete'}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (fileAction !== 'delete') setDeleteTarget(null);
        }}
      />
    </div>
  );
}
