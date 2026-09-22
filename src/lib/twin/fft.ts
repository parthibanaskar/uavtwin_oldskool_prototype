/** Iterative radix-2 FFT. Returns magnitude spectrum bins (single sided). */
export function magnitudeSpectrum(input: number[], sampleRate: number) {
  const n = 1 << Math.floor(Math.log2(input.length));
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Hann window to suppress leakage.
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = (input[i] ?? 0) * w;
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]!;
        const ai = im[i + k]!;
        const br = re[i + k + len / 2]!;
        const bi = im[i + k + len / 2]!;
        const tr = br * cr - bi * ci;
        const ti = br * ci + bi * cr;
        re[i + k] = ar + tr;
        im[i + k] = ai + ti;
        re[i + k + len / 2] = ar - tr;
        im[i + k + len / 2] = ai - ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }

  const bins: { freq: number; mag: number }[] = [];
  const half = n / 2;
  for (let k = 0; k < half; k++) {
    bins.push({
      freq: (k * sampleRate) / n,
      mag: (2 * Math.hypot(re[k]!, im[k]!)) / n,
    });
  }
  return bins;
}

/** Energy in a band, used for bearing / imbalance discrimination. */
export function bandEnergy(
  bins: { freq: number; mag: number }[],
  loHz: number,
  hiHz: number,
): number {
  let sum = 0;
  for (const b of bins) if (b.freq >= loHz && b.freq <= hiHz) sum += b.mag * b.mag;
  return Math.sqrt(sum);
}
