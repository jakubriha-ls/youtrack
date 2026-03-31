export const hexToRgb = (
  hex: string,
): { r: number; g: number; b: number } | null => {
  const raw = hex.trim().replace('#', '');
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map(c => c + c)
          .join('')
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const num = Number.parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

// WCAG relative luminance for sRGB
const channelToLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

export const getRelativeLuminance = (hex: string): number | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getReadableTextColor = (
  backgroundHex: string,
  options?: { lightText?: string; darkText?: string },
): { color: string; isLight: boolean } => {
  const lightText = options?.lightText ?? '#ffffff';
  const darkText = options?.darkText ?? '#111827';

  const L = getRelativeLuminance(backgroundHex);
  if (L === null) {
    return { color: darkText, isLight: false };
  }

  // Contrast ratios vs white/near-black, choose best
  const contrast = (L1: number, L2: number) =>
    (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

  const whiteL = 1;
  const blackL = 0; // close enough for our darkText
  const cWhite = contrast(whiteL, L);
  const cBlack = contrast(L, blackL);

  if (cWhite >= cBlack) return { color: lightText, isLight: true };
  return { color: darkText, isLight: false };
};

