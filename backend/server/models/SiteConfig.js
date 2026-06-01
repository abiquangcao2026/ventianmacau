const mongoose = require('mongoose')

const vipPrivilegeRowSchema = new mongoose.Schema(
  {
    tich_luy: { type: String, default: '' },
    cap: { type: String, default: '' },
    thuong: { type: String, default: '' },
    han_muc: { type: String, default: '' }
  },
  { _id: false }
)

const defaultVipPrivilegeRows = Object.freeze([
  { tich_luy: '', cap: '', thuong: '', han_muc: '' }
])

const siteConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    // Odds
    oddsDoi: { type: String, default: '1.98' },
    oddsXs3p: { type: String, default: '1.98' },
    oddsHaiTrung3p: { type: String, default: '1.98' },
    oddsBaTrung3p: { type: String, default: '1.98' },
    oddsLoiCltx3p: { type: String, default: '1.98' },
    oddsXs5p: { type: String, default: '1.98' },
    oddsHaiTrung5p: { type: String, default: '1.98' },
    oddsBaTrung5p: { type: String, default: '1.98' },
    oddsLoiCltx5p: { type: String, default: '1.98' },
    oddsLoiKeno5p: { type: String, default: '2.3' },
    // Site
    referralCode: { type: String, default: '' },
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    homeBanner: { type: String, default: 'CHÀO MỪNG BẠN ĐẾN THE VENETIAN !' },
    siteBrandName: { type: String, default: 'THE VENETIAN' },
    siteAdminCaption: { type: String, default: 'admin.casinovenetianmacau.com' },
    siteLogoUrl: { type: String, default: '/img/the-venetian-wordmark.svg' },
    vipPrivilegeTitle: {
      type: String,
      default: 'Đặc quyền thành viên VIP'
    },
    vipPrivilegeSubtitle: {
      type: String,
      default: 'Nạp càng nhiều - Đặc quyền càng lớn - Lợi ích càng cao'
    },
    vipPrivilegeRows: {
      type: [vipPrivilegeRowSchema],
      default: () => defaultVipPrivilegeRows.map((item) => ({ ...item }))
    },
    supportWelcomeMessage: {
      type: String,
      default: 'Xin chào! Chăm sóc khách hàng đã kết nối. Vui lòng để lại nội dung, hệ thống sẽ chuyển ngay cho CSKH.'
    },
    supportWelcomeAttachmentType: {
      type: String,
      default: 'vip'
    },
    supportWelcomeAttachmentUrl: {
      type: String,
      default: ''
    },
    supportAutoReplyMessage: {
      type: String,
      default: 'CSKH đã nhận được tin nhắn của bạn. Vui lòng chờ phản hồi trong giây lát.'
    },
    supportAutoReplyAttachmentType: {
      type: String,
      default: 'none'
    },
    supportAutoReplyAttachmentUrl: {
      type: String,
      default: ''
    },
    supportAwayEnabled: {
      type: Boolean,
      default: false
    },
    supportNotifySound: {
      type: String,
      default: 'alarm'
    },
    supportNotifyVolume: {
      type: String,
      default: '80'
    },
    systemSoundMessage: {
      type: String,
      default: 'messenger'
    },
    systemSoundDeposit: {
      type: String,
      default: 'zalo'
    },
    systemSoundWithdraw: {
      type: String,
      default: 'emergency'
    },
    systemSoundFeedback: {
      type: String,
      default: 'telegram'
    },
    systemSoundAlert: {
      type: String,
      default: 'siren'
    },
    systemSoundSicbo: {
      type: String,
      default: 'classic'
    },
    adminWelcomeVoiceEnabled: {
      type: Boolean,
      default: true
    },
    adminWelcomeVoiceText: {
      type: String,
      default: 'Xin chào ông chủ - Chúng ta chuẩn bị ăn to rồi đấy nhé'
    },
    adminWelcomeVoiceVolume: {
      type: String,
      default: '100'
    },
    supportAwayMessage: {
      type: String,
      default: 'Hiện tại lượng khách truy cập vào CSKH đang rất nhiều. Số thứ tự hỗ trợ của quý khách là #{queueNumber}. Vui lòng chờ trong khoảng {etaMinutes}-{etaMaxMinutes} phút để kết nối trực tiếp với CSKH.'
    },
    supportAwayAttachmentType: {
      type: String,
      default: 'none'
    },
    supportAwayAttachmentUrl: {
      type: String,
      default: ''
    },
    supportQuickReplyOneLabel: {
      type: String,
      default: 'Đã nhận'
    },
    supportQuickReplyOne: {
      type: String,
      default: 'CSKH đã nhận được tin nhắn của bạn.'
    },
    supportQuickReplyOneAttachmentType: {
      type: String,
      default: 'none'
    },
    supportQuickReplyOneAttachmentUrl: {
      type: String,
      default: ''
    },
    supportQuickReplyTwoLabel: {
      type: String,
      default: 'Chờ kiểm tra'
    },
    supportQuickReplyTwo: {
      type: String,
      default: 'Vui lòng chờ CSKH kiểm tra trong ít phút.'
    },
    supportQuickReplyTwoAttachmentType: {
      type: String,
      default: 'none'
    },
    supportQuickReplyTwoAttachmentUrl: {
      type: String,
      default: ''
    },
    supportQuickReplyThreeLabel: {
      type: String,
      default: 'Gửi thông tin'
    },
    supportQuickReplyThree: {
      type: String,
      default: 'Bạn vui lòng gửi hình ảnh hoặc nội dung cụ thể hơn để CSKH hỗ trợ nhanh.'
    },
    supportQuickReplyThreeAttachmentType: {
      type: String,
      default: 'none'
    },
    supportQuickReplyThreeAttachmentUrl: {
      type: String,
      default: ''
    },
    supportQuickReplyFourLabel: {
      type: String,
      default: 'Đang xử lý'
    },
    supportQuickReplyFour: {
      type: String,
      default: 'CSKH đang theo dõi yêu cầu của bạn. Vui lòng đợi trong giây lát.'
    },
    supportQuickReplyFourAttachmentType: {
      type: String,
      default: 'none'
    },
    supportQuickReplyFourAttachmentUrl: {
      type: String,
      default: ''
    },
    supportQuickReplyFiveLabel: {
      type: String,
      default: 'Gửi thêm'
    },
    supportQuickReplyFive: {
      type: String,
      default: 'Nếu cần nhanh hơn, vui lòng gửi rõ nội dung, hình ảnh hoặc mã giao dịch.'
    },
    supportQuickReplyFiveAttachmentType: {
      type: String,
      default: 'none'
    },
    supportQuickReplyFiveAttachmentUrl: {
      type: String,
      default: ''
    },
    supportQuickReplyVipLabel: {
      type: String,
      default: 'Bảng VIP'
    },
    supportQuickReplyVipAttachmentType: {
      type: String,
      default: 'vip'
    },
    supportQuickReplyVipAttachmentUrl: {
      type: String,
      default: ''
    },
    kenoMaintenanceEnabled: {
      type: Boolean,
      default: true
    },
    kenoMaintenanceMessage: {
      type: String,
      default: 'Game KENO đang bảo trì. Vui lòng quay lại sau.'
    },
    sicboMaintenanceEnabled: {
      type: Boolean,
      default: false
    },
    sicboMaintenanceMessage: {
      type: String,
      default: 'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.'
    }
  },
  { timestamps: true }
)

siteConfigSchema.statics.defaultVipPrivilegeRows = function defaultRows() {
  return defaultVipPrivilegeRows.map((item) => ({ ...item }))
}

module.exports = mongoose.model('SiteConfig', siteConfigSchema)
