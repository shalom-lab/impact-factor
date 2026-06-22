export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function mimeTypeForFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'text/csv;charset=utf-8';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export function blobFromSpreadsheetContent(
  fileName: string,
  content: { text?: string; buffer?: ArrayBuffer }
): Blob {
  if (content.text !== undefined) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.csv')) {
      const bom = '\uFEFF';
      const text = content.text.startsWith(bom) ? content.text : bom + content.text;
      return new Blob([text], { type: mimeTypeForFileName(fileName) });
    }
    return new Blob([content.text], { type: mimeTypeForFileName(fileName) });
  }
  if (content.buffer) {
    return new Blob([content.buffer], { type: mimeTypeForFileName(fileName) });
  }
  throw new Error('文件内容为空');
}
