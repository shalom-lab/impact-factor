export type CsvFileMeta = {
  fileName: string;
  title: string;
  relativePath: string;
  size: number;
  lastModified: string;
};

export type DataManifest = {
  generatedAt: string;
  fileCount: number;
  files: CsvFileMeta[];
};

