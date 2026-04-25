<template>
  <div class="dice3d-wrap">
    <div class="dice3d-lanes" aria-hidden="true">
      <div class="dice3d-lane"></div>
      <div class="dice3d-lane"></div>
      <div class="dice3d-lane"></div>
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
  }
})

const canvasRef = ref(null)
const rollingState = ref(false)
const stableResult = ref([])
const glowStrength = ref(0)
const waitingLabel = computed(() => {
  if (rollingState.value) return 'Đang lắc xúc xắc...'
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

let scene = null
let camera = null
let renderer = null
let frameId = 0
let resizeObserver = null

const cameraBasePosition = new THREE.Vector3(0, 2.16, 8.2)
const cameraLookAt = new THREE.Vector3(0, 0.52, 0)

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
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')

  context.clearRect(0, 0, canvas.width, canvas.height)

  const baseGradient = context.createLinearGradient(0, 0, 512, 512)
  baseGradient.addColorStop(0, '#ff7663')
  baseGradient.addColorStop(0.48, '#f23125')
  baseGradient.addColorStop(1, '#b91012')
  context.fillStyle = baseGradient
  drawRoundedRect(context, 10, 10, 492, 492, 78)
  context.fill()

  const highlight = context.createLinearGradient(0, 0, 0, 270)
  highlight.addColorStop(0, 'rgba(255,255,255,0.46)')
  highlight.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = highlight
  drawRoundedRect(context, 20, 20, 472, 220, 66)
  context.fill()

  context.fillStyle = '#f8fbff'
  context.shadowColor = 'rgba(0,0,0,0.24)'
  context.shadowBlur = 10
  context.shadowOffsetY = 3

  for (const [x, y] of getPipPattern(faceValue)) {
    context.beginPath()
    context.arc(256 + x, 256 + y, 34, 0, Math.PI * 2)
    context.fill()
    context.lineWidth = 2
    context.strokeStyle = 'rgba(94, 120, 152, 0.38)'
    context.stroke()
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
      roughness: 0.2,
      metalness: 0.06,
      clearcoat: 0.74,
      clearcoatRoughness: 0.08
    })
  })
}

function createDiceMesh(index) {
  const geometry = new RoundedBoxGeometry(1.2, 1.2, 1.2, 4, 0.14)
  const mesh = new THREE.Mesh(geometry, createDiceMaterials())

  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(-2.02 + index * 2.02, 0.72, 0)
  mesh.userData.baseY = 0.72
  mesh.userData.targetFace = 1

  const idleYaw = (index - 1) * 0.1
  mesh.rotation.set(0.04, idleYaw, 0)
  return mesh
}

function applyFinalFace(mesh, faceValue) {
  mesh.quaternion.copy(getFaceQuaternion(faceValue))
  mesh.rotation.setFromQuaternion(mesh.quaternion)
  mesh.userData.targetFace = faceValue
}

function setResult(result = []) {
  const values = normalizeResultArray(result)
  stableResult.value = values
  if (values.length !== 3 || diceMeshes.length !== 3) return

  for (let index = 0; index < diceMeshes.length; index += 1) {
    const mesh = diceMeshes[index]
    applyFinalFace(mesh, values[index])
    mesh.position.y = mesh.userData.baseY
  }
}

function resetWaiting() {
  stableResult.value = []
  rollingState.value = false
  glowStrength.value = 0
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

  const duration = Math.min(Math.max(Number(options.duration || 1450), 1200), 1700)
  const animationId = activeRollState.id + 1

  activeRollState.id = animationId
  activeRollState.startAt = performance.now()
  activeRollState.duration = duration
  activeRollState.dice = []
  rollingState.value = true
  stableResult.value = []
  glowStrength.value = 0
  diceSound.playShake()

  for (let index = 0; index < diceMeshes.length; index += 1) {
    const mesh = diceMeshes[index]
    const targetQuaternion = getFaceQuaternion(values[index])
    const startQuaternion = mesh.quaternion.clone()
    const spinQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        Math.PI * (3.1 + Math.random() * 1.2),
        Math.PI * (4.4 + Math.random() * 1.5),
        Math.PI * (2.1 + Math.random() * 1.2)
      )
    )
    const midQuaternion = spinQuaternion.multiply(startQuaternion.clone())

    activeRollState.dice.push({
      mesh,
      value: values[index],
      startQuaternion,
      midQuaternion,
      targetQuaternion,
      bounceAmp: 0.18 + Math.random() * 0.06,
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

    const oscillation = Math.sin(progress * Math.PI * (7 + dieState.value) + dieState.wobbleSeed)
    const bounce = Math.abs(oscillation) * dieState.bounceAmp * (1 - progress)
    mesh.position.y = mesh.userData.baseY + bounce
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
    rollingState.value = false
    updateCamera(0)

    setTimeout(() => {
      if (!rollingState.value) glowStrength.value = 0
    }, 280)
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
  updateRollState(now)
  renderer.render(scene, camera)
  frameId = requestAnimationFrame(renderFrame)
}

function createTable() {
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 3.2),
    new THREE.MeshStandardMaterial({
      color: '#2f8f47',
      roughness: 0.62,
      metalness: 0.04
    })
  )
  table.rotation.x = -Math.PI / 2
  table.position.y = 0
  table.receiveShadow = true
  scene.add(table)

  const lane1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.1, 3.2),
    new THREE.MeshStandardMaterial({ color: '#103b1e', roughness: 0.7 })
  )
  lane1.position.set(-1.34, 0.05, 0)
  lane1.receiveShadow = true
  scene.add(lane1)

  const lane2 = lane1.clone()
  lane2.position.x = 1.34
  scene.add(lane2)

  const backFade = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.7),
    new THREE.MeshBasicMaterial({
      color: '#1a1f2b',
      transparent: true,
      opacity: 0.56
    })
  )
  backFade.position.set(0, 1.34, -1.45)
  scene.add(backFade)
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
  renderer.toneMappingExposure = 1.3

  const hemi = new THREE.HemisphereLight('#eaf3ff', '#1d2c45', 1.05)
  scene.add(hemi)

  const key = new THREE.SpotLight('#ffffff', 2.8, 30, Math.PI / 5.2, 0.35, 1.3)
  key.position.set(0, 6.8, 5.2)
  key.target.position.set(0, 0.45, 0)
  key.castShadow = true
  key.shadow.mapSize.width = 1024
  key.shadow.mapSize.height = 1024
  scene.add(key)
  scene.add(key.target)

  const warm = new THREE.DirectionalLight('#ffd66b', 0.62)
  warm.position.set(-2.8, 2.2, 1.4)
  scene.add(warm)

  const fill = new THREE.DirectionalLight('#dff1ff', 0.78)
  fill.position.set(2.2, 2.8, 3.4)
  scene.add(fill)

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
})

onBeforeUnmount(() => {
  disposeScene()
})

watch(
  () => props.rolling,
  (nextRolling) => {
    if (nextRolling) {
      rollingState.value = true
      return
    }
    if (!activeRollState.dice.length) rollingState.value = false
  }
)

watch(
  () => props.result,
  (nextResult) => {
    const values = normalizeResultArray(nextResult)
    if (props.rolling) return
    if (values.length === 3) {
      setResult(values)
      return
    }
    resetWaiting()
  },
  { deep: true }
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
  height: 166px;
  min-height: 154px;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #132236 0%, #0e1725 100%);
  box-shadow: inset 0 0 0 2px rgba(27, 34, 51, 0.92);
}

.dice3d-lanes {
  position: absolute;
  inset: 6px;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.dice3d-lane {
  border-radius: 4px;
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0)),
    linear-gradient(180deg, #323843 0%, #1c202a 100%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.35);
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
    radial-gradient(circle at 50% 58%, rgba(120, 255, 173, 0.2), transparent 48%),
    radial-gradient(circle at 50% 34%, rgba(255, 216, 112, 0.2), transparent 45%);
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
    height: 158px;
  }
}
</style>
