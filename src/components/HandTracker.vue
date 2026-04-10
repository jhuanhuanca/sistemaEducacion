<template>
  <div class="tracker">
    <video ref="video" class="video" autoplay muted playsinline></video>
    <canvas ref="canvas" class="canvas" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { countFingers } from "../utils/handLogic";

const emit = defineEmits(["gesture"]);

const video = ref(null);
const canvas = ref(null);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
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
    // Mantener un preview nítido y responsive (sin depender de 640x480 fijo)
    const w = Math.max(1, Math.floor(canvas.value.clientWidth));
    const h = Math.max(1, Math.floor((w * 3) / 4));
    canvas.value.width = w * window.devicePixelRatio;
    canvas.value.height = h * window.devicePixelRatio;
    canvas.value.style.height = `${h}px`;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };

  setCanvasSize();
  window.addEventListener("resize", setCanvasSize);

  hands.onResults((results) => {
    setCanvasSize();
    const w = canvas.value.clientWidth;
    const h = canvas.value.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(results.image, 0, 0, w, h);

    let hasHand = false;
    let fingerCount = 0;
    let pinch = false;
    let x = 0;
    let y = 0;

    const lm = results.multiHandLandmarks?.[0];
    if (lm) {
      hasHand = true;
      fingerCount = countFingers(lm);

      // Puntero: punta del índice (8)
      x = lm[8].x * window.innerWidth;
      y = lm[8].y * window.innerHeight;

      // Pinza: distancia entre pulgar (4) e índice (8)
      const d = dist(lm[4].x, lm[4].y, lm[8].x, lm[8].y);
      pinch = d < 0.05;

      // Debug visual: puntos mínimos
      const drawPoint = (p, color) => {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      };
      drawPoint(lm[8], pinch ? "#22c55e" : "#ef4444");
      drawPoint(lm[4], pinch ? "#22c55e" : "#ef4444");

      // Retícula suave
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(10, 10, 140, 56);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "12px system-ui, Segoe UI, Roboto, sans-serif";
      ctx.fillText(`Dedos: ${fingerCount}`, 18, 32);
      ctx.fillText(`Pinza: ${pinch ? "sí" : "no"}`, 18, 52);
    }

    emit("gesture", {
      hasHand,
      fingerCount,
      pinch,
      x: clamp(x, 0, window.innerWidth),
      y: clamp(y, 0, window.innerHeight),
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