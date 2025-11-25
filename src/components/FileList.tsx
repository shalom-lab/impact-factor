import clsx from 'clsx';
import type { CsvFileMeta } from '../types';

type FileListProps = {
  files: CsvFileMeta[];
  selectedFile?: CsvFileMeta | null;
  onSelect: (file: CsvFileMeta) => void;
};

export function FileList({ files, selectedFile, onSelect }: FileListProps) {
  if (!files.length) {
    return (
      <div className="file-list empty">
        <p>暂无 CSV 文件，请将数据放入仓库的 data 目录。</p>
      </div>
    );
  }

  return (
    <div className="file-list">
      <div className="file-list__header">
        <h2>文件选择列表</h2>
        <p>共 {files.length} 个数据源</p>
      </div>
      <ul>
        {files.map((file) => (
          <li key={file.fileName}>
            <button
              type="button"
              onClick={() => onSelect(file)}
              className={clsx({ active: selectedFile?.fileName === file.fileName })}
            >
              <span className="title">{file.title}</span>
              <span className="meta">{(file.size / 1024).toFixed(1)} KB</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

