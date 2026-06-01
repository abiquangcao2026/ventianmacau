const express = require('express')
const demoConfigService = require('../services/demoConfigService')
const SiteConfig = require('../models/SiteConfig')
const { ensureRoomState, buildRoundStatePayload } = require('../socket/sicbo')

const router = express.Router()

function normalizeVipPrivilegeRow(input = {}) {
  return {
    tich_luy: String(input.tich_luy ?? input.accumulated ?? '').trim(),
    cap: String(input.cap ?? input.level ?? '').trim(),
    thuong: String(input.thuong ?? input.reward ?? '').trim(),
    han_muc: String(input.han_muc ?? input.limit ?? '').trim(),
    sort_order: input.sort_order ?? input.sortOrder ?? input.order,
    active: input.active,
    enabled: input.enabled,
    status: input.status
  }
}

function normalizeVipPrivilegeRows(rows, fallbackRows = []) {
  const source = Array.isArray(rows) && rows.length ? rows : fallbackRows
  return source.map((item) => normalizeVipPrivilegeRow(item))
}

router.get('/sicbo-config', async (req, res) => {
  const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'sicbo-3p'
  let maintenanceEnabled = false
  let maintenanceMessage = 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.'

  try {
    let config = await SiteConfig.findOne({ key: 'main' }).lean()
    if (!config) {
      config = await SiteConfig.create({ key: 'main' })
      config = config.toObject()
    }
    maintenanceEnabled = Boolean(config?.sicboMaintenanceEnabled)
    maintenanceMessage = String(config?.sicboMaintenanceMessage || maintenanceMessage).trim() || maintenanceMessage
  } catch {
    /* ignore config lookup errors here and fall back to default */
  }

  return res.json({
    config: {
      ...demoConfigService.getSicboConfig(roomId),
      maintenanceEnabled,
      maintenanceMessage
    }
  })
})

router.get('/sicbo-state', async (req, res) => {
  const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : 'sicbo-3p'
  const state = await ensureRoomState(roomId)

  return res.json({
    state: buildRoundStatePayload(state)
  })
})

router.get('/vip-privileges', async (req, res) => {
  try {
    let config = await SiteConfig.findOne({ key: 'main' }).lean()
    if (!config) {
      config = await SiteConfig.create({ key: 'main' })
      config = config.toObject()
    }

    return res.json({
      title: String(config.vipPrivilegeTitle || 'Đặc quyền thành viên VIP'),
      subtitle: String(config.vipPrivilegeSubtitle || 'Nạp càng nhiều - Đặc quyền càng lớn - Lợi ích càng cao'),
      rows: normalizeVipPrivilegeRows(config.vipPrivilegeRows, SiteConfig.defaultVipPrivilegeRows())
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Không thể tải bảng đặc quyền VIP' })
  }
})

module.exports = router
