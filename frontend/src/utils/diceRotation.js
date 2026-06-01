import * as THREE from 'three'

export const FACE_ROTATION = Object.freeze({
  1: Object.freeze({ x: 0, y: 0, z: 0 }),
  2: Object.freeze({ x: Math.PI / 2, y: 0, z: 0 }),
  3: Object.freeze({ x: 0, y: -Math.PI / 2, z: 0 }),
  4: Object.freeze({ x: 0, y: Math.PI / 2, z: 0 }),
  5: Object.freeze({ x: -Math.PI / 2, y: 0, z: 0 }),
  6: Object.freeze({ x: 0, y: Math.PI, z: 0 })
})

// BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
export const FACE_TEXTURE_BY_AXIS = Object.freeze([3, 4, 2, 5, 1, 6])

export function normalizeFaceValue(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 6) {
    return null
  }

  return numeric
}

export function normalizeResultArray(result) {
  if (!Array.isArray(result) || result.length !== 3) {
    return []
  }

  const normalized = result.map((value) => normalizeFaceValue(value))
  return normalized.every((value) => value !== null) ? normalized : []
}

export function getFaceEuler(faceValue) {
  const item = FACE_ROTATION[Number(faceValue)] || FACE_ROTATION[1]
  return new THREE.Euler(item.x, item.y, item.z, 'XYZ')
}

export function getFaceQuaternion(faceValue) {
  return new THREE.Quaternion().setFromEuler(getFaceEuler(faceValue))
}

export function easeOutCubic(value) {
  const t = Math.min(Math.max(value, 0), 1)
  return 1 - (1 - t) ** 3
}

export function easeOutQuart(value) {
  const t = Math.min(Math.max(value, 0), 1)
  return 1 - (1 - t) ** 4
}
