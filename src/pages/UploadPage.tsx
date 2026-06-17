import { Link, useNavigate } from 'react-router-dom';
import { FileUpload } from '../components/FileUpload';
import { useApp } from '../context/AppContext';

export function UploadPage() {
  const { configured, uploadFiles, uploading, syncing, files, settings } = useApp();
  const navigate = useNavigate();
  const busy = uploading || syncing;

  async function handleUpload(uploaded: File[]) {
    await uploadFiles(uploaded);
    navigate('/');
  }

  if (!configured) {
    return (
      <div className="page page--center">
        <div className="empty-state">
          <div className="empty-state__icon">📤</div>
          <h2>上传数据</h2>
          <p>上传前需先配置 Token。</p>
          <Link to="/settings" className="btn btn--primary">
            前往设置
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--upload">
      <div className="upload-card">
        <div className="upload-card__head">
          <div className="upload-card__icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1>上传数据</h1>
            <p>
              直接上传至 <strong>{settings.repo}</strong> 的 <code>{settings.dataPath}/</code> 目录
            </p>
          </div>
        </div>

        <div className="upload-card__formats">
          <span className="format-tag">CSV</span>
          <span className="format-tag">XLSX</span>
          <span className="format-tag">XLS</span>
        </div>

        <FileUpload onUpload={handleUpload} uploading={busy} compact />

        {busy ? (
          <p className="upload-card__sync">
            {syncing ? '正在上传至 GitHub…' : '正在解析文件…'}
          </p>
        ) : null}

        {files.length > 0 ? (
          <div className="upload-card__existing">
            <div className="upload-card__existing-head">
              <h3>当前已有 {files.length} 个文件</h3>
              <Link to="/">查看数据 →</Link>
            </div>
            <ul>
              {files.map((f) => (
                <li key={f.fileName}>
                  <span className="file-dot" />
                  <span className="file-name">{f.title}</span>
                  <span className="muted">{(f.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="upload-card__tip">上传后将保存为仓库中的 CSV / XLSX 明文文件。</div>
        )}
      </div>
    </div>
  );
}
