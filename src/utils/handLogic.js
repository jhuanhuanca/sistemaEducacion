export function countFingers(landmarks) {
  let fingers = 0;

  const tips = [8, 12, 16, 20];
  const dips = [6, 10, 14, 18];

  for (let i = 0; i < tips.length; i++) {
    if (landmarks[tips[i]].y < landmarks[dips[i]].y) {
      fingers++;
    }
  }

  // Pulgar
  if (landmarks[4].x > landmarks[3].x) {
    fingers++;
  }

  return fingers;
}
