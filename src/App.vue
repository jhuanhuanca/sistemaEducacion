<script setup>
import { ref } from "vue";
import HandTracker from "./components/HandTracker.vue";
import AbacusBoard from "./components/AbacusBoard.vue";

const gesture = ref({
  indexX: 0,
  indexY: 0,
  thumbX: 0,
  thumbY: 0,
  indexSegment: 0,
  thumbSegment: 0,
  indexInTopZone: false,
  thumbInBottomZone: false,
  bottomStepSeq: 0,
  bottomStepDir: 0,
  bottomStepColumn: 0,
  lastBottomHud: "—",
  fingerCount: 0,
  hasHand: false,
});
</script>

<template>
  <main class="home">
    <div class="boardStage">
      <AbacusBoard :gesture="gesture" />
    </div>

    <aside class="cameraRail" aria-label="Vista de cámara">
      <HandTracker @gesture="(g) => (gesture = g)" />
      <div class="hud">
        <div class="chip">
          Mano: <b>{{ gesture.hasHand ? "sí" : "no" }}</b>
        </div>
        <div class="chip">
          Dedos: <b>{{ gesture.fingerCount }}</b>
        </div>
        <div class="chip">
          Columna índice: <b>{{ gesture.indexSegment + 1 }}</b>
        </div>
        <div class="chip">
          Columna pulgar: <b>{{ gesture.thumbSegment + 1 }}</b>
        </div>
        <div class="chip">
          Zona índice: <b>{{ gesture.indexInTopZone ? "sí" : "no" }}</b>
        </div>
        <div class="chip">
          Zona pulgar: <b>{{ gesture.thumbInBottomZone ? "sí" : "no" }}</b>
        </div>
        <div class="chip">
          Pasos abajo: <b>#{{ gesture.bottomStepSeq }}</b>
        </div>
        <div class="chip">
          Último: <b>{{ gesture.lastBottomHud }}</b>
        </div>
      </div>
    </aside>
  </main>
</template>

<style scoped>
.home {
  --camera-rail-width: clamp(168px, 28vw, 360px);
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  height: 100svh;
  overflow: hidden;
  box-sizing: border-box;
  gap: 0;
}

.boardStage {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 10px 8px 10px 12px;
  box-sizing: border-box;
}

.cameraRail {
  flex: 0 0 var(--camera-rail-width);
  width: var(--camera-rail-width);
  max-width: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0;
  overflow: auto;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(8px);
  background: rgba(20, 20, 25, 0.42);
}

.hud {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px;
}

.chip {
  font-size: 12px;
  line-height: 1;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  user-select: none;
}
</style>


