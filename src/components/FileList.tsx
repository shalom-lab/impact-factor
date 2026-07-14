import clsx from 'clsx';
import type { CsvFileMeta } from '../types';

type FileListProps = {
  files: CsvFileMeta[];
  selectedFile?: CsvFileMeta | null;
  onSelect: (file: CsvFileMeta) => void;
  onDelete?: (file: CsvFileMeta) => void;
  canDelete?: boolean;
  deleteDisabled?: boolean;
};

export function FileList({
  files,
  selectedFile,
  onSelect,
  onDelete,
  canDelete,
  deleteDisabled
}: FileListProps) {
  if (!files.length) {
    return (
      <div className="file-list empty">
        <p>暂无数据，请前往上传页面添加 CSV / XLSX 文件。</p>
      </div>
    );
  }

  return (
    <div className="file-list">
      <ul>
        {files.map((file) => {
          const active = selectedFile?.fileName === file.fileName;
          return (
            <li key={file.fileName} className={clsx('file-list__item', { active })}>
              <button type="button" className="file-list__select" onClick={() => onSelect(file)}>
                <span className="title">{file.title}</span>
                <span className="meta">
                  {(file.size / 1024).toFixed(1)} KB
                  {file.sheetCount > 1 ? ` · ${file.sheetCount} 表` : ''}
                  {` · ${file.rowCount.toLocaleString()} 行`}
                </span>
              </button>
              {canDelete && onDelete ? (
                <button
                  type="button"
                  className="file-list__delete"
                  title="删除文件"
                  disabled={deleteDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file);
                  }}
                >
                  ×
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
