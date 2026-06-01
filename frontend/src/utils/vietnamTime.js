export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export function formatDateTimeVN(value, options = {}) {
  if (!value) return '--'
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  })
}

export function formatTimeVN(value, options = {}) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options
  })
}

export function getVietnamDayKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value))
}

export function isSameVietnamDay(left, right = new Date()) {
  if (!left) return false
  return getVietnamDayKey(left) === getVietnamDayKey(right)
}
