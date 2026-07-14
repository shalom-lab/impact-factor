export type CsvFileMeta = {
  fileName: string;
  title: string;
  size: number;
  lastModified: string;
  sheetCount: number;
  rowCount: number;
};

/** 仅写入 localStorage 的凭证字段 */
export type StoredCredentials = {
  token: string;
  repo: string;
  dataPath: string;
};

/** 运行时完整配置（权限与分支不持久化） */
export type AppSettings = StoredCredentials & {
  defaultBranch: string;
  canRead: boolean;
  canWrite: boolean;
};

export type CellValue = string | number | boolean | null;

/** 单个工作表（Handsontable 数据源） */
export type SheetData = {
  name: string;
  colHeaders: string[];
  data: CellValue[][];
};

export type StoredFileEntry = {
  fileName: string;
  title: string;
  uploadedAt: string;
  sheets: SheetData[];
};

export type FileUploadProps = {
  onUpload: (files: File[]) => Promise<void>;
  uploading: boolean;
  disabled?: boolean;
  compact?: boolean;
};
