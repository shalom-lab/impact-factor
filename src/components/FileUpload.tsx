import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { isSupportedFile } from '../lib/parseData';
import type { FileUploadProps } from '../types';

export function FileUpload({ onUpload, uploading, disabled, compact }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList).filter(isSupportedFile);

      if (!files.length) {
        setError('请选择 CSV 或 XLSX 文件');
        return;
      }

      try {
        await onUpload(files);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [onUpload]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    processFiles(e.dataTransfer.files);
  }

  return (
    <div className={clsx('file-upload', { 'file-upload--compact': compact })}>
      <div
        className={clsx('file-upload__dropzone', {
          'file-upload__dropzone--active': dragOver,
          'file-upload__dropzone--disabled': disabled || uploading
        })}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              processFiles(e.target.files);
              e.target.value = '';
            }
          }}
          disabled={disabled || uploading}
        />

        <div className="file-upload__icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
          </svg>
        </div>

        {uploading ? (
          <p className="file-upload__text">正在上传…</p>
        ) : (
          <>
            <p className="file-upload__text">
              拖拽文件到此处，或 <span className="file-upload__link">点击选择</span>
            </p>
            <p className="file-upload__sub">.csv · .xlsx · .xls</p>
          </>
        )}
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}
    </div>
  );
}
