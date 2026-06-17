/** Base64 → UTF-8 文本（GitHub API 返回的 CSV 需用此方式解码） */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function decodeBase64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

export function normalizeHeaderKey(key: string): string {
  return key.replace(/^\uFEFF/, '').trim();
}
