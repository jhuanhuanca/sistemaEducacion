<script setup>
import { computed, reactive, ref, watch } from "vue";

const props = defineProps({
  gesture: {
    type: Object,
    required: true,
  },
});

const RODS = 5;
const TOP_BEADS = 1;
const BOTTOM_BEADS = 4;

const state = reactive({
  topActive: Array.from({ length: RODS }, () => 0),
  bottomActive: Array.from({ length: RODS }, () => 0),
});

const boardRef = ref(null);
const lastTopVy = Array.from({ length: RODS }, () => null);
let prevIndexSegment = -1;
let lastProcessedBottomSeq = 0;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const geometry = computed(() => {
  const w = 1000;
  const h = 560;
  const framePad = 56;
  const barY = 280;
  const rodTopY = framePad + 40;
  const rodBottomY = h - framePad - 40;
  const rodsX0 = framePad + 70;
  const rodsX1 = w - framePad - 70;
  const rodGap = RODS > 1 ? (rodsX1 - rodsX0) / (RODS - 1) : 0;
  const beadR = 20;

  const topRestY = barY - 120;
  const topActiveY = barY - 46;
  const bottomRestY = barY + 120;
  const bottomActiveY = barY + 46;
  const beadStackGap = 44;

  return {
    w,
    h,
    framePad,
    barY,
    rodTopY,
    rodBottomY,
    rodsX0,
    rodGap,
    beadR,
    topRestY,
    topActiveY,
    bottomRestY,
    bottomActiveY,
    beadStackGap,
  };
});

function bottomBeadY(i, k, g) {
  const gap = g.beadStackGap;
  if (i < k) return g.bottomActiveY + i * gap;
  return g.bottomRestY + i * gap;
}

const rodPalette = [
  { rod: "linear-gradient(180deg, #ff6b9d, #ff8fab)", bead: "#ff4d8a" },
  { rod: "linear-gradient(180deg, #ffbe0b, #ffd56f)", bead: "#f5a000" },
  { rod: "linear-gradient(180deg, #4cc9f0, #90e0ef)", bead: "#00b4d8" },
  { rod: "linear-gradient(180deg, #9d4edd, #c77dff)", bead: "#7b2cbf" },
  { rod: "linear-gradient(180deg, #06d6a0, #4ce0b3)", bead: "#059669" },
];

function getVirtualFromScreen(x, y) {
  const el = boardRef.value;
  if (!el || x == null || y == null) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const g = geometry.value;
  const vx = clamp((x - rect.left) / rect.width, 0, 1) * g.w;
  const vy = clamp((y - rect.top) / rect.height, 0, 1) * g.h;
  return { vx, vy };
}

const beads = computed(() => {
  const g = geometry.value;
  const gest = props.gesture;
  const pIndex =
    gest?.hasHand && gest.indexInTopZone ? getVirtualFromScreen(gest.indexX, gest.indexY) : null;

  const all = [];

  for (let rod = 0; rod < RODS; rod++) {
    const x = g.rodsX0 + rod * g.rodGap;

    for (let i = 0; i < TOP_BEADS; i++) {
      const active = i < state.topActive[rod];
      let y;
      if (
        gest?.hasHand &&
        gest.indexInTopZone &&
        gest.indexSegment === rod &&
        pIndex
      ) {
        y = clamp(pIndex.vy, g.topActiveY, g.topRestY);
      } else {
        y = active ? g.topActiveY : g.topRestY - i * g.beadStackGap;
      }
      all.push({
        id: `t-${rod}-${i}`,
        rod,
        deck: "top",
        idx: i,
        x,
        y,
        active,
        palette: rodPalette[rod],
      });
    }

    for (let i = 0; i < BOTTOM_BEADS; i++) {
      const k = state.bottomActive[rod];
      const active = i < k;
      const y = bottomBeadY(i, k, g);
      all.push({
        id: `b-${rod}-${i}`,
        rod,
        deck: "bottom",
        idx: i,
        x,
        y,
        active,
        palette: rodPalette[rod],
      });
    }
  }

  return all;
});

function snapTopFromVy(rod, vy) {
  const g = geometry.value;
  const mid = (g.topRestY + g.topActiveY) / 2;
  state.topActive[rod] = vy < mid ? TOP_BEADS : 0;
}

watch(
  () => props.gesture,
  (gest) => {
    const pIdx =
      gest?.hasHand && gest.indexInTopZone
        ? getVirtualFromScreen(gest.indexX, gest.indexY)
        : null;

    if (!gest?.hasHand) {
      for (let r = 0; r < RODS; r++) {
        if (lastTopVy[r] != null) {
          snapTopFromVy(r, lastTopVy[r]);
          lastTopVy[r] = null;
        }
      }
      prevIndexSegment = -1;
      return;
    }

    if (!gest.indexInTopZone) {
      for (let r = 0; r < RODS; r++) {
        if (lastTopVy[r] != null) {
          snapTopFromVy(r, lastTopVy[r]);
          lastTopVy[r] = null;
        }
      }
      prevIndexSegment = -1;
    } else {
      const ir = gest.indexSegment ?? 0;
      if (prevIndexSegment >= 0 && ir !== prevIndexSegment && lastTopVy[prevIndexSegment] != null) {
        snapTopFromVy(prevIndexSegment, lastTopVy[prevIndexSegment]);
        lastTopVy[prevIndexSegment] = null;
      }
      prevIndexSegment = ir;

      if (pIdx && ir >= 0 && ir < RODS) {
        lastTopVy[ir] = pIdx.vy;
      }
    }

  },
  { deep: true }
);

watch(
  () => props.gesture?.bottomStepSeq ?? 0,
  (seq) => {
    if (seq <= lastProcessedBottomSeq) return;
    const g = props.gesture;
    const dir = g?.bottomStepDir;
    const col = clamp(g?.bottomStepColumn ?? 0, 0, RODS - 1);
    if (dir === 1) {
      state.bottomActive[col] = clamp(state.bottomActive[col] + 1, 0, BOTTOM_BEADS);
    } else if (dir === -1) {
      state.bottomActive[col] = clamp(state.bottomActive[col] - 1, 0, BOTTOM_BEADS);
    }
    lastProcessedBottomSeq = seq;
  }
);
</script>

<template>
  <div class="scene">
    <div class="decor decor--sun" aria-hidden="true" />
    <div class="decor decor--cloud decor--cloud1" aria-hidden="true" />
    <div class="decor decor--cloud decor--cloud2" aria-hidden="true" />

    <div class="title">
      <div class="badge">
        <span class="badge__icon" aria-hidden="true">⭐</span>
        Ábaco mágico
      </div>
      <div class="subtitle">
        <strong>Arriba (rosa):</strong>
        <span class="hint hint--index">👆 índice</span>
        ·
        <strong>Abajo (azul):</strong>
        <span class="hint hint--thumb">👍 pulgar</span>
        — toca el rectángulo verde (+1) o rojo (−1), o haz un
        <strong>flick</strong>
        rápido arriba / abajo con el pulgar (una ficha por gesto).
      </div>
      <div class="pill-row" aria-hidden="true">
        <span v-for="n in RODS" :key="n" class="pill" :style="{ background: rodPalette[n - 1].bead }">{{ n }}</span>
      </div>
    </div>

    <div ref="boardRef" class="board" role="application" aria-label="Ábaco interactivo">
      <div class="frame">
        <div class="frame__shine" />
        <div class="bar">
          <span class="bar__sparkle" aria-hidden="true">✨</span>
        </div>
        <div class="rods">
          <div v-for="i in RODS" :key="i" class="rod" :style="{ background: rodPalette[i - 1].rod }" />
        </div>

        <div class="beads">
          <button
            v-for="b in beads"
            :key="b.id"
            class="bead"
            :class="[b.deck, b.active ? 'active' : 'rest']"
            :style="{
              left: `calc(${(b.x / geometry.w) * 100}% )`,
              top: `calc(${(b.y / geometry.h) * 100}% )`,
              '--bead-color': b.palette.bead,
            }"
            type="button"
            :aria-label="b.deck === 'top' ? 'Ficha superior' : 'Ficha inferior'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scene {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse 140% 80% at 50% -20%, rgba(255, 214, 125, 0.55), transparent 55%),
    radial-gradient(900px 500px at 15% 80%, rgba(255, 182, 193, 0.35), transparent 50%),
    radial-gradient(800px 450px at 85% 75%, rgba(147, 197, 253, 0.4), transparent 50%),
    linear-gradient(165deg, #5b21b6 0%, #7c3aed 35%, #2563eb 70%, #0ea5e9 100%);
}

.decor {
  position: absolute;
  pointer-events: none;
  z-index: 0;
}

.decor--sun {
  width: 120px;
  height: 120px;
  top: 8%;
  right: 10%;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff9c4, #fde047 45%, #f59e0b 100%);
  box-shadow: 0 0 60px rgba(253, 224, 71, 0.75);
  animation: float 6s ease-in-out infinite;
}

.decor--cloud {
  width: 140px;
  height: 56px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  box-shadow: 24px 8px 0 -4px rgba(255, 255, 255, 0.85), -32px 4px 0 -6px rgba(255, 255, 255, 0.8);
  opacity: 0.95;
  animation: float 8s ease-in-out infinite;
}

.decor--cloud1 {
  top: 14%;
  left: 6%;
  animation-delay: -2s;
}

.decor--cloud2 {
  bottom: 18%;
  left: 12%;
  transform: scale(0.85);
  animation-delay: -4s;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title {
  position: absolute;
  left: 18px;
  top: 14px;
  display: grid;
  gap: 8px;
  z-index: 3;
  user-select: none;
  max-width: min(520px, calc(100% - 24px));
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  padding: 12px 16px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 1.15rem;
  letter-spacing: 0.02em;
  color: #5b21b6;
  background: linear-gradient(180deg, #fffbeb, #fef3c7);
  border: 3px solid #fde68a;
  box-shadow: 0 8px 0 #d97706, 0 12px 24px rgba(0, 0, 0, 0.2);
}

.badge__icon {
  font-size: 1.3rem;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.15));
}

.subtitle {
  font-size: 14px;
  line-height: 1.45;
  color: #1e1b4b;
  background: rgba(255, 255, 255, 0.88);
  border: 2px solid rgba(255, 255, 255, 0.95);
  padding: 10px 14px;
  border-radius: 16px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.subtitle strong {
  color: #7c3aed;
}

.sep {
  opacity: 0.45;
  margin: 0 4px;
}

.hint {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 700;
}

.hint--index {
  background: linear-gradient(180deg, #fce7f3, #fbcfe8);
  color: #9d174d;
}

.hint--thumb {
  background: linear-gradient(180deg, #e0f2fe, #bae6fd);
  color: #0369a1;
}

.pill-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.15);
}

.board {
  width: min(1200px, calc(100% - 24px));
  height: min(680px, calc(100svh - 80px));
  display: grid;
  place-items: center;
  z-index: 1;
}

.frame {
  width: 100%;
  height: 100%;
  border-radius: 32px;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.15) 100%),
    linear-gradient(180deg, #a78bfa 0%, #818cf8 50%, #60a5fa 100%);
  border: 6px solid #fff;
  box-shadow: 0 16px 0 #4c1d95, 0 24px 48px rgba(0, 0, 0, 0.28);
}

.frame__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(125deg, rgba(255, 255, 255, 0.35) 0%, transparent 42%, transparent 100%);
  pointer-events: none;
}

.bar {
  position: absolute;
  left: 5%;
  right: 5%;
  top: 50%;
  height: 22px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: linear-gradient(90deg, #fbbf24, #f472b6, #38bdf8, #a78bfa);
  box-shadow:
    0 10px 0 #b45309,
    0 14px 28px rgba(0, 0, 0, 0.25),
    inset 0 3px 0 rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bar__sparkle {
  font-size: 18px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
  opacity: 0.95;
}

.rods {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 7% 8%;
  gap: 0;
}

.rod {
  width: 12px;
  justify-self: center;
  border-radius: 999px;
  box-shadow:
    0 14px 24px rgba(0, 0, 0, 0.2),
    inset 0 2px 0 rgba(255, 255, 255, 0.45);
}

.beads {
  position: absolute;
  inset: 0;
}

.bead {
  position: absolute;
  width: 48px;
  height: 48px;
  margin-left: -24px;
  margin-top: -24px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.95);
  background:
    radial-gradient(18px 18px at 28% 28%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0) 55%),
    radial-gradient(90px 70px at 72% 78%, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0) 60%),
    linear-gradient(165deg, rgba(255, 255, 255, 0.55), var(--bead-color));
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.22), 0 14px 22px rgba(0, 0, 0, 0.25);
  cursor: default;
  transition: transform 120ms ease, filter 120ms ease;
}

.bead.top {
  filter: saturate(1.15);
}

.bead.bottom {
  filter: saturate(1.1);
}

.bead.active {
  transform: scale(1.04);
}

.bead:focus-visible {
  outline: 3px solid #fde047;
  outline-offset: 3px;
}
</style>
