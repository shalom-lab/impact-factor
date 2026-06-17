import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { GitHubIcon } from '../components/GitHubIcon';
import { repoUrl } from '../constants';
import { useApp } from '../context/AppContext';

const NAV = [
  { to: '/', label: '数据', end: true },
  { to: '/upload', label: '上传', end: false },
  { to: '/settings', label: '设置', end: false }
] as const;

export function AppLayout() {
  const { settings, configured, verifying } = useApp();

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">SV</span>
          <div>
            <strong>SheetView</strong>
            <span className="topbar__tagline">表格数据浏览</span>
          </div>
        </div>

        <nav className="topbar__nav">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx('topbar__link', { active: isActive })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar__status">
          {verifying ? (
            <span className="status-pill status-pill--loading">验证中</span>
          ) : configured ? (
            <a
              href={repoUrl(settings.repo)}
              target="_blank"
              rel="noopener noreferrer"
              className="topbar__repo-link"
              title={`打开 GitHub 仓库 ${settings.repo}`}
            >
              <GitHubIcon size={14} />
              <span>{settings.repo}</span>
            </a>
          ) : (
            <span className="status-pill status-pill--warn">未配置</span>
          )}
        </div>
      </header>

      <div className="layout__body">
        <Outlet />
      </div>
    </div>
  );
}
