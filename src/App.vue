<script setup>
import { ref } from "vue";
import HandTracker from "./components/HandTracker.vue";
import AbacusBoard from "./components/AbacusBoard.vue";

const gesture = ref({
  x: 0,
  y: 0,
  pinch: false,
  fingerCount: 0,
  hasHand: false,
});
</script>

<template>
  <main class="home">
    <AbacusBoard :gesture="gesture" />

    <div class="cameraCorner" aria-label="Vista de cámara">
      <HandTracker @gesture="(g) => (gesture = g)" />
      <div class="hud">
        <div class="chip">
          Mano: <b>{{ gesture.hasHand ? "sí" : "no" }}</b>
        </div>
        <div class="chip">
          Dedos: <b>{{ gesture.fingerCount }}</b>
        </div>
        <div class="chip">
          Pinza: <b>{{ gesture.pinch ? "sí" : "no" }}</b>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.home {
  position: relative;
  width: 100%;
  height: 100svh;
  overflow: hidden;
}

.cameraCorner {
  position: absolute;
  right: 18px;
  bottom: 18px;
  width: min(360px, 42vw);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--shadow);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  background: rgba(20, 20, 25, 0.35);
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


