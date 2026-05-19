// Rounding helper mirroring Python's round() with ties-to-even is good enough
// for our 2-4 decimal places — JS Math.round (away-from-zero) suffices since
// inputs are floats with negligible exact-half cases.
export function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

export function ema(data: number[], period: number): (number | null)[] {
  if (data.length < period) return new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(period - 1).fill(null);
  const seed = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(seed);
  for (let i = period; i < data.length; i++) {
    const prev = result[result.length - 1] as number;
    result.push((data[i] as number) * k + prev * (1 - k));
  }
  return result;
}

export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += data[j] as number;
      result.push(s / period);
    }
  }
  return result;
}

export function stdev(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += data[j] as number;
      const avg = s / period;
      let v = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const d = (data[j] as number) - avg;
        v += d * d;
      }
      result.push(Math.sqrt(v / period));
    }
  }
  return result;
}

export function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i] as T;
  }
  return null;
}
