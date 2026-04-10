<script setup>
import { computed, reactive, ref, watch } from "vue";

const props = defineProps({
  gesture: {
    type: Object,
    required: true,
  },
});

const RODS = 9; // ábaco “chino” típico para niños
const TOP_BEADS = 2;
const BOTTOM_BEADS = 5;

// Estado: cuántas fichas están “activas” (pegadas a la barra central)
// - arriba: 0..2 (bajadas hacia la barra)
// - abajo: 0..5 (subidas hacia la barra)
const state = reactive({
  topActive: Array.from({ length: RODS }, () => 0),
  bottomActive: Array.from({ length: RODS }, () => 0),
});

const boardRef = ref(null);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

const geometry = computed(() => {
  // Valores relativos; todo se reescala con CSS (layout responsive).
  // Usamos un sistema “virtual” para detectar el gesto sobre fichas.
  const w = 1000;
  const h = 560;
  const framePad = 56;
  const barY = 280;
  const rodTopY = framePad + 40;
  const rodBottomY = h - framePad - 40;
  const rodsX0 = framePad + 70;
  const rodsX1 = w - framePad - 70;
  const rodGap = (rodsX1 - rodsX0) / (RODS - 1);
  const beadR = 18;

  // Posiciones “en reposo” (lejos de la barra) y “activas” (cerca de la barra)
  const topRestY = barY - 120;
  const topActiveY = barY - 46;
  const bottomRestY = barY + 120;
  const bottomActiveY = barY + 46;

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
  };
});

const beads = computed(() => {
  const g = geometry.value;
  const all = [];

  for (let rod = 0; rod < RODS; rod++) {
    const x = g.rodsX0 + rod * g.rodGap;

    // Arriba (2)
    for (let i = 0; i < TOP_BEADS; i++) {
      const active = i < state.topActive[rod];
      const y = active ? g.topActiveY : g.topRestY - i * 44;
      all.push({
        id: `t-${rod}-${i}`,
        rod,
        deck: "top",
        idx: i,
        x,
        y,
        active,
      });
    }

    // Abajo (5)
    for (let i = 0; i < BOTTOM_BEADS; i++) {
      const active = i < state.bottomActive[rod];
      const y = active ? g.bottomActiveY : g.bottomRestY + i * 44;
      all.push({
        id: `b-${rod}-${i}`,
        rod,
        deck: "bottom",
        idx: i,
        x,
        y,
        active,
      });
    }
  }

  return all;
});

const drag = reactive({
  holding: false,
  beadId: null,
  rod: -1,
  deck: null,
});

function getPointerInVirtualSpace() {
  const el = boardRef.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const x = props.gesture?.x ?? 0;
  const y = props.gesture?.y ?? 0;
  const vx = clamp((x - rect.left) / rect.width, 0, 1) * geometry.value.w;
  const vy = clamp((y - rect.top) / rect.height, 0, 1) * geometry.value.h;
  return { vx, vy };
}

function pickNearestBead(vx, vy) {
  const g = geometry.value;
  const r2 = (g.beadR * 2.2) ** 2;

  let best = null;
  let bestD2 = Infinity;
  for (const b of beads.value) {
    const d2 = dist2(vx, vy, b.x, b.y);
    if (d2 < bestD2 && d2 <= r2) {
      bestD2 = d2;
      best = b;
    }
  }
  return best;
}

function applyDragToState(vx, vy) {
  const g = geometry.value;
  if (!drag.holding) return;

  // Decisión simple y estable: si arrastras hacia la barra, “activa”; si lo alejas, “desactiva”.
  if (drag.deck === "top") {
    const towardBar = vy > g.topRestY - 10;
    state.topActive[drag.rod] = towardBar ? TOP_BEADS : 0;
  } else if (drag.deck === "bottom") {
    const towardBar = vy < g.bottomRestY + 10;
    state.bottomActive[drag.rod] = towardBar ? BOTTOM_BEADS : 0;
  }
}

watch(
  () => props.gesture,
  () => {
    const g = props.gesture;
    const pinch = !!g?.pinch;
    const p = getPointerInVirtualSpace();
    if (!p) return;

    if (pinch && !drag.holding) {
      const b = pickNearestBead(p.vx, p.vy);
      if (b) {
        drag.holding = true;
        drag.beadId = b.id;
        drag.rod = b.rod;
        drag.deck = b.deck;
      }
    } else if (!pinch && drag.holding) {
      drag.holding = false;
      drag.beadId = null;
      drag.rod = -1;
      drag.deck = null;
    }

    if (pinch && drag.holding) {
      applyDragToState(p.vx, p.vy);
    }
  },
  { deep: true }
);
</script>

<template>
  <div class="scene">
    <div class="title">
      <div class="badge">Ábaco chino</div>
      <div class="subtitle">Haz pinza con pulgar + índice para mover fichas</div>
    </div>

    <div ref="boardRef" class="board" role="application" aria-label="Ábaco interactivo">
      <div class="frame">
        <div class="bar" />
        <div class="rods">
          <div v-for="i in RODS" :key="i" class="rod" />
        </div>

        <div class="beads">
          <button
            v-for="b in beads"
            :key="b.id"
            class="bead"
            :class="[
              b.deck,
              b.active ? 'active' : 'rest',
              drag.beadId === b.id ? 'held' : '',
            ]"
            :style="{
              left: `calc(${(b.x / geometry.w) * 100}% )`,
              top: `calc(${(b.y / geometry.h) * 100}% )`,
            }"
            type="button"
            aria-label="Ficha"
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
  background:
    radial-gradient(1200px 600px at 25% 10%, rgba(255, 198, 99, 0.35), transparent 60%),
    radial-gradient(900px 500px at 80% 20%, rgba(140, 215, 255, 0.32), transparent 55%),
    radial-gradient(900px 700px at 60% 85%, rgba(186, 255, 205, 0.25), transparent 60%),
    linear-gradient(180deg, #0f1220, #0b0d16);
}

.title {
  position: absolute;
  left: 18px;
  top: 18px;
  display: grid;
  gap: 6px;
  z-index: 3;
  user-select: none;
}

.badge {
  display: inline-flex;
  width: max-content;
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: rgba(255, 255, 255, 0.96);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: var(--shadow);
}

.subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px 10px;
  border-radius: 14px;
  width: max-content;
}

.board {
  width: min(1200px, calc(100vw - 60px));
  height: min(680px, calc(100svh - 80px));
  display: grid;
  place-items: center;
}

.frame {
  width: 100%;
  height: 100%;
  border-radius: 26px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(900px 500px at 30% 30%, rgba(255, 255, 255, 0.11), transparent 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: var(--shadow);
}

.bar {
  position: absolute;
  left: 4%;
  right: 4%;
  top: 50%;
  height: 18px;
  transform: translateY(-50%);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(0, 0, 0, 0.2)),
    linear-gradient(90deg, #f5c25a, #ff7ad9, #6bd6ff);
  filter: saturate(1.05);
  box-shadow:
    0 12px 25px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.rods {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  padding: 8% 10%;
  gap: 0;
}

.rod {
  width: 8px;
  justify-self: center;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(0, 0, 0, 0.35));
  box-shadow:
    0 14px 30px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.beads {
  position: absolute;
  inset: 0;
}

.bead {
  position: absolute;
  width: 44px;
  height: 44px;
  margin-left: -22px;
  margin-top: -22px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background:
    radial-gradient(16px 16px at 30% 30%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 60%),
    radial-gradient(90px 60px at 70% 70%, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0) 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.22));
  box-shadow:
    0 16px 26px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  cursor: default;
  transition: transform 140ms ease, filter 140ms ease;
}

.bead.top {
  filter: hue-rotate(300deg) saturate(1.1);
}
.bead.bottom {
  filter: hue-rotate(140deg) saturate(1.08);
}

.bead.active {
  transform: scale(1.02);
}

.bead.held {
  transform: scale(1.12);
  outline: 2px solid rgba(255, 255, 255, 0.45);
  outline-offset: 2px;
}
</style>
