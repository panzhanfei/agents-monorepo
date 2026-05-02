/**
 * One-shot probe — avoids spawning many throwaway canvases during React Strict Mode cycles.
 */
let cached: boolean | null = null;

export const isBrowserWebGlLikelySupported = (): boolean => {
  if (cached !== null) {
    return cached;
  }
  if (typeof document === 'undefined') {
    cached = false;
    return cached;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    cached = gl !== null;
    return cached;
  } catch {
    cached = false;
    return cached;
  }
};
