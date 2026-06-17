export type NumericColumnStats = {
  min: number;
  max: number;
};

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 超过半数非空值为数字则视为数值列 */
export function computeNumericColumns(rows: Record<string, unknown>[]): Record<string, NumericColumnStats> {
  if (!rows.length) return {};

  const keys = Object.keys(rows[0]);
  const result: Record<string, NumericColumnStats> = {};

  for (const key of keys) {
    const numbers: number[] = [];
    let nonEmpty = 0;

    for (const row of rows) {
      const v = row[key];
      if (v === null || v === undefined || v === '') continue;
      nonEmpty++;
      const n = toNumber(v);
      if (n !== null) numbers.push(n);
    }

    if (nonEmpty === 0 || numbers.length < nonEmpty * 0.5) continue;

    result[key] = {
      min: Math.min(...numbers),
      max: Math.max(...numbers)
    };
  }

  return result;
}

/** 数值 → 蓝色深浅背景 */
export function numericBlueBackground(value: number, min: number, max: number): string {
  if (max === min) return 'rgba(59, 130, 246, 0.12)';
  const t = (value - min) / (max - min);
  const alpha = 0.06 + t * 0.52;
  return `rgba(37, 99, 235, ${alpha.toFixed(3)})`;
}
