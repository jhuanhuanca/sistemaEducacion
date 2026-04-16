/** Columna 0..segments-1 según posición horizontal normalizada (0–1) en el video. */
export function segmentFromNormalizedX(x, segments = 5) {
  const t = Math.min(1, Math.max(0, x));
  return Math.min(segments - 1, Math.floor(t * segments));
}

/**
 * @param {{ x: number; y: number }[]} landmarks
 * @param {{ mirrorX?: boolean }} [opts] — cámara frontal: mirrorX alinea el conteo con vista espejo
 */
export function countFingers(landmarks, opts = {}) {
  const mirrorX = !!opts.mirrorX;
  let fingers = 0;

  const tips = [8, 12, 16, 20];
  const dips = [6, 10, 14, 18];

  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[dips[i]].y) {
      fingers++;
    }
  }

  if (mirrorX) {
    if (landmarks[4].x < landmarks[3].x) fingers++;
  } else {
    if (landmarks[4].x > landmarks[3].x) fingers++;
  }

  return fingers;
}
