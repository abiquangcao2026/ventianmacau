<template>
  <div class="dice3d-wrap">
    <div class="dice3d-table" aria-hidden="true">
      <div class="dice3d-table__frame">
        <div class="dice3d-table__lane-glow">
          <div class="dice3d-table__lane-glow-cell"></div>
          <div class="dice3d-table__lane-glow-cell"></div>
          <div class="dice3d-table__lane-glow-cell"></div>
        </div>
        <div class="dice3d-table__wall">
          <div class="dice3d-table__wall-panel"></div>
          <div class="dice3d-table__wall-panel"></div>
          <div class="dice3d-table__wall-panel"></div>
        </div>
        <div class="dice3d-table__floor">
          <div class="dice3d-table__divider dice3d-table__divider--left"></div>
          <div class="dice3d-table__divider dice3d-table__divider--right"></div>
        </div>
      </div>
    </div>

    <canvas ref="canvasRef" class="dice3d-canvas"></canvas>

    <div class="dice3d-glow" :style="{ opacity: glowStrength }"></div>
    <div v-if="waitingLabel" class="dice3d-waiting">{{ waitingLabel }}</div>
  </div>
</template>

<script setup>
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  FACE_TEXTURE_BY_AXIS,
  easeOutCubic,
  easeOutQuart,
  getFaceQuaternion,
  normalizeResultArray
} from '@/utils/diceRotation'
import { createDiceSoundEngine } from '@/utils/diceSound'

const props = defineProps({
  result: {
    type: Array,
    default: () => []
  },
  rolling: {
    type: Boolean,
    default: false
  },
  countdown: {
    type: Number,
    default: 0
  }
})

const canvasRef = ref(null)
const previewSpinActive = ref(false)
const stableResult = ref([])
const glowStrength = ref(0)
const waitingLabel = computed(() => {
  if (activeRollState.dice.length || previewSpinActive.value) return 'Đang xoay xúc xắc...'
  return stableResult.value.length === 3 ? '' : 'Đang chờ kết quả...'
})

const diceSound = createDiceSoundEngine()
const diceMeshes = []
const activeRollState = {
  id: 0,
  startAt: 0,
  duration: 1450,
  dice: []
}
const lastAnimatedSignature = ref('')

let scene = null
let camera = null
let renderer = null
let frameId = 0
let resizeObserver = null

const cameraBasePosition = new THREE.Vector3(0, 2.02, 5.9)
const cameraLookAt = new THREE.Vector3(0, 0.48, 0.04)

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

function getPipPattern(faceValue) {
  const offset = 112
  const center = 0
  switch (faceValue) {
    case 1:
      return [[center, center]]
    case 2:
      return [
        [-offset, -offset],
        [offset, offset]
      ]
    case 3:
      return [
        [-offset, -offset],
        [center, center],
        [offset, offset]
      ]
    case 4:
      return [
        [-offset, -offset],
        [offset, -offset],
        [-offset, offset],
        [offset, offset]
      ]
    case 5:
      return [
        [-offset, -offset],
        [offset, -offset],
        [center, center],
        [-offset, offset],
        [offset, offset]
      ]
    case 6:
      return [
        [-offset, -offset],
        [offset, -offset],
        [-offset, center],
        [offset, center],
        [-offset, offset],
        [offset, offset]
      ]
    default:
      return []
  }
}

function createFaceTexture(faceValue) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640
  const context = canvas.getContext('2d')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#a90202'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const baseGradient = context.createLinearGradient(36, 18, 604, 622)
  baseGradient.addColorStop(0, '#ff7770')
  baseGradient.addColorStop(0.16, '#ff2424')
  baseGradient.addColorStop(0.52, '#e50000')
  baseGradient.addColorStop(1, '#8e0000')
  context.fillStyle = baseGradient
  drawRoundedRect(context, 12, 12, 616, 616, 112)
  context.fill()

  const sideShade = context.createLinearGradient(48, 52, 606, 606)
  sideShade.addColorStop(0, 'rgba(255,255,255,0.28)')
  sideShade.addColorStop(0.34, 'rgba(255,255,255,0.03)')
  sideShade.addColorStop(0.78, 'rgba(76,0,0,0.2)')
  sideShade.addColorStop(1, 'rgba(31,0,0,0.42)')
  context.fillStyle = sideShade
  drawRoundedRect(context, 12, 12, 616, 616, 112)
  context.fill()

  const faceInsetGradient = context.createLinearGradient(70, 54, 570, 586)
  faceInsetGradient.addColorStop(0, '#ff5952')
  faceInsetGradient.addColorStop(0.42, '#f20c0c')
  faceInsetGradient.addColorStop(1, '#b80000')
  context.fillStyle = faceInsetGradient
  drawRoundedRect(context, 58, 58, 524, 524, 86)
  context.fill()

  const highlight = context.createRadialGradient(190, 128, 18, 188, 132, 330)
  highlight.addColorStop(0, 'rgba(255,255,255,0.62)')
  highlight.addColorStop(0.22, 'rgba(255,255,255,0.24)')
  highlight.addColorStop(0.58, 'rgba(255,255,255,0.06)')
  highlight.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = highlight
  drawRoundedRect(context, 36, 32, 568, 272, 94)
  context.fill()

  const gloss = context.createLinearGradient(80, 34, 550, 230)
  gloss.addColorStop(0, 'rgba(255,255,255,0.42)')
  gloss.addColorStop(0.24, 'rgba(255,255,255,0.1)')
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gloss
  drawRoundedRect(context, 78, 50, 430, 96, 48)
  context.fill()

  context.strokeStyle = 'rgba(255, 160, 150, 0.4)'
  context.lineWidth = 5
  drawRoundedRect(context, 58, 58, 524, 524, 82)
  context.stroke()

  context.strokeStyle = 'rgba(80, 0, 0, 0.46)'
  context.lineWidth = 7
  drawRoundedRect(context, 18, 18, 604, 604, 106)
  context.stroke()

  for (const [x, y] of getPipPattern(faceValue)) {
    const pipGradient = context.createRadialGradient(
      300 + x * 1.18,
      286 + y * 1.18,
      9,
      320 + x * 1.18,
      320 + y * 1.18,
      52
    )
    pipGradient.addColorStop(0, '#ffffff')
    pipGradient.addColorStop(0.5, '#f9f9f9')
    pipGradient.addColorStop(0.78, '#e5e5e5')
    pipGradient.addColorStop(1, '#b9b9b9')

    context.fillStyle = pipGradient
    context.shadowColor = 'rgba(42, 0, 0, 0.54)'
    context.shadowBlur = 16
    context.shadowOffsetY = 7
    context.beginPath()
    context.arc(320 + x * 1.18, 320 + y * 1.18, 45, 0, Math.PI * 2)
    context.fill()
    context.shadowColor = 'rgba(0,0,0,0)'
    context.lineWidth = 3
    context.strokeStyle = 'rgba(130, 130, 130, 0.72)'
    context.stroke()

    context.beginPath()
    context.fillStyle = 'rgba(255,255,255,0.72)'
    context.arc(302 + x * 1.18, 300 + y * 1.18, 13, 0, Math.PI * 2)
    context.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 6
  texture.needsUpdate = true
  return texture
}

function createDiceMaterials() {
  return FACE_TEXTURE_BY_AXIS.map((faceValue) => {
    const texture = createFaceTexture(faceValue)
    return new THREE.MeshPhysicalMaterial({
      map: texture,
      color: '#ffffff',
      roughness: 0.045,
      metalness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.018,
      reflectivity: 1,
      envMapIntensity: 1.6,
      emissive: '#5e0000',
      emissiveIntensity: 0.1
    })
  })
}

function createDiceMesh(index) {
  const geometry = new RoundedBoxGeometry(1.22, 1.22, 1.22, 6, 0.2)
  const mesh = new THREE.Mesh(geometry, createDiceMaterials())

  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(-1.62 + index * 1.62, 0.62, 0.08)
  mesh.userData.baseY = 0.62
  mesh.userData.targetFace = 1

  const idleYaw = (index - 1) * 0.1
  mesh.rotation.set(0.05, idleYaw, 0)
  return mesh
}

function getResultSignature(values = []) {
  return Array.isArray(values) && values.length === 3 ? values.join('-') : ''
}

function applyFinalFace(mesh, faceValue) {
  mesh.quaternion.copy(getFaceQuaternion(faceValue))
  mesh.rotation.setFromQuaternion(mesh.quaternion)
  mesh.userData.targetFace = faceValue
}

function setResult(result = []) {
  const values = normalizeResultArray(result)
  stableResult.value = values
  lastAnimatedSignature.value = getResultSignature(values)
  if (values.length !== 3 || diceMeshes.length !== 3) return

  for (let index = 0; index < diceMeshes.length; index += 1) {
    const mesh = diceMeshes[index]
    applyFinalFace(mesh, values[index])
    mesh.position.y = mesh.userData.baseY
  }
  glowStrength.value = 0
}

function resetWaiting() {
  stableResult.value = []
  previewSpinActive.value = false
  glowStrength.value = 0
  lastAnimatedSignature.value = ''
  activeRollState.id += 1
  activeRollState.dice = []

  for (let index = 0; index < diceMeshes.length; index += 1) {
    const mesh = diceMeshes[index]
    mesh.position.y = mesh.userData.baseY
    const idleYaw = (index - 1) * 0.1
    mesh.rotation.set(0.04, idleYaw, 0)
  }
}

function rollTo(result = [], options = {}) {
  const values = normalizeResultArray(result)
  if (values.length !== 3 || diceMeshes.length !== 3) return Promise.resolve()
  lastAnimatedSignature.value = getResultSignature(values)

  const duration = Math.min(Math.max(Number(options.duration || 1200), 900), 1800)
  const animationId = activeRollState.id + 1

  activeRollState.id = animationId
  activeRollState.startAt = performance.now()
  activeRollState.duration = duration
  activeRollState.dice = []
  previewSpinActive.value = false
  glowStrength.value = 0
  diceSound.playShake()

  for (let index = 0; index < diceMeshes.length; index += 1) {
    const mesh = diceMeshes[index]
    const targetQuaternion = getFaceQuaternion(values[index])
    const startQuaternion = mesh.quaternion.clone()
    const spinQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        Math.PI * (5.4 + Math.random() * 1.8),
        Math.PI * (7.1 + Math.random() * 2.2),
        Math.PI * (4.8 + Math.random() * 1.6)
      )
    )
    const midQuaternion = spinQuaternion.multiply(startQuaternion.clone())

      activeRollState.dice.push({
        mesh,
        value: values[index],
        startQuaternion,
        midQuaternion,
        targetQuaternion,
        wobbleSeed: Math.random() * Math.PI * 2
      })
  }

  return new Promise((resolve) => {
    const checkDone = () => {
      if (activeRollState.id !== animationId || activeRollState.dice.length === 0) {
        resolve(values)
        return
      }
      frameId = requestAnimationFrame(checkDone)
    }
    checkDone()
  })
}

function updateCamera(progress) {
  if (!camera) return
  const zoomPulse = Math.sin(progress * Math.PI) * 0.12
  camera.position.set(cameraBasePosition.x, cameraBasePosition.y, cameraBasePosition.z - zoomPulse)
  camera.lookAt(cameraLookAt)
}

function updateRollState(now) {
  if (!activeRollState.dice.length) return

  const elapsed = now - activeRollState.startAt
  const progress = Math.min(1, elapsed / activeRollState.duration)
  const rollPhaseEnd = 0.72
  updateCamera(progress)

  let allSettled = true

  for (const dieState of activeRollState.dice) {
    const { mesh } = dieState
    if (!mesh) continue

    if (progress < rollPhaseEnd) {
      allSettled = false
      const t = easeOutCubic(progress / rollPhaseEnd)
      mesh.quaternion.slerpQuaternions(dieState.startQuaternion, dieState.midQuaternion, t)
    } else {
      const t = easeOutQuart((progress - rollPhaseEnd) / (1 - rollPhaseEnd))
      mesh.quaternion.slerpQuaternions(dieState.midQuaternion, dieState.targetQuaternion, t)
      if (t < 1) {
        allSettled = false
      }
    }

    mesh.position.y = mesh.userData.baseY
  }

  glowStrength.value = progress > 0.92 ? ((progress - 0.92) / 0.08) * 0.85 : 0

  if (progress >= 1 || allSettled) {
    diceSound.stopShake()
    diceSound.playStop()

    for (const dieState of activeRollState.dice) {
      dieState.mesh.quaternion.copy(getFaceQuaternion(dieState.value))
      dieState.mesh.rotation.setFromQuaternion(dieState.mesh.quaternion)
      dieState.mesh.position.y = dieState.mesh.userData.baseY
    }

    stableResult.value = activeRollState.dice.map((item) => item.value)
    activeRollState.dice = []
    updateCamera(0)

    setTimeout(() => {
      if (!previewSpinActive.value) glowStrength.value = 0
    }, 280)
  }
}

function updateRollingPreview(now) {
  if (!previewSpinActive.value || activeRollState.dice.length || !diceMeshes.length) return

  const time = now / 1000
  for (let index = 0; index < diceMeshes.length; index += 1) {
    const mesh = diceMeshes[index]
    const spin = time * (2.8 + index * 0.22)
    mesh.rotation.x = 0.22 + Math.sin(spin * 0.7) * 0.1
    mesh.rotation.y = spin + index * 0.9
    mesh.rotation.z = Math.cos(spin * 0.62) * 0.08
    mesh.position.y = mesh.userData.baseY
  }

  glowStrength.value = 0.18 + Math.abs(Math.sin(time * 2.8)) * 0.12
}

function syncPreviewSpin() {
  const nextActive =
    Boolean(props.rolling) &&
    Number(props.countdown || 0) <= 10 &&
    Number(props.countdown || 0) > 0 &&
    !activeRollState.dice.length

  if (previewSpinActive.value === nextActive) return
  previewSpinActive.value = nextActive

  if (!nextActive && stableResult.value.length === 3) {
    setResult(stableResult.value)
  }
}

function resizeRenderer() {
  if (!renderer || !camera || !canvasRef.value) return
  const width = canvasRef.value.clientWidth
  const height = canvasRef.value.clientHeight
  if (!width || !height) return

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function renderFrame(now = 0) {
  updateRollingPreview(now)
  updateRollState(now)
  renderer.render(scene, camera)
  frameId = requestAnimationFrame(renderFrame)
}

function createTable() {
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 3.4),
    new THREE.ShadowMaterial({
      color: '#000000',
      opacity: 0.34
    })
  )
  shadowCatcher.rotation.x = -Math.PI / 2
  shadowCatcher.position.y = 0.01
  shadowCatcher.receiveShadow = true
  scene.add(shadowCatcher)
}

function initScene() {
  if (!canvasRef.value) return

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100)
  camera.position.copy(cameraBasePosition)
  camera.lookAt(cameraLookAt)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.82

  const hemi = new THREE.HemisphereLight('#fffef7', '#244569', 1.68)
  scene.add(hemi)

  const key = new THREE.SpotLight('#fff8ef', 4.25, 34, Math.PI / 5, 0.22, 1)
  key.position.set(-0.35, 7.2, 5.4)
  key.target.position.set(0, 0.38, 0.1)
  key.castShadow = true
  key.shadow.mapSize.width = 1024
  key.shadow.mapSize.height = 1024
  key.shadow.bias = -0.00008
  scene.add(key)
  scene.add(key.target)

  const warm = new THREE.DirectionalLight('#ffd4d4', 1.85)
  warm.position.set(-3.2, 2.8, 2.4)
  scene.add(warm)

  const fill = new THREE.DirectionalLight('#fff7f2', 1.85)
  fill.position.set(3.2, 3.2, 4.4)
  scene.add(fill)

  const rim = new THREE.DirectionalLight('#ff5c5c', 1.2)
  rim.position.set(0.8, 3.2, -3.3)
  scene.add(rim)

  createTable()

  for (let index = 0; index < 3; index += 1) {
    const mesh = createDiceMesh(index)
    scene.add(mesh)
    diceMeshes.push(mesh)
  }

  resizeRenderer()
  renderFrame()
  resetWaiting()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeRenderer())
    resizeObserver.observe(canvasRef.value)
  } else {
    window.addEventListener('resize', resizeRenderer)
  }
}

function disposeScene() {
  if (frameId) {
    cancelAnimationFrame(frameId)
    frameId = 0
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  } else {
    window.removeEventListener('resize', resizeRenderer)
  }

  if (scene) {
    scene.traverse((item) => {
      if (item.geometry) item.geometry.dispose?.()
      if (item.material) {
        const materials = Array.isArray(item.material) ? item.material : [item.material]
        for (const material of materials) {
          if (material?.map) material.map.dispose?.()
          material?.dispose?.()
        }
      }
    })
  }

  renderer?.dispose()
  renderer = null
  scene = null
  camera = null
  diceMeshes.length = 0
  activeRollState.id += 1
  activeRollState.dice = []
  diceSound.destroy()
}

onMounted(() => {
  initScene()
  const values = normalizeResultArray(props.result)
  if (values.length === 3) setResult(values)
  syncPreviewSpin()
})

onBeforeUnmount(() => {
  disposeScene()
})

watch(
  () => props.result,
  (nextResult) => {
    const values = normalizeResultArray(nextResult)
    const signature = getResultSignature(values)
    if (!signature) {
      if (!props.rolling) {
        resetWaiting()
      }
      return
    }

    if (signature === lastAnimatedSignature.value && stableResult.value.length === 3) {
      syncPreviewSpin()
      return
    }

    void rollTo(values).finally(() => {
      syncPreviewSpin()
    })
  },
  { deep: true }
)

watch(
  [() => props.rolling, () => props.countdown],
  () => {
    syncPreviewSpin()
  }
)

defineExpose({
  rollTo,
  setResult,
  resetWaiting
})
</script>

<style scoped>
.dice3d-wrap {
  position: relative;
  width: 100%;
  height: 176px;
  min-height: 164px;
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 35%, rgba(51, 179, 255, 0.22), transparent 42%),
    linear-gradient(180deg, #10264c 0%, #06152e 100%);
  box-shadow:
    inset 0 0 0 2px rgba(31, 136, 255, 0.22),
    inset 0 12px 28px rgba(255, 255, 255, 0.06),
    0 16px 34px rgba(0, 0, 0, 0.22);
}

.dice3d-table {
  position: absolute;
  inset: 8px;
  z-index: 1;
}

.dice3d-table__frame {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 30%, rgba(0, 212, 255, 0.12), transparent 42%),
    linear-gradient(180deg, #142a50 0%, #071427 100%);
  box-shadow:
    inset 0 0 0 2px rgba(0, 212, 255, 0.18),
    inset 0 10px 24px rgba(255, 255, 255, 0.08);
}

.dice3d-table__lane-glow {
  position: absolute;
  left: 18px;
  right: 18px;
  top: 18px;
  bottom: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  pointer-events: none;
}

.dice3d-table__lane-glow-cell {
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 62%, rgba(0, 212, 255, 0.22), rgba(0, 212, 255, 0.08) 42%, rgba(0, 0, 0, 0) 74%),
    linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0, 212, 255, 0.03));
  box-shadow:
    inset 0 0 0 1px rgba(0, 212, 255, 0.13),
    0 0 22px rgba(0, 212, 255, 0.12);
}

.dice3d-table__wall {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 10px;
  height: 92px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.dice3d-table__wall-panel {
  position: relative;
  border-radius: 4px 4px 0 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 36%),
    linear-gradient(180deg, #29374e 0%, #172236 100%);
  border: 1px solid rgba(15, 32, 62, 0.78);
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.dice3d-table__wall-panel::before,
.dice3d-table__wall-panel::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.18));
  opacity: 0.55;
}

.dice3d-table__wall-panel::before {
  left: 0;
  transform: skewX(6deg);
}

.dice3d-table__wall-panel::after {
  right: 0;
  transform: skewX(-6deg);
}

.dice3d-table__floor {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 14px;
  height: 74px;
  background:
    radial-gradient(circle at 50% 16%, rgba(255, 255, 255, 0.12), transparent 38%),
    radial-gradient(circle at 50% 72%, rgba(0, 212, 255, 0.18), transparent 62%),
    linear-gradient(180deg, #142f68 0%, #0d1738 54%, #07142d 100%);
  clip-path: polygon(7% 0%, 93% 0%, 100% 100%, 0% 100%);
  box-shadow:
    inset 0 12px 18px rgba(255, 255, 255, 0.06),
    inset 0 -14px 18px rgba(0, 0, 0, 0.34),
    inset 0 0 12px rgba(0, 212, 255, 0.1),
    0 0 20px rgba(0, 212, 255, 0.2);
}

.dice3d-table__divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  background: linear-gradient(180deg, rgba(0, 212, 255, 0.16) 0%, rgba(2, 8, 24, 0.62) 100%);
  box-shadow:
    inset 1px 0 0 rgba(255,255,255,0.08),
    inset -1px 0 0 rgba(0,0,0,0.36),
    0 0 12px rgba(0, 212, 255, 0.12);
}

.dice3d-table__divider--left {
  left: 32.05%;
}

.dice3d-table__divider--right {
  right: 32.05%;
}

.dice3d-canvas {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
}

.dice3d-glow {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 58%, rgba(255, 46, 46, 0.16), transparent 45%),
    radial-gradient(circle at 50% 30%, rgba(255, 248, 212, 0.14), transparent 45%),
    radial-gradient(circle at 50% 60%, rgba(0, 212, 255, 0.12), transparent 52%);
  transition: opacity 0.2s ease-out;
}

.dice3d-waiting {
  position: absolute;
  left: 50%;
  bottom: 8px;
  z-index: 4;
  transform: translateX(-50%);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 11px;
  font-weight: 700;
  color: #ecf4ff;
  background: rgba(4, 24, 58, 0.86);
  border: 1px solid rgba(150, 208, 255, 0.45);
  white-space: nowrap;
}

@media (max-width: 420px) {
  .dice3d-wrap {
    height: 166px;
  }
}
</style>
