<template>
  <div class="tracker">
    <video ref="video" class="video" autoplay muted playsinline></video>
    <canvas ref="canvas" class="canvas" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { countFingers, segmentFromNormalizedX } from "../utils/handLogic";

const emit = defineEmits(["gesture"]);

const SEGMENTS = 5;
const COOLDOWN_MS = 520;
const FLICK_MIN_DT_MS = 45;
const FLICK_MAX_DT_MS = 320;
const FLICK_UP_THRESHOLD = 0.052;
const FLICK_DOWN_THRESHOLD = -0.052;

const video = ref(null);
const canvas = ref(null);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

onMounted(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });

  video.value.srcObject = stream;
  await video.value.play();

  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  const ctx = canvas.value.getContext("2d");

  const setCanvasSize = () => {
    const w = Math.max(1, Math.floor(canvas.value.clientWidth));
    const h = Math.max(1, Math.floor((w * 3) / 4));
    canvas.value.width = w * window.devicePixelRatio;
    canvas.value.height = h * window.devicePixelRatio;
    canvas.value.style.height = `${h}px`;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  setCanvasSize();
  window.addEventListener("resize", setCanvasSize);

  const segmentColors = [
    "rgba(255, 107, 157, 0.22)",
    "rgba(255, 190, 11, 0.22)",
    "rgba(76, 201, 240, 0.22)",
    "rgba(157, 78, 221, 0.22)",
    "rgba(6, 214, 160, 0.22)",
  ];

  let bottomStepSeq = 0;
  let lastBottomEmitAt = 0;
  let lastBottomDir = 0;
  let lastBottomColumn = 0;
  let lastBottomHud = "—";

  const thumbFlickBuffer = [];
  const FLICK_BUFFER_MAX = 14;

  let prevThumbInUpBtn = false;
  let prevThumbInDownBtn = false;

  function tryEmitBottomStep(dir, column, reason) {
    const now = performance.now();
    if (now - lastBottomEmitAt < COOLDOWN_MS) return false;
    lastBottomEmitAt = now;
    bottomStepSeq += 1;
    lastBottomDir = dir;
    lastBottomColumn = clamp(column, 0, SEGMENTS - 1);
    lastBottomHud = `${dir > 0 ? "+1" : "-1"} col.${lastBottomColumn + 1} (${reason})`;
    thumbFlickBuffer.length = 0;
    return true;
  }

  function pushFlickSample(ny, now) {
    thumbFlickBuffer.push({ ny, t: now });
    while (thumbFlickBuffer.length > FLICK_BUFFER_MAX) thumbFlickBuffer.shift();
  }

  function detectThumbFlick() {
    if (thumbFlickBuffer.length < 4) return null;
    const last = thumbFlickBuffer[thumbFlickBuffer.length - 1];
    let oldestIdx = -1;
    for (let i = 0; i < thumbFlickBuffer.length - 1; i++) {
      if (last.t - thumbFlickBuffer[i].t <= FLICK_MAX_DT_MS) {
        oldestIdx = i;
        break;
      }
    }
    if (oldestIdx < 0) return null;
    const first = thumbFlickBuffer[oldestIdx];
    const dt = last.t - first.t;
    if (dt < FLICK_MIN_DT_MS) return null;
    const d = first.ny - last.ny;
    if (d > FLICK_UP_THRESHOLD) return +1;
    if (d < FLICK_DOWN_THRESHOLD) return -1;
    return null;
  }

  hands.onResults((results) => {
    setCanvasSize();
    const w = canvas.value.clientWidth;
    const h = canvas.value.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, w, h);
    ctx.restore();

    const sw = w / SEGMENTS;
    for (let s = 0; s < SEGMENTS; s++) {
      ctx.fillStyle = segmentColors[s];
      ctx.fillRect(s * sw, 0, sw, h);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(s * sw + 1, 1, sw - 2, h - 2);
    }

    const midY = h / 2;
    ctx.fillStyle = "rgba(255, 107, 157, 0.12)";
    ctx.fillRect(0, 0, w, midY);
    ctx.fillStyle = "rgba(76, 201, 240, 0.12)";
    ctx.fillRect(0, midY, w, h - midY);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    const stripY0 = midY + (h - midY) * 0.38;
    const stripY1 = h - 10;
    const splitX = w / 2;

    ctx.fillStyle = "rgba(16, 185, 129, 0.35)";
    ctx.fillRect(8, stripY0, splitX - 16, stripY1 - stripY0);
    ctx.fillStyle = "rgba(239, 68, 68, 0.32)";
    ctx.fillRect(splitX + 8, stripY0, w - splitX - 16, stripY1 - stripY0);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, stripY0, splitX - 16, stripY1 - stripY0);
    ctx.strokeRect(splitX + 8, stripY0, w - splitX - 16, stripY1 - stripY0);

    ctx.font = "bold 13px system-ui, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 3;
    const t1 = "↑ Toca +1";
    const t2 = "↓ Toca −1";
    ctx.strokeText(t1, 18, stripY0 + 22);
    ctx.fillText(t1, 18, stripY0 + 22);
    ctx.strokeText(t2, splitX + 18, stripY0 + 22);
    ctx.fillText(t2, splitX + 18, stripY0 + 22);

    ctx.font = "bold 11px system-ui, Segoe UI, sans-serif";
    ctx.strokeText("Índice — fichas de arriba", 12, 22);
    ctx.fillText("Índice — fichas de arriba", 12, 22);
    ctx.strokeText("Pulgar — fichas de abajo (flick o botones verde/rojo)", 12, midY + 22);
    ctx.fillText("Pulgar — fichas de abajo (flick o botones verde/rojo)", 12, midY + 22);

    let hasHand = false;
    let fingerCount = 0;
    let indexX = 0;
    let indexY = 0;
    let thumbX = 0;
    let thumbY = 0;
    let indexSegment = 0;
    let thumbSegment = 0;
    let indexInTopZone = false;
    let thumbInBottomZone = false;

    const lm = results.multiHandLandmarks?.[0];
    const now = performance.now();

    if (lm) {
      hasHand = true;
      fingerCount = countFingers(lm, { mirrorX: true });

      const mx8 = 1 - lm[8].x;
      const mx4 = 1 - lm[4].x;

      indexX = mx8 * window.innerWidth;
      indexY = lm[8].y * window.innerHeight;
      thumbX = mx4 * window.innerWidth;
      thumbY = lm[4].y * window.innerHeight;

      indexInTopZone = lm[8].y < 0.5;
      thumbInBottomZone = lm[4].y > 0.5;

      indexSegment = segmentFromNormalizedX(mx8, SEGMENTS);
      thumbSegment = segmentFromNormalizedX(mx4, SEGMENTS);

      const tpx = mx4 * w;
      const tpy = lm[4].y * h;

      const inUpBtn =
        thumbInBottomZone && tpx >= 8 && tpx <= splitX - 8 && tpy >= stripY0 && tpy <= stripY1;
      const inDownBtn =
        thumbInBottomZone && tpx >= splitX + 8 && tpx <= w - 8 && tpy >= stripY0 && tpy <= stripY1;

      if (inUpBtn && !prevThumbInUpBtn) {
        tryEmitBottomStep(1, thumbSegment, "botón +");
      } else if (inDownBtn && !prevThumbInDownBtn) {
        tryEmitBottomStep(-1, thumbSegment, "botón −");
      }
      prevThumbInUpBtn = inUpBtn;
      prevThumbInDownBtn = inDownBtn;

      if (thumbInBottomZone) {
        pushFlickSample(lm[4].y, now);
        const flickDir = detectThumbFlick();
        if (flickDir === 1) {
          if (tryEmitBottomStep(1, thumbSegment, "flick ↑")) {
            prevThumbInUpBtn = false;
            prevThumbInDownBtn = false;
          } else {
            thumbFlickBuffer.splice(0, Math.min(6, thumbFlickBuffer.length));
          }
        } else if (flickDir === -1) {
          if (tryEmitBottomStep(-1, thumbSegment, "flick ↓")) {
            prevThumbInUpBtn = false;
            prevThumbInDownBtn = false;
          } else {
            thumbFlickBuffer.splice(0, Math.min(6, thumbFlickBuffer.length));
          }
        }
      } else {
        thumbFlickBuffer.length = 0;
        prevThumbInUpBtn = false;
        prevThumbInDownBtn = false;
      }

      const drawPoint = (nx, ny, color, label) => {
        const px = nx * w;
        const py = ny * h;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (label) {
          ctx.font = "bold 11px system-ui, Segoe UI, sans-serif";
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillText(label, px + 10, py - 8);
        }
      };

      drawPoint(mx8, lm[8].y, indexInTopZone ? "#ff6b9d" : "#9ca3af", "Índice");
      drawPoint(mx4, lm[4].y, thumbInBottomZone ? "#4cc9f0" : "#9ca3af", "Pulgar");

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(8, h - 92, Math.min(w - 16, 268), 84);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "11px system-ui, Segoe UI, Roboto, sans-serif";
      ctx.fillText(`Dedos: ${fingerCount}`, 16, h - 72);
      ctx.fillText(
        `Índice: col.${indexSegment + 1} ${indexInTopZone ? "✓" : "↑ rosa"}`,
        16,
        h - 54
      );
      ctx.fillText(
        `Pulgar: col.${thumbSegment + 1} ${thumbInBottomZone ? "✓" : "↓ azul"}`,
        16,
        h - 36
      );
      ctx.fillText(`Abajo: ${lastBottomHud}`, 16, h - 18);
    } else {
      prevThumbInUpBtn = false;
      prevThumbInDownBtn = false;
      thumbFlickBuffer.length = 0;
    }

    emit("gesture", {
      hasHand,
      fingerCount,
      indexX: clamp(indexX, 0, window.innerWidth),
      indexY: clamp(indexY, 0, window.innerHeight),
      thumbX: clamp(thumbX, 0, window.innerWidth),
      thumbY: clamp(thumbY, 0, window.innerHeight),
      indexSegment,
      thumbSegment,
      indexInTopZone,
      thumbInBottomZone,
      bottomStepSeq: bottomStepSeq,
      bottomStepDir: lastBottomDir,
      bottomStepColumn: lastBottomColumn,
      lastBottomHud,
    });
  });

  const detect = async () => {
    await hands.send({ image: video.value });
    requestAnimationFrame(detect);
  };

  detect();
});
</script>

<style scoped>
.tracker {
  width: 100%;
  display: grid;
}

.video {
  display: none;
}

.canvas {
  width: 100%;
  height: auto;
  display: block;
}
</style>
