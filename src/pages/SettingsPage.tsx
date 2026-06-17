import { useEffect, useState } from 'react';
import { DEFAULT_DATA_PATH, DEFAULT_REPO } from '../constants';
import { useApp } from '../context/AppContext';

export function SettingsPage() {
  const { settings, saveAndVerifySettings, clearAllSettings } = useApp();
  const [repo, setRepo] = useState(settings.repo || DEFAULT_REPO);
  const [dataPath, setDataPath] = useState(settings.dataPath || DEFAULT_DATA_PATH);
  const [token, setToken] = useState(settings.token);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const isActive = Boolean(settings.token?.trim());

  useEffect(() => {
    setRepo(settings.repo || DEFAULT_REPO);
    setDataPath(settings.dataPath || DEFAULT_DATA_PATH);
    setToken(settings.token);
  }, [settings.repo, settings.dataPath, settings.token]);

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setWarning(null);
    setSaving(true);
    try {
      const { settings: saved, loadWarnings } = await saveAndVerifySettings({ repo, dataPath, token });
      setSuccess(
        `保存成功 · 分支 ${saved.defaultBranch} · ${saved.canWrite ? '可读写' : '只读'}`
      );
      if (loadWarnings.length) {
        setWarning(`部分数据文件未加载：${loadWarnings.join('；')}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    clearAllSettings();
    setRepo(DEFAULT_REPO);
    setDataPath(DEFAULT_DATA_PATH);
    setToken('');
    setError(null);
    setSuccess('已清除配置');
    setWarning(null);
  }

  return (
    <div className="page page--settings">
      <div className="settings-card">
        <div className="settings-card__head">
          <div className="settings-card__icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </div>
          <div>
            <h1>连接设置</h1>
            <p>GitHub 仓库与访问凭证</p>
          </div>
        </div>

        {isActive ? (
          <div className="settings-card__status">
            <span className="status-dot status-dot--ok" />
            <div className="settings-card__status-text">
              <strong>{settings.repo}</strong>
              <span>
                {settings.dataPath} · {settings.defaultBranch} · {settings.canWrite ? '读写' : '只读'}
              </span>
            </div>
          </div>
        ) : null}

        <div className="settings-card__form">
          <label className="form-field">
            <span>仓库地址</span>
            <input
              type="text"
              placeholder="owner/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="form-field">
            <span>数据路径</span>
            <input
              type="text"
              placeholder="data"
              value={dataPath}
              onChange={(e) => setDataPath(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="form-field">
            <span>GitHub Token</span>
            <input
              type="password"
              placeholder="ghp_… 或 github_pat_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        {error ? <div className="alert alert--error">{error}</div> : null}
        {warning ? <div className="alert alert--info">{warning}</div> : null}
        {success ? <div className="alert alert--success">{success}</div> : null}

        <div className="settings-card__foot">
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? '验证并保存…' : '保存并验证'}
          </button>
          {isActive ? (
            <button type="button" className="btn btn--ghost" onClick={handleClear}>
              清除
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
