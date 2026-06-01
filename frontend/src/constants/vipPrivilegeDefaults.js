export const VIP_PRIVILEGE_DEFAULT_TITLE = 'Đặc quyền thành viên VIP'
export const VIP_PRIVILEGE_DEFAULT_SUBTITLE = 'Nạp càng nhiều - Đặc quyền càng lớn - Lợi ích càng cao'

export const VIP_PRIVILEGE_DEFAULT_ROWS = Object.freeze([
  { tich_luy: '', cap: '', thuong: '', han_muc: '' }
])

export function cloneVipPrivilegeRows(rows = VIP_PRIVILEGE_DEFAULT_ROWS) {
  return rows.map((row) => ({
    tich_luy: String(row?.tich_luy ?? row?.accumulated ?? ''),
    cap: String(row?.cap ?? row?.level ?? ''),
    thuong: String(row?.thuong ?? row?.reward ?? ''),
    han_muc: String(row?.han_muc ?? row?.limit ?? '')
  }))
}

function normalizeMoneyText(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const compact = raw.replace(/\s/g, '')
  if (!/^[\d.,]+[$₫đĐ]?$/.test(compact)) return raw
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return raw
  return `${new Intl.NumberFormat('vi-VN').format(Number(digits))}$`
}

function normalizeVipLevel(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (/^vip\s*\d+/i.test(raw)) return raw.toUpperCase().replace(/\s+/, ' ')
  if (/^\d+$/.test(raw)) return `VIP ${raw}`
  return raw
}

export function normalizeVipPrivilegeTitle(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.toLowerCase() === 'nâng cấp đặc quyền vip') {
    return VIP_PRIVILEGE_DEFAULT_TITLE
  }
  return raw
}

export function normalizeVipPrivilegeSubtitle(value) {
  const raw = String(value ?? '').trim()
  if (!raw || raw.toLowerCase() === 'bảng tích lũy thưởng nạp khi nâng cấp vip:') {
    return VIP_PRIVILEGE_DEFAULT_SUBTITLE
  }
  return raw
}

function getVipSortValue(row, fallbackIndex) {
  const candidates = [row?.sort_order, row?.sortOrder, row?.order, row?.level, row?.cap]
  for (const value of candidates) {
    const matched = String(value ?? '').match(/\d+/)
    if (matched) return Number(matched[0])
  }
  return fallbackIndex
}

function isVipRowVisible(row) {
  if (!row) return false
  if (row.active === false || row.enabled === false) return false
  const status = String(row.status ?? '').trim().toLowerCase()
  if (['inactive', 'disabled', 'off', 'hidden'].includes(status)) return false
  return true
}

export function toVipPrivilegeDisplayRows(rows = []) {
  const source = Array.isArray(rows) ? rows : []
  return source
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isVipRowVisible(row))
    .sort((a, b) => getVipSortValue(a.row, a.index) - getVipSortValue(b.row, b.index))
    .map(({ row }) => ({
      tich_luy: normalizeMoneyText(row?.tich_luy ?? row?.accumulated),
      cap: normalizeVipLevel(row?.cap ?? row?.level),
      thuong: normalizeMoneyText(row?.thuong ?? row?.reward),
      han_muc: normalizeMoneyText(row?.han_muc ?? row?.limit)
    }))
    .filter((row) => row.tich_luy && row.cap && row.thuong && row.han_muc)
}
