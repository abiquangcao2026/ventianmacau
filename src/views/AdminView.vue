<template>
  <section class="admin-layout">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
      <div class="sidebar__brand">
        <div class="sidebar__brand-info">
          <img alt="The Venetian® Macau" src="/img/the-venetian-wordmark.svg" class="sidebar__logo" />
          <span class="sidebar__domain">admin.casinovenetianmacau.com</span>
        </div>
        <button class="sidebar__close" @click="sidebarOpen = false">✕</button>
      </div>

      <nav class="sidebar__nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="sidebar__link"
          :class="{ 'sidebar__link--active': activeTab === tab.key }"
          @click="activeTab = tab.key; sidebarOpen = false"
        >
          <span class="sidebar__link-icon" v-html="tab.icon"></span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <div class="sidebar__footer">
        <button class="sidebar__link sidebar__link--logout" @click="handleLogout">
          <span class="sidebar__link-icon">⏻</span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>

    <!-- Overlay for mobile -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- Main content -->
    <div class="admin-content">
      <!-- Top bar -->
      <header class="topbar">
        <button class="topbar__hamburger" @click="sidebarOpen = true">
          <span></span><span></span><span></span>
        </button>
        <div class="topbar__breadcrumb">
          <span>Admin</span>
          <span class="topbar__breadcrumb-sep">/</span>
          <strong>{{ currentTabLabel }}</strong>
        </div>
        <div class="topbar__actions">
          <button class="topbar__refresh" :disabled="loadingAll" @click="loadAllData">
            {{ loadingAll ? '⟳' : '↻' }} Đồng bộ
          </button>
          <div class="topbar__user">
            <span>{{ userStore.user?.username || 'Admin' }}</span>
          </div>
        </div>
      </header>

      <!-- Dashboard Stats (always visible) -->
      <div v-if="activeTab === 'dashboard'" class="admin-panel">
        <div class="stats-row">
          <div class="stat-card stat-card--blue">
            <span class="stat-card__label">Tổng user</span>
            <strong class="stat-card__value">{{ overview.stats.totalUsers }}</strong>
          </div>
          <div class="stat-card stat-card--green">
            <span class="stat-card__label">Đang hoạt động</span>
            <strong class="stat-card__value">{{ overview.stats.activeUsers }}</strong>
          </div>
          <div class="stat-card stat-card--orange">
            <span class="stat-card__label">Chờ xử lý</span>
            <strong class="stat-card__value">{{ overview.stats.pendingTransactions }}</strong>
          </div>
          <div class="stat-card stat-card--purple">
            <span class="stat-card__label">Doanh thu game</span>
            <strong class="stat-card__value">{{ formatMoney(revenue.netGamingRevenue) }}</strong>
          </div>
        </div>

        <div class="stats-row stats-row--secondary">
          <div class="stat-card stat-card--teal">
            <span class="stat-card__label">Tổng nạp</span>
            <strong class="stat-card__value">{{ formatMoney(revenue.totalDeposit) }}</strong>
          </div>
          <div class="stat-card stat-card--red">
            <span class="stat-card__label">Tổng rút</span>
            <strong class="stat-card__value">{{ formatMoney(revenue.totalWithdraw) }}</strong>
          </div>
        </div>

        <!-- Pending transactions -->
        <div class="panel-card">
          <div class="panel-card__header">
            <h3>Yêu cầu chờ duyệt</h3>
            <span class="badge badge--warning">{{ overview.pendingTransactions.length }}</span>
          </div>
          <div v-if="overview.pendingTransactions.length === 0" class="panel-card__empty">
            Không có yêu cầu chờ xử lý.
          </div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>Người chơi</th>
                <th>Loại</th>
                <th>Số tiền</th>
                <th>Thời gian</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in overview.pendingTransactions" :key="item._id">
                <td>{{ item.userId?.fullName || item.userId?.username || 'N/A' }}</td>
                <td>{{ formatTransactionType(item.type) }}</td>
                <td class="text-bold">{{ formatMoney(item.amount) }}</td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn--success btn--sm" @click="reviewTransaction(item._id, 'approve')">Duyệt</button>
                    <button class="btn btn--danger btn--sm" @click="reviewTransaction(item._id, 'reject')">Từ chối</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Game Summary -->
      <div v-if="activeTab === 'game-summary'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Tổng quan game</h3><span class="badge">{{ gameSummary.length }} room</span></div>
          <div v-if="gameSummary.length === 0" class="panel-card__empty">Chưa có dữ liệu game.</div>
          <div v-else class="summary-cards">
            <div v-for="room in gameSummary" :key="room.roomId" class="summary-card">
              <div class="summary-card__header">
                <strong>{{ formatRoomLabel(room.roomId) }}</strong>
                <span class="badge badge--info">{{ room.totalBets }} cược</span>
              </div>
              <div class="summary-card__body">
                <div class="summary-card__stat"><span>Tổng cược</span><strong>{{ formatMoney(room.totalBetAmount) }}</strong></div>
                <div class="summary-card__stat"><span>Trả thưởng</span><strong>{{ formatMoney(room.totalPayout) }}</strong></div>
                <div class="summary-card__stat"><span>Doanh thu</span><strong>{{ formatMoney(room.netGamingRevenue) }}</strong></div>
                <div class="summary-card__stat"><span>Phiên gần nhất</span><strong>{{ room.latestRoundId }}</strong></div>
              </div>
              <div v-if="room.topGates?.length" class="summary-card__gates">
                <small>Top cửa cược:</small>
                <div v-for="gate in room.topGates" :key="`${room.roomId}-${gate.gate}`" class="gate-row">
                  <span>{{ formatGateLabel(gate.gate) }}</span>
                  <span>{{ formatMoney(gate.totalAmount) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Users -->
      <div v-if="activeTab === 'users'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--with-tools">
            <h3>Người chơi</h3>
            <span class="badge">{{ filteredUsers.length }}</span>
            <input v-model.trim="userSearchKeyword" class="inline-input" placeholder="Tìm kiếm" />
          </div>
          <div v-if="filteredUsers.length === 0" class="panel-card__empty">Chưa có dữ liệu người chơi.</div>
          <div v-else class="table-scroll">
            <table class="data-table data-table--dense">
              <thead>
                <tr>
                  <th>ID USER</th>
                  <th>USERNAME</th>
                  <th>IP</th>
                  <th>MÃ GT</th>
                  <th>SỐ TIỀN</th>
                  <th>ADMIN CỘNG</th>
                  <th>ADMIN TRỪ</th>
                  <th>ADMIN THƯỞNG</th>
                  <th>TỔNG ĐẶT</th>
                  <th>TỔNG WIN</th>
                  <th>RÚT / NẠP</th>
                  <th>THƯỞNG</th>
                  <th>VIP HIỆN TẠI</th>
                  <th>CẤP VIP</th>
                  <th>XEM THÔNG TIN</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in filteredUsers" :key="member._id">
                  <td>{{ member.userCode || '--' }}</td>
                  <td>@{{ member.username }}</td>
                  <td>{{ member.lastLoginIp || '--' }}</td>
                  <td>{{ member.referredByCode || '--' }}</td>
                  <td>{{ formatMoney(member.balance) }}</td>
                  <td>{{ formatMoney(member.adminCreditTotal) }}</td>
                  <td>{{ formatMoney(member.adminDebitTotal) }}</td>
                  <td>{{ formatMoney(member.adminBonusTotal) }}</td>
                  <td>{{ formatMoney(member.totalBetAmount) }}</td>
                  <td>{{ formatMoney(member.totalWinAmount) }}</td>
                  <td>
                    <div class="cell-stack">
                      <input v-model="getUserDraft(member._id).adjustAmount" class="inline-input inline-input--sm" type="number" min="1" placeholder="Số tiền" />
                      <div class="action-btns action-btns--tight">
                        <button class="btn btn--success btn--sm" :disabled="isUserRowSaving(member._id)" @click="adminAdjustBalance(member._id,'credit')">Nạp</button>
                        <button class="btn btn--danger btn--sm" :disabled="isUserRowSaving(member._id)" @click="adminAdjustBalance(member._id,'debit')">Rút</button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="cell-stack">
                      <input v-model="getUserDraft(member._id).bonusAmount" class="inline-input inline-input--sm" type="number" min="1" placeholder="Số tiền" />
                      <button class="btn btn--primary btn--sm" :disabled="isUserRowSaving(member._id)" @click="adminAdjustBalance(member._id,'bonus')">Xác nhận</button>
                    </div>
                  </td>
                  <td>VIP: {{ Number(member.vipLevel || 0) }}</td>
                  <td>
                    <div class="cell-stack">
                      <input v-model="getUserDraft(member._id).vipLevel" class="inline-input inline-input--sm" type="number" min="0" placeholder="0" />
                      <button class="btn btn--primary btn--sm" :disabled="isUserRowSaving(member._id)" @click="adminSetVip(member._id)">Xác nhận</button>
                    </div>
                  </td>
                  <td>
                    <div class="action-btns action-btns--tight">
                      <button v-if="member.role !== 'admin' && member.status === 'active'" class="btn btn--danger btn--sm" @click="toggleUserStatus(member._id, 'locked')">Khóa</button>
                      <button v-else-if="member.role !== 'admin'" class="btn btn--success btn--sm" @click="toggleUserStatus(member._id, 'active')">Mở</button>
                      <button class="btn btn--primary btn--sm" @click="loadUserDetail(member._id)">Xem</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-if="selectedUser" class="panel-card">
          <div class="panel-card__header"><h3>Chi tiết: {{ selectedUser.username }}</h3></div>
          <div class="detail-grid">
            <div><span>Username</span><strong>@{{ selectedUser.username }}</strong></div>
            <div><span>Họ tên</span><strong>{{ selectedUser.fullName || '--' }}</strong></div>
            <div><span>Điện thoại</span><strong>{{ selectedUser.phone || '--' }}</strong></div>
            <div><span>Mã mời</span><strong>{{ selectedUser.inviteCode || '--' }}</strong></div>
            <div><span>Số dư</span><strong>{{ formatMoney(selectedUser.balance) }}</strong></div>
            <div><span>Tạo lúc</span><strong>{{ formatDate(selectedUser.createdAt) }}</strong></div>
          </div>
        </div>
      </div>

      <!-- Transactions -->
      <div v-if="activeTab === 'transactions'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Giao dịch ví</h3><span class="badge">{{ transactions.length }}</span></div>
          <div v-if="transactions.length === 0" class="panel-card__empty">Chưa có giao dịch.</div>
          <table v-else class="data-table">
            <thead>
              <tr><th>Loại</th><th>User</th><th>Số tiền</th><th>Trạng thái</th><th>Số dư trước</th><th>Số dư sau</th><th>Thời gian</th></tr>
            </thead>
            <tbody>
              <tr v-for="tx in transactions" :key="tx._id">
                <td>{{ formatTransactionType(tx.type) }}</td>
                <td>{{ tx.userId?.username || 'N/A' }}</td>
                <td :class="Number(tx.amount) >= 0 ? 'text-success' : 'text-danger'">{{ Number(tx.amount) >= 0 ? '+' : '' }}{{ formatMoney(tx.amount) }}</td>
                <td><span class="badge badge--info">{{ tx.status }}</span></td>
                <td>{{ formatMoney(tx.balanceBefore) }}</td>
                <td>{{ formatMoney(tx.balanceAfter) }}</td>
                <td>{{ formatDate(tx.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Game History -->
      <div v-if="activeTab === 'game-history'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Lịch sử round Sicbo</h3><span class="badge">{{ roundHistory.length }}</span></div>
          <div v-if="roundHistory.length === 0" class="panel-card__empty">Chưa có lịch sử round.</div>
          <table v-else class="data-table">
            <thead>
              <tr><th>Room</th><th>Phiên</th><th>Kết quả</th><th>Tổng điểm</th><th>Tổng cược</th><th>Trạng thái</th><th>Thời gian</th></tr>
            </thead>
            <tbody>
              <tr v-for="round in roundHistory" :key="round._id">
                <td>{{ formatRoomLabel(round.roomId) }}</td>
                <td>{{ round.roundId }}</td>
                <td><strong>{{ Array.isArray(round.result) && round.result.length === 3 ? round.result.join(' - ') : '--' }}</strong></td>
                <td>{{ round.total }}</td>
                <td>{{ formatMoney(round.betTotalAmount) }}</td>
                <td><span class="badge badge--info">{{ round.status }}</span></td>
                <td>{{ formatDate(round.settledAt || round.updatedAt || round.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Lịch sử cược</h3><span class="badge">{{ gameHistory.length }}</span></div>
          <div v-if="gameHistory.length === 0" class="panel-card__empty">Chưa có lịch sử game.</div>
          <table v-else class="data-table">
            <thead>
              <tr><th>Phiên</th><th>User</th><th>Room</th><th>Cửa</th><th>Tiền cược</th><th>Trả thưởng</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              <tr v-for="bet in gameHistory" :key="bet._id">
                <td>{{ bet.roundId }}</td>
                <td>{{ bet.userId?.username || 'N/A' }}</td>
                <td>{{ formatRoomLabel(bet.roomId) }}</td>
                <td>{{ formatGateLabel(bet.gate) }}</td>
                <td>{{ formatMoney(bet.amount) }}</td>
                <td>{{ formatMoney(bet.payout) }}</td>
                <td>
                  <span class="badge" :class="bet.status === 'won' ? 'badge--success' : bet.status === 'lost' ? 'badge--danger' : ''">
                    {{ formatBetStatus(bet.status, bet.payout) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Revenue -->
      <div v-if="activeTab === 'revenue'" class="admin-panel">
        <div class="stats-row">
          <div class="stat-card stat-card--blue"><span class="stat-card__label">Gross Bet</span><strong class="stat-card__value">{{ formatMoney(revenue.totalBetAmount) }}</strong></div>
          <div class="stat-card stat-card--green"><span class="stat-card__label">Total Payout</span><strong class="stat-card__value">{{ formatMoney(revenue.totalPayout) }}</strong></div>
          <div class="stat-card stat-card--purple"><span class="stat-card__label">Total Rounds</span><strong class="stat-card__value">{{ revenue.totalRounds }}</strong></div>
        </div>
      </div>

      <!-- Invite Codes -->
      <div v-if="activeTab === 'invite-codes'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header">
            <h3>Mã mời</h3>
            <input v-model="inviteSearchKeyword" type="text" class="topbar__search" placeholder="Tìm user / mã mời..." />
          </div>
          <div v-if="filteredInviteCodes.length === 0" class="panel-card__empty">Chưa có mã mời.</div>
          <table v-else class="data-table">
            <thead><tr><th>Tên</th><th>Username</th><th>Mã mời</th><th>Chỉnh sửa</th><th>Hành động</th></tr></thead>
            <tbody>
              <tr v-for="item in filteredInviteCodes" :key="item.userId">
                <td>{{ item.fullName || item.username }}</td>
                <td>@{{ item.username }}</td>
                <td><span class="badge badge--info">{{ item.inviteCode }}</span></td>
                <td><input v-model="item.inviteCodeDraft" type="text" class="inline-input" placeholder="Mã mời mới" /></td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn--primary btn--sm" :disabled="isInviteSaving(item.userId)" @click="saveInviteCode(item)">Lưu</button>
                    <button class="btn btn--sm" :disabled="isInviteSaving(item.userId)" @click="regenerateInviteCode(item)">Tạo mới</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ===== SET KÈO XÚC SẮC 3P ===== -->
      <div v-if="activeTab === 'odds-settings'" class="admin-panel">
        <!-- Header phiên -->
        <div class="keo-hero">
          <h2>🎲 Set kèo · Xúc sắc 3P</h2>
          <div class="keo-hero__meta">
            <span>Kỳ <strong>{{ sicboControl.roundId }}</strong></span>
            <span class="keo-hero__timer">{{ formatCountdown(sicboControl.timeLeft) }}</span>
            <span :class="sicboControl.bettingOpen ? 'keo-status--open' : 'keo-status--closed'">{{ sicboControl.bettingOpen ? 'Đang mở' : 'Khóa cược' }}</span>
          </div>
        </div>

        <!-- Ép kết quả -->
        <div class="keo-control">
          <p class="keo-control__label">Kết quả hiện tại: <strong>{{ formatForcedResult(sicboControl.forcedResult) }}</strong></p>
          <div class="keo-control__row">
            <select v-model="forcedResultForm.d1" class="keo-select"><option value="">-</option><option v-for="v in [1,2,3,4,5,6]" :key="`a1-${v}`" :value="String(v)">{{ v }}</option></select>
            <select v-model="forcedResultForm.d2" class="keo-select"><option value="">-</option><option v-for="v in [1,2,3,4,5,6]" :key="`a2-${v}`" :value="String(v)">{{ v }}</option></select>
            <select v-model="forcedResultForm.d3" class="keo-select"><option value="">-</option><option v-for="v in [1,2,3,4,5,6]" :key="`a3-${v}`" :value="String(v)">{{ v }}</option></select>
            <button class="btn btn--primary" :disabled="savingControl" @click="saveSicboControl">Xác nhận</button>
            <button class="btn" :disabled="savingControl" @click="clearSicboControl">Làm mới</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Tỉ lệ nhanh (Lớn/Nhỏ/Chẵn/Lẻ)</h3></div>
          <div class="odds-quick">
            <label class="form-field"><span>Lớn</span><input v-model="oddsConfig.odds.tai" type="number" step="0.01" /></label>
            <label class="form-field"><span>Nhỏ</span><input v-model="oddsConfig.odds.xiu" type="number" step="0.01" /></label>
            <label class="form-field"><span>Lẻ</span><input v-model="oddsConfig.odds.odd" type="number" step="0.01" /></label>
            <label class="form-field"><span>Chẵn</span><input v-model="oddsConfig.odds.even" type="number" step="0.01" /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:10px">
            <button class="btn btn--primary btn--sm" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu tỉ lệ' }}</button>
            <button class="btn btn--sm" :disabled="savingOdds" @click="resetOddsSettings">Reset</button>
          </div>
        </div>

        <!-- Bảng cược -->
        <div class="panel-card">
          <div class="panel-card__header"><h3>Lệnh cược gần đây</h3></div>
          <table class="data-table">
            <thead><tr><th>ID</th><th>Username</th><th>Cửa</th><th>Số tiền</th><th>Thời gian</th></tr></thead>
            <tbody>
              <tr v-if="gameHistory.filter(b=>b.roomId==='sicbo-3p').length===0"><td colspan="5" class="panel-card__empty">Chưa có lệnh cược</td></tr>
              <tr v-for="bet in gameHistory.filter(b=>b.roomId==='sicbo-3p').slice(0,15)" :key="bet._id">
                <td>{{ bet.userId?.userCode || '--' }}</td>
                <td>{{ bet.userId?.username || 'N/A' }}</td>
                <td><strong>{{ formatGateLabel(bet.gate) }}</strong></td>
                <td>{{ formatMoney(bet.amount) }}</td>
                <td>{{ formatDate(bet.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cài đặt hệ thống -->
      <div v-if="activeTab === 'payout-settings'" class="admin-panel">
        <div class="panel-card">
          <h2 style="text-align:center;font-size:22px;font-weight:800;margin:0 0 24px">Cài đặt hệ thống</h2>
          <div class="form-grid">
            <label class="form-field"><span>Đôi bên</span><input v-model="siteConfig.oddsDoi" type="text" /></label>
            <label class="form-field"><span>Xúc sắc 3p</span><input v-model="siteConfig.oddsXs3p" type="text" /></label>
            <label class="form-field"><span>Hai số trùng Xúc sắc 3p</span><input v-model="siteConfig.oddsHaiTrung3p" type="text" /></label>
            <label class="form-field"><span>Ba số trùng Xúc sắc 3p</span><input v-model="siteConfig.oddsBaTrung3p" type="text" /></label>
            <label class="form-field"><span style="color:#e53935">Lỗi CLTX Xúc sắc 3p</span><input v-model="siteConfig.oddsLoiCltx3p" type="text" /></label>
            <label class="form-field"><span>Xúc sắc 5p</span><input v-model="siteConfig.oddsXs5p" type="text" /></label>
            <label class="form-field"><span>Hai số trùng Xúc sắc 5p</span><input v-model="siteConfig.oddsHaiTrung5p" type="text" /></label>
            <label class="form-field"><span>Ba số trùng Xúc sắc 5p</span><input v-model="siteConfig.oddsBaTrung5p" type="text" /></label>
            <label class="form-field"><span style="color:#e53935">Lỗi CLTX Xúc sắc 5p</span><input v-model="siteConfig.oddsLoiCltx5p" type="text" /></label>
            <label class="form-field"><span style="color:#4caf50">Lỗi Keno Xúc sắc 5p</span><input v-model="siteConfig.oddsLoiKeno5p" type="text" /></label>
            <label class="form-field"><span>Mã giới thiệu</span><input v-model="siteConfig.referralCode" type="text" placeholder="VD: HT5555" /></label>
            <label class="form-field"><span>SEO - Tiêu Đề</span><input v-model="siteConfig.seoTitle" type="text" /></label>
            <label class="form-field"><span>SEO - Mô tả</span><input v-model="siteConfig.seoDescription" type="text" /></label>
            <label class="form-field"><span>Thông báo trang chủ (ngăn cách bằng dấu ';')</span><input v-model="siteConfig.homeBanner" type="text" placeholder="CHÀO MỪNG BẠN ĐẾN THE VENETIAN !" /></label>
          </div>
          <div style="text-align:center;margin-top:20px">
            <button class="btn btn--primary" :disabled="savingSiteConfig" @click="saveSiteConfig">{{ savingSiteConfig ? 'Đang lưu...' : 'Lưu' }}</button>
          </div>
        </div>
      </div>

      <!-- Admins -->
      <div v-if="activeTab === 'admins'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Tạo admin mới</h3></div>
          <div class="form-grid">
            <label class="form-field"><span>Username</span><input v-model="newAdminForm.username" type="text" placeholder="admin_ops" /></label>
            <label class="form-field"><span>Mật khẩu</span><input v-model="newAdminForm.password" type="password" placeholder="Tối thiểu 6 ký tự" /></label>
            <label class="form-field"><span>Họ tên</span><input v-model="newAdminForm.fullName" type="text" /></label>
            <label class="form-field"><span>SĐT</span><input v-model="newAdminForm.phone" type="text" /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:12px">
            <button class="btn btn--primary" :disabled="savingAdminForm" @click="createAdminUser">{{ savingAdminForm ? 'Đang tạo...' : 'Tạo admin' }}</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Quản trị viên</h3><span class="badge">{{ adminUsers.length }}</span></div>
          <table v-if="adminUsers.length" class="data-table">
            <thead><tr><th>Tên</th><th>Username</th><th>Trạng thái</th><th>Quyền</th><th>Mật khẩu mới</th><th>Hành động</th></tr></thead>
            <tbody>
              <tr v-for="admin in adminUsers" :key="admin._id">
                <td>{{ admin.fullName || admin.username }}</td>
                <td>@{{ admin.username }}</td>
                <td><span class="badge" :class="admin.status === 'active' ? 'badge--success' : 'badge--danger'">{{ admin.status }}</span></td>
                <td>{{ (admin.scopes || []).join(', ') || 'full' }}</td>
                <td><input v-model="adminPasswordDrafts[admin._id]" type="password" class="inline-input" placeholder="Mật khẩu mới" /></td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn--sm" :disabled="isAdminActionSaving(admin._id)" @click="toggleAdminStatus(admin, admin.status === 'active' ? 'locked' : 'active')">
                      {{ admin.status === 'active' ? 'Khóa' : 'Mở khóa' }}
                    </button>
                    <button class="btn btn--primary btn--sm" :disabled="isAdminActionSaving(admin._id)" @click="resetAdminPassword(admin)">Reset MK</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Chat -->
      <div v-if="activeTab === 'chat'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header">
            <h3>Chat / CSKH (Realtime)</h3>
            <div class="chat-kpi">
              <span class="badge badge--info">Tin nhắn hôm nay: {{ chatStats.todayMessages }}</span>
              <span class="badge" :class="chatStats.pendingRooms ? 'badge--warning' : 'badge--success'">Chưa trả lời: {{ chatStats.pendingRooms }}</span>
            </div>
          </div>
          <div class="admin-chat-layout">
            <div class="admin-chat-rooms">
              <button
                v-for="room in chatRooms"
                :key="room.roomId"
                class="admin-chat-room"
                :class="{ 'admin-chat-room--active': selectedRoomId === room.roomId }"
                @click="selectChatRoom(room.roomId)"
              >
                <div class="admin-chat-room__top">
                  <strong>{{ room.title }}</strong>
                  <span v-if="unreadByRoom[room.roomId]" class="badge badge--warning">{{ unreadByRoom[room.roomId] }}</span>
                  <span v-else-if="room.needsReply" class="badge badge--warning">Chờ trả lời</span>
                </div>
                <span>{{ room.lastMessage }}</span>
              </button>
            </div>
            <div class="admin-chat-messages" ref="adminChatRef">
              <div v-if="selectedChatUser" class="admin-chat-usercard">
                <div><span>Gợi nhớ</span><strong>{{ selectedChatUser.displayName || '--' }}</strong></div>
                <div><span>Nhân vật</span><strong>{{ selectedChatUser.characterName || '--' }}</strong></div>
                <div><span>Username</span><strong>@{{ selectedChatUser.username }}</strong></div>
                <div><span>ID</span><strong>{{ selectedChatUser.userCode || '--' }}</strong></div>
                <div><span>IP</span><strong>{{ selectedChatUser.lastLoginIp || '--' }}</strong></div>
                <div><span>Số dư</span><strong>{{ formatMoney(selectedChatUser.balance) }}</strong></div>
              </div>
              <div v-if="chatMessages.length === 0" class="panel-card__empty">Chọn phòng để xem tin nhắn.</div>
              <div v-for="msg in chatMessages" :key="msg._id" class="admin-chat-msg" :class="{ 'admin-chat-msg--admin': msg.senderRole === 'admin' }">
                <strong>
                  {{ msg.senderRole === 'admin' ? 'Chăm sóc khách hàng' : (msg.senderName || msg.sender) }}
                  <span v-if="msg.senderRole === 'admin'" class="badge badge--info">CSKH</span>
                </strong>
                <template v-if="msg.messageType === 'image' && msg.imageUrl">
                  <img class="admin-chat-image" :src="resolveImageSrc(msg.imageUrl)" alt="Ảnh" />
                </template>
                <p v-else>{{ msg.content }}</p>
                <small>{{ formatDate(msg.createdAt) }}</small>
              </div>
            </div>
          </div>
          <div class="admin-chat-input">
            <input ref="adminChatFileRef" class="admin-chat-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="onAdminPickImage" />
            <button class="btn btn--sm" :disabled="sendingAdminChat || sendingAdminImage" @click="pickAdminImage">Ảnh</button>
            <input v-model.trim="adminChatInput" type="text" placeholder="Trả lời..." @keyup.enter="sendAdminChat" />
            <button class="btn btn--primary" :disabled="sendingAdminChat" @click="sendAdminChat">Gửi</button>
          </div>
        </div>
      </div>

      <!-- Chat Mobile -->
      <div v-if="activeTab === 'chat-mobile'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Chat Mobile</h3></div>
          <div class="admin-chat-layout">
            <div class="admin-chat-rooms">
              <button v-for="room in mobileChatRooms" :key="room.roomId" class="admin-chat-room" :class="{ 'admin-chat-room--active': selectedMobileRoomId === room.roomId }" @click="selectedMobileRoomId = room.roomId">
                <strong>{{ room.title }}</strong>
                <span>{{ room.lastMessage }}</span>
              </button>
            </div>
            <div class="admin-chat-messages">
              <div v-if="mobileChatMessages.length === 0" class="panel-card__empty">Chọn phòng để xem.</div>
              <div v-for="msg in mobileChatMessages" :key="msg.id" class="admin-chat-msg">
                <strong>{{ msg.sender }}</strong>
                <p>{{ msg.content }}</p>
                <small>{{ formatDate(msg.createdAt) }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Set Kèo 1/3/5 (Keno placeholders) -->
      <div v-if="activeTab === 'set-keo-1' || activeTab === 'set-keo-3' || activeTab === 'set-keo-5'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Set kèo</h3></div>
          <p style="text-align:center;padding:14px 0;font-size:15px;font-weight:700">Kỳ {{ kenoRoundLabel }}</p>
          <p style="text-align:center;color:#888;font-size:14px">{{ formatCountdown(sicboControl.timeLeft) }}</p>
          <table class="data-table" style="margin-top:16px">
            <thead><tr><th>ID USER</th><th>USERNAME</th><th>CHỌN</th><th>SỐ TIỀN</th><th>THỜI GIAN ĐẶT</th></tr></thead>
            <tbody>
              <tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Chưa có dữ liệu cược Keno</td></tr>
            </tbody>
          </table>
          <div style="text-align:center;padding:20px 0">
            <p style="font-size:14px;color:#555">Kết quả kèo hiện tại là <strong>{{ formatForcedResult(sicboControl.forcedResult) }}</strong></p>
            <p style="margin-top:8px;font-size:14px;color:#555">Chọn kèo</p>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
              <input v-model="kenoForceInput" type="text" class="inline-input" style="width:120px" placeholder="Nhập kèo" />
              <button class="btn btn--primary btn--sm">Xác nhận</button>
              <button class="btn btn--sm">Làm mới</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== SET KÈO XÚC SẮC 5P ===== -->
      <div v-if="activeTab === 'odds-5p'" class="admin-panel">
        <div class="keo-hero keo-hero--5p">
          <h2>🎲 Set kèo · Xúc sắc 5P</h2>
          <div class="keo-hero__meta">
            <span>Kỳ <strong>{{ sicbo5pControl.roundId || '--' }}</strong></span>
            <span class="keo-hero__timer">{{ formatCountdown(sicbo5pControl.timeLeft) }}</span>
            <span :class="sicbo5pControl.bettingOpen ? 'keo-status--open' : 'keo-status--closed'">{{ sicbo5pControl.bettingOpen ? 'Đang mở' : 'Khóa cược' }}</span>
          </div>
        </div>

        <div class="keo-control">
          <p class="keo-control__label">Kết quả hiện tại: <strong>{{ formatForcedResult(sicbo5pControl.forcedResult) }}</strong></p>
          <div class="keo-control__row">
            <select v-model="forced5p.d1" class="keo-select"><option value="">-</option><option v-for="v in [1,2,3,4,5,6]" :key="`b1-${v}`" :value="String(v)">{{ v }}</option></select>
            <select v-model="forced5p.d2" class="keo-select"><option value="">-</option><option v-for="v in [1,2,3,4,5,6]" :key="`b2-${v}`" :value="String(v)">{{ v }}</option></select>
            <select v-model="forced5p.d3" class="keo-select"><option value="">-</option><option v-for="v in [1,2,3,4,5,6]" :key="`b3-${v}`" :value="String(v)">{{ v }}</option></select>
            <button class="btn btn--primary" @click="saveSicbo5pControl">Xác nhận</button>
            <button class="btn" @click="forced5p.d1='';forced5p.d2='';forced5p.d3=''">Làm mới</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Tỉ lệ nhanh (Lớn/Nhỏ/Chẵn/Lẻ)</h3></div>
          <div class="odds-quick">
            <label class="form-field"><span>Lớn</span><input v-model="oddsConfig.odds.tai" type="number" step="0.01" /></label>
            <label class="form-field"><span>Nhỏ</span><input v-model="oddsConfig.odds.xiu" type="number" step="0.01" /></label>
            <label class="form-field"><span>Lẻ</span><input v-model="oddsConfig.odds.odd" type="number" step="0.01" /></label>
            <label class="form-field"><span>Chẵn</span><input v-model="oddsConfig.odds.even" type="number" step="0.01" /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:10px">
            <button class="btn btn--primary btn--sm" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu tỉ lệ' }}</button>
            <button class="btn btn--sm" :disabled="savingOdds" @click="resetOddsSettings">Reset</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Lệnh cược gần đây</h3></div>
          <table class="data-table">
            <thead><tr><th>ID</th><th>Username</th><th>Cửa</th><th>Số tiền</th><th>Thời gian</th></tr></thead>
            <tbody>
              <tr v-if="gameHistory.filter(b=>b.roomId==='sicbo-5p').length===0"><td colspan="5" class="panel-card__empty">Chưa có lệnh cược</td></tr>
              <tr v-for="bet in gameHistory.filter(b=>b.roomId==='sicbo-5p').slice(0,15)" :key="bet._id">
                <td>{{ bet.userId?.userCode || '--' }}</td>
                <td>{{ bet.userId?.username || 'N/A' }}</td>
                <td><strong>{{ formatGateLabel(bet.gate) }}</strong></td>
                <td>{{ formatMoney(bet.amount) }}</td>
                <td>{{ formatDate(bet.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Yêu cầu rút tiền -->
      <div v-if="activeTab === 'withdraw-requests'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Yêu cầu rút tiền</h3><span class="badge">{{ withdrawRequests.length }}</span></div>
          <div v-if="withdrawRequests.length === 0" class="panel-card__empty">Không có yêu cầu rút tiền.</div>
          <table v-else class="data-table">
            <thead><tr><th>User</th><th>Số tiền</th><th>Ngân hàng</th><th>STK</th><th>Trạng thái</th><th>Thời gian</th><th>Hành động</th></tr></thead>
            <tbody>
              <tr v-for="tx in withdrawRequests" :key="tx._id">
                <td>{{ tx.userId?.username || 'N/A' }}</td>
                <td class="text-bold">{{ formatMoney(Math.abs(tx.amount)) }}</td>
                <td>{{ tx.meta?.bankName || '--' }}</td>
                <td>{{ tx.meta?.bankAccount || '--' }}</td>
                <td><span class="badge" :class="tx.status==='pending'?'badge--warning':'badge--info'">{{ tx.status }}</span></td>
                <td>{{ formatDate(tx.createdAt) }}</td>
                <td>
                  <div v-if="tx.status==='pending'" class="action-btns">
                    <button class="btn btn--success btn--sm" @click="reviewTransaction(tx._id,'approve')">Duyệt</button>
                    <button class="btn btn--danger btn--sm" @click="reviewTransaction(tx._id,'reject')">Từ chối</button>
                  </div>
                  <span v-else style="color:#888;font-size:12px">Đã xử lý</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Yêu cầu nạp tiền -->
      <div v-if="activeTab === 'deposit-requests'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Yêu cầu nạp tiền</h3><span class="badge">{{ depositRequests.length }}</span></div>
          <div v-if="depositRequests.length === 0" class="panel-card__empty">Không có yêu cầu nạp tiền.</div>
          <table v-else class="data-table">
            <thead><tr><th>User</th><th>Số tiền</th><th>Ngân hàng</th><th>Nội dung CK</th><th>Trạng thái</th><th>Thời gian</th><th>Hành động</th></tr></thead>
            <tbody>
              <tr v-for="tx in depositRequests" :key="tx._id">
                <td>{{ tx.userId?.username || 'N/A' }}</td>
                <td class="text-bold">{{ formatMoney(tx.amount) }}</td>
                <td>{{ tx.meta?.bankCode || '--' }}</td>
                <td>{{ tx.meta?.transferContent || '--' }}</td>
                <td><span class="badge" :class="tx.status==='pending'?'badge--warning':'badge--info'">{{ tx.status }}</span></td>
                <td>{{ formatDate(tx.createdAt) }}</td>
                <td>
                  <div v-if="tx.status==='pending'" class="action-btns">
                    <button class="btn btn--success btn--sm" @click="reviewTransaction(tx._id,'approve')">Duyệt</button>
                    <button class="btn btn--danger btn--sm" @click="reviewTransaction(tx._id,'reject')">Từ chối</button>
                  </div>
                  <span v-else style="color:#888;font-size:12px">Đã xử lý</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Thêm mới nhân viên -->
      <div v-if="activeTab === 'add-staff'" class="admin-panel">
        <div class="panel-card" style="max-width:500px;margin:0 auto">
          <h2 style="text-align:center;font-size:22px;font-weight:800;margin:0 0 24px">Tạo tài khoản nhân viên</h2>
          <div style="display:flex;flex-direction:column;gap:16px;align-items:center">
            <label class="form-field" style="width:100%;max-width:340px;text-align:center">
              <span style="display:block;margin-bottom:6px;font-weight:600">Tài khoản</span>
              <input v-model="newAdminForm.username" type="text" style="text-align:center" />
            </label>
            <label class="form-field" style="width:100%;max-width:340px;text-align:center">
              <span style="display:block;margin-bottom:6px;font-weight:600">Mật khẩu</span>
              <input v-model="newAdminForm.password" type="password" style="text-align:center" />
            </label>
            <button class="btn btn--primary" style="margin-top:8px;min-width:140px" :disabled="savingAdminForm" @click="createAdminUser">
              {{ savingAdminForm ? 'Đang tạo...' : 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tài khoản ngân hàng (Admin) -->
      <div v-if="activeTab === 'bank-accounts'" class="admin-panel">
        <div class="panel-card" style="max-width:600px;margin:0 auto">
          <h2 style="text-align:center;font-size:22px;font-weight:800;margin:0 0 24px">Cài đặt ngân hàng</h2>
          <div style="display:flex;flex-direction:column;gap:14px;align-items:center">
            <label class="form-field" style="width:100%;max-width:400px">
              <span style="display:block;text-align:center;margin-bottom:4px;font-weight:600">Tên người nhận</span>
              <input v-model="adminBankForm.accountName" type="text" style="text-align:center" />
            </label>
            <label class="form-field" style="width:100%;max-width:400px">
              <span style="display:block;text-align:center;margin-bottom:4px;font-weight:600">Tên ngân hàng</span>
              <input v-model="adminBankForm.bankName" type="text" style="text-align:center" />
            </label>
            <label class="form-field" style="width:100%;max-width:400px">
              <span style="display:block;text-align:center;margin-bottom:4px;font-weight:600">STK</span>
              <input v-model="adminBankForm.bankAccount" type="text" style="text-align:center" />
            </label>
            <label class="form-field" style="width:100%;max-width:400px">
              <span style="display:block;text-align:center;margin-bottom:4px;font-weight:600">Nội dung chuyển khoản</span>
              <input v-model="adminBankForm.transferNote" type="text" style="text-align:center" />
            </label>
            <button class="btn btn--primary" style="margin-top:4px;min-width:120px" :disabled="savingAdminBank" @click="saveAdminBank">
              {{ savingAdminBank ? 'Đang lưu...' : 'Lưu' }}
            </button>
          </div>
        </div>

        <div class="panel-card" style="margin-top:20px">
          <table class="data-table">
            <thead><tr><th>TÊN NGÂN HÀNG</th><th>STK</th><th>NGƯỜI NHẬN</th><th>NỘI DUNG CHUYỂN KHOẢN</th><th>HÀNH ĐỘNG</th></tr></thead>
            <tbody>
              <tr v-if="adminBanks.length === 0"><td colspan="5" style="text-align:center;color:#999;padding:20px">Chưa có tài khoản ngân hàng</td></tr>
              <tr v-for="b in adminBanks" :key="b._id">
                <td>{{ b.bankName }}</td>
                <td>{{ b.bankAccount }}</td>
                <td>{{ b.accountName }}</td>
                <td>{{ b.transferNote || '--' }}</td>
                <td><button class="btn btn--danger btn--sm" @click="deleteAdminBank(b._id)">Xóa</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Error -->
      <div v-if="loadError" class="error-banner">{{ loadError }}</div>
      <div
        v-if="toast.message"
        class="admin-toast"
        :class="toast.type === 'error' ? 'admin-toast--error' : 'admin-toast--success'"
        role="status"
        aria-live="polite"
      >
        <span>{{ toast.message }}</span>
        <button class="admin-toast__close" type="button" @click="clearToast">×</button>
      </div>

      <!-- Footer -->
      <footer class="admin-footer">
        Designed & Developed by <strong>BG Production</strong>
      </footer>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch, API_BASE_URL } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'

const router = useRouter()
const userStore = useUserStore()
const socketStore = useSocketStore()

const sidebarOpen = ref(false)

const tabs = [
  { key: 'dashboard', label: 'Doanh Thu', icon: '📊' },
  { key: 'users', label: 'Người chơi', icon: '👤' },
  { key: 'admins', label: 'Quản lý nhân viên', icon: '👥' },
  { key: 'set-keo-1', label: 'Set Kèo 1', icon: '🎰' },
  { key: 'set-keo-3', label: 'Set Kèo 3', icon: '🎰' },
  { key: 'set-keo-5', label: 'Set Kèo 5', icon: '🎰' },
  { key: 'odds-settings', label: 'Set Kèo Xúc sắc 3p', icon: '🎲' },
  { key: 'odds-5p', label: 'Set Kèo Xúc sắc 5p', icon: '🎲' },
  { key: 'withdraw-requests', label: 'Yêu cầu rút tiền', icon: '💸' },
  { key: 'deposit-requests', label: 'Yêu cầu nạp tiền', icon: '💰' },
  { key: 'game-history', label: 'Lịch sử trò chơi', icon: '📜' },
  { key: 'payout-settings', label: 'Cài đặt', icon: '⚙️' },
  { key: 'add-staff', label: 'Thêm mới nhân viên', icon: '➕' },
  { key: 'bank-accounts', label: 'Tài khoản ngân hàng', icon: '🏦' },
  { key: 'chat', label: 'Chat CSKH', icon: '💬' }
]

const loadingAll = ref(false)
const loadError = ref('')
const activeTab = ref('dashboard')
const selectedUser = ref(null)
const selectedRoomId = ref('')
const selectedMobileRoomId = ref('')
const selectedOddsRoomId = ref('sicbo-3p')
const copyFromRoomId = ref('sicbo-3p')
const savingOdds = ref(false)
const savingControl = ref(false)
const savingPayout = ref(false)
const savingAdminForm = ref(false)
const chipOptionsText = ref('')
const inviteSearchKeyword = ref('')
const userSearchKeyword = ref('')
const inviteSavingState = reactive({})
const adminActionSavingState = reactive({})
const adminPasswordDrafts = reactive({})
const userRowSavingState = reactive({})
const userRowDrafts = reactive({})
const forcedResultForm = reactive({ d1: '', d2: '', d3: '', forcedNote: '' })
const newAdminForm = reactive({ username: '', password: '', fullName: '', phone: '' })

const toast = reactive({ message: '', type: 'success' })
let toastTimer = null
function showToast(message, type = 'success') {
  toast.message = String(message || '').trim()
  toast.type = type === 'error' ? 'error' : 'success'
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.message = ''
  }, 2200)
}
function clearToast() {
  toast.message = ''
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = null
}

const overview = reactive({
  stats: { totalUsers: 0, activeUsers: 0, pendingTransactions: 0 },
  users: [],
  pendingTransactions: []
})

const revenue = reactive({
  totalUsers: 0, activeUsers: 0, totalDeposit: 0, totalWithdraw: 0,
  totalBetAmount: 0, totalPayout: 0, netGamingRevenue: 0, totalRounds: 0
})

const payoutConfig = reactive({
  withdrawFeeRate: 0, dailyWithdrawLimit: 0,
  autoApproveDeposit: false, autoApproveWithdraw: false, maxPendingWithdrawals: 1
})

const sicboControl = reactive({
  roomId: 'sicbo-3p', roundId: '--', timeLeft: 0, bettingOpen: false,
  betTotalAmount: 0, betCount: 0, forcedResult: null, forcedNote: '', summary: null
})

const oddsConfig = reactive({
  roomId: 'sicbo-3p', title: '', roundDuration: 240, betLockSeconds: 8,
  minBet: 1000, maxBet: 50000, chipOptions: [], odds: { tai: 1.98, xiu: 1.98, odd: 1.98, even: 1.98 }
})

const users = ref([])
const transactions = ref([])
const gameHistory = ref([])
const roundHistory = ref([])
const gameSummary = ref([])
const inviteCodes = ref([])
const oddsRooms = ref([])
const adminUsers = ref([])
const chatRooms = ref([])
const chatMessages = ref([])
const adminChatRef = ref(null)
const adminChatInput = ref('')
const sendingAdminChat = ref(false)
const adminChatFileRef = ref(null)
const sendingAdminImage = ref(false)
const selectedChatUser = ref(null)
const unreadByRoom = reactive({})
const chatStats = reactive({ todayMessages: 0, pendingRooms: 0 })
const kenoForceInput = ref('')
const kenoRoundLabel = computed(() => Math.floor(Date.now() / 60000))
const currentBets5p = ref([])
const forced5p = reactive({ d1: '', d2: '', d3: '' })
const sicbo5pControl = reactive({ roomId:'sicbo-5p', roundId:'--', timeLeft:0, bettingOpen:false, forcedResult:null })

function applySicboRealtimeState(state) {
  if (!state || !state.roomId) return

  if (state.roomId === 'sicbo-3p') {
    if (state.roundId) sicboControl.roundId = state.roundId
    if (typeof state.timeLeft !== 'undefined') sicboControl.timeLeft = Number(state.timeLeft || 0)
    if (typeof state.bettingOpen !== 'undefined') sicboControl.bettingOpen = Boolean(state.bettingOpen)
    if (typeof state.betTotalAmount !== 'undefined') sicboControl.betTotalAmount = Number(state.betTotalAmount || 0)
    if (typeof state.betCount !== 'undefined') sicboControl.betCount = Number(state.betCount || 0)
    if (typeof state.summary !== 'undefined') sicboControl.summary = state.summary || null
    return
  }

  if (state.roomId === 'sicbo-5p') {
    if (state.roundId) sicbo5pControl.roundId = state.roundId
    if (typeof state.timeLeft !== 'undefined') sicbo5pControl.timeLeft = Number(state.timeLeft || 0)
    if (typeof state.bettingOpen !== 'undefined') sicbo5pControl.bettingOpen = Boolean(state.bettingOpen)
  }
}

function ensureSicboRealtimeForTab(tabKey) {
  if (tabKey === 'odds-settings') {
    selectedOddsRoomId.value = 'sicbo-3p'
    socketStore.joinSicboRoom(userStore.user?._id, 'sicbo-3p')
    return
  }

  if (tabKey === 'odds-5p') {
    selectedOddsRoomId.value = 'sicbo-5p'
    socketStore.joinSicboRoom(userStore.user?._id, 'sicbo-5p')
  }
}

const lastSeenBetCountByRoom = reactive({
  'sicbo-3p': null,
  'sicbo-5p': null
})
let lastGameHistoryRefreshAt = 0

function shouldRefreshBetsForActiveTab(roomId) {
  if (roomId === 'sicbo-3p' && activeTab.value === 'odds-settings') return true
  if (roomId === 'sicbo-5p' && activeTab.value === 'odds-5p') return true
  return false
}

async function maybeRefreshGameHistoryFromRealtime(state) {
  const roomId = state?.roomId
  if (!roomId || !shouldRefreshBetsForActiveTab(roomId)) return

  const betCount = Number.isFinite(Number(state.betCount)) ? Number(state.betCount) : null
  if (betCount === null) return

  const lastSeen = lastSeenBetCountByRoom[roomId]
  if (lastSeen !== null && betCount === lastSeen) return

  lastSeenBetCountByRoom[roomId] = betCount

  // Throttle to avoid hammering the admin endpoint during high traffic.
  const now = Date.now()
  if (now - lastGameHistoryRefreshAt < 2500) return
  lastGameHistoryRefreshAt = now

  try {
    await loadGameHistory()
  } catch {
    /* ignore */
  }
}

const siteConfig = reactive({
  oddsDoi:'1.99', oddsXs3p:'1.99', oddsHaiTrung3p:'1.99', oddsBaTrung3p:'1.99', oddsLoiCltx3p:'1.99',
  oddsXs5p:'1.99', oddsHaiTrung5p:'1.99', oddsBaTrung5p:'1.99', oddsLoiCltx5p:'1.98', oddsLoiKeno5p:'2.3',
  referralCode:'', seoTitle:'', seoDescription:'', homeBanner:'CHÀO MỪNG BẠN ĐẾN THE VENETIAN !'
})
const savingSiteConfig = ref(false)
const adminBankForm = reactive({ accountName:'', bankName:'', bankAccount:'', transferNote:'' })
const adminBanks = ref([])
const savingAdminBank = ref(false)

const withdrawRequests = computed(() => transactions.value.filter(t => ['withdraw_pending','withdraw','withdraw_rejected'].includes(t.type)))
const depositRequests = computed(() => transactions.value.filter(t => ['deposit_pending','deposit','deposit_rejected'].includes(t.type)))
const usersWithBank = computed(() => users.value.filter(u => u.linkedBank?.bankName))
const mobileChatRooms = ref([])
const mobileChatMessages = ref([])

const currentTabLabel = computed(() => tabs.find(t => t.key === activeTab.value)?.label || 'Dashboard')

const filteredUsers = computed(() => {
  const kw = String(userSearchKeyword.value || '').trim().toLowerCase()
  if (!kw) return users.value || []
  return (users.value || []).filter((u) => {
    const hay = [
      u.userCode,
      u.username,
      u.phone,
      u.lastLoginIp,
      u.referredByCode,
      u.inviteCode
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    return hay.includes(kw)
  })
})

function getUserDraft(userId) {
  const key = String(userId || '')
  if (!key) return { adjustAmount: '', bonusAmount: '', vipLevel: '' }
  if (!userRowDrafts[key]) {
    userRowDrafts[key] = { adjustAmount: '', bonusAmount: '', vipLevel: '' }
  }
  return userRowDrafts[key]
}

function isUserRowSaving(userId) {
  return Boolean(userRowSavingState[String(userId || '')])
}

const filteredInviteCodes = computed(() => {
  const kw = String(inviteSearchKeyword.value || '').trim().toLowerCase()
  if (!kw) return inviteCodes.value
  return inviteCodes.value.filter(item =>
    [item.username, item.userCode, item.fullName, item.inviteCode]
      .map(v => String(v || '').toLowerCase()).some(v => v.includes(kw))
  )
})

const authJsonHeaders = computed(() => ({ 'Content-Type': 'application/json', ...userStore.authHeaders }))

function handleLogout() { userStore.logout(); router.push('/admin/login') }

function formatMoney(v) { return new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + ' đ' }
function formatDate(v) { return v ? new Date(v).toLocaleString('vi-VN') : '--' }
function formatCountdown(v) { const s = Math.max(Number(v||0),0); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }
function resolveImageSrc(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${String(API_BASE_URL || '').replace(/\\/+$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`
}
function selectChatRoom(roomId) {
  selectedRoomId.value = roomId
  if (roomId) unreadByRoom[roomId] = 0
}
function formatTransactionType(type) {
  const m = { deposit_pending:'Yêu cầu nạp', deposit:'Nạp thành công', deposit_rejected:'Từ chối nạp', withdraw_pending:'Yêu cầu rút', withdraw:'Rút thành công', withdraw_rejected:'Từ chối rút', bet:'Đặt cược', win:'Trả thưởng', refund:'Hoàn cược', admin_credit:'Admin cộng', admin_debit:'Admin trừ', admin_bonus:'Admin thưởng' }
  return m[type] || type || 'Giao dịch'
}
function formatGateLabel(g) {
  if(g==='bao')return'Bộ ba'; if(g==='tai')return'Lớn'; if(g==='xiu')return'Nhỏ';
  if(g==='odd')return'Lẻ'; if(g==='even')return'Chẵn';
  if(g?.startsWith('double_'))return`2 số ${g.split('_')[1]}`;
  if(g?.startsWith('triple_'))return`3 số ${g.split('_')[1]}`; return g||'--'
}
function formatRoomLabel(r) { if(r==='sicbo-5p')return'Xúc sắc 5P'; if(r==='sicbo-3p')return'Xúc sắc 3P'; return r||'--' }
function formatBetStatus(s,p) { if(s==='won')return`Thắng ${formatMoney(p)}`; if(s==='lost')return'Thua'; if(s==='placed')return'Đang chờ'; return s||'--' }
function formatForcedResult(r) { return Array.isArray(r)&&r.length===3?r.join(' - '):'Ngẫu nhiên' }
function isInviteSaving(id) { return Boolean(inviteSavingState[id]) }
function isAdminActionSaving(id) { return Boolean(adminActionSavingState[id]) }

function applyOddsConfig(c={}) {
  oddsConfig.roomId=c.roomId||'sicbo-3p'; oddsConfig.title=c.title||''; oddsConfig.roundDuration=Number(c.roundDuration||240)
  oddsConfig.betLockSeconds=Number(c.betLockSeconds||8); oddsConfig.minBet=Number(c.minBet||1000); oddsConfig.maxBet=Number(c.maxBet||50000)
  oddsConfig.chipOptions=Array.isArray(c.chipOptions)?[...c.chipOptions]:[]; oddsConfig.odds={...(c.odds||{})}
  chipOptionsText.value=oddsConfig.chipOptions.join(', ')
}
function applyPayoutConfig(c={}) {
  payoutConfig.withdrawFeeRate=Number(c.withdrawFeeRate||0); payoutConfig.dailyWithdrawLimit=Number(c.dailyWithdrawLimit||0)
  payoutConfig.maxPendingWithdrawals=Number(c.maxPendingWithdrawals||1)
  payoutConfig.autoApproveDeposit=Boolean(c.autoApproveDeposit); payoutConfig.autoApproveWithdraw=Boolean(c.autoApproveWithdraw)
}
function applySicboControl(s={}) {
  sicboControl.roomId=s.roomId||selectedOddsRoomId.value; sicboControl.roundId=s.roundId||'--'
  sicboControl.timeLeft=Number(s.timeLeft||0); sicboControl.bettingOpen=Boolean(s.bettingOpen)
  sicboControl.betTotalAmount=Number(s.betTotalAmount||0); sicboControl.betCount=Number(s.betCount||0)
  sicboControl.forcedResult=Array.isArray(s.forcedResult)?[...s.forcedResult]:null
  sicboControl.forcedNote=s.forcedNote||''; sicboControl.summary=s.summary||null
  forcedResultForm.d1=sicboControl.forcedResult?.[0]?String(sicboControl.forcedResult[0]):''
  forcedResultForm.d2=sicboControl.forcedResult?.[1]?String(sicboControl.forcedResult[1]):''
  forcedResultForm.d3=sicboControl.forcedResult?.[2]?String(sicboControl.forcedResult[2]):''
  forcedResultForm.forcedNote=sicboControl.forcedNote
}
function buildOddsPayload() {
  const chips=chipOptionsText.value.split(',').map(i=>Number(i.trim())).filter(v=>v>0)
  return { roundDuration:Number(oddsConfig.roundDuration||0), betLockSeconds:Number(oddsConfig.betLockSeconds||0),
    minBet:Number(oddsConfig.minBet||0), maxBet:Number(oddsConfig.maxBet||0), chipOptions:chips,
    odds:Object.fromEntries(Object.entries(oddsConfig.odds||{}).map(([g,v])=>[g,Number(v||0)])) }
}
function buildForcedResultPayload() {
  const raw=[forcedResultForm.d1,forcedResultForm.d2,forcedResultForm.d3]
  if(raw.every(v=>String(v||'').trim()===''))return null
  const result=raw.map(v=>Number(v))
  if(!result.every(v=>Number.isInteger(v)&&v>=1&&v<=6))throw new Error('Kết quả ép phải gồm đúng 3 số từ 1 đến 6')
  return result
}

async function loadOverview() { const d=await apiFetch('/api/admin/overview',{headers:userStore.authHeaders}); overview.stats=d.stats||overview.stats; overview.users=d.users||[]; overview.pendingTransactions=d.pendingTransactions||[] }
async function loadUsers() { const d=await apiFetch('/api/admin/users',{headers:userStore.authHeaders}); users.value=d.items||[] }
async function loadTransactions() { const d=await apiFetch('/api/admin/transactions',{headers:userStore.authHeaders}); transactions.value=d.items||[] }
async function loadGameHistory() { const d=await apiFetch('/api/admin/game-history',{headers:userStore.authHeaders}); gameHistory.value=d.items||[] }
async function loadRoundHistory() { const d=await apiFetch('/api/admin/round-history',{headers:userStore.authHeaders}); roundHistory.value=d.items||[] }
async function loadGameSummary() { const d=await apiFetch('/api/admin/game-summary',{headers:userStore.authHeaders}); gameSummary.value=d.items||[] }
async function loadRevenue() { const d=await apiFetch('/api/admin/revenue',{headers:userStore.authHeaders}); Object.assign(revenue,d.stats||{}) }
async function loadInviteCodes() {
  const d=await apiFetch('/api/admin/invite-codes',{headers:userStore.authHeaders})
  inviteCodes.value=(d.items||[]).map(i=>({...i,inviteCodeDraft:i.inviteCode||''}))
}
async function saveInviteCode(item) {
  if(!item?.userId)return; inviteSavingState[item.userId]=true
  try { loadError.value=''; const d=await apiFetch(`/api/admin/invite-codes/${item.userId}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({inviteCode:String(item.inviteCodeDraft||'').trim()})})
    const u=d.item||{}; inviteCodes.value=inviteCodes.value.map(e=>e.userId===item.userId?{...e,...u,inviteCodeDraft:u.inviteCode||e.inviteCodeDraft||''}:e)
    showToast('Đã lưu mã mời')
  } catch(e){loadError.value=e.message||'Error'} finally{inviteSavingState[item.userId]=false}
}
async function regenerateInviteCode(item) {
  if(!item?.userId)return; inviteSavingState[item.userId]=true
  try { loadError.value=''; const d=await apiFetch(`/api/admin/invite-codes/${item.userId}/regenerate`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})})
    const u=d.item||{}; inviteCodes.value=inviteCodes.value.map(e=>e.userId===item.userId?{...e,...u,inviteCodeDraft:u.inviteCode||e.inviteCodeDraft||''}:e)
    showToast('Đã tạo mã mời mới')
  } catch(e){loadError.value=e.message||'Error'} finally{inviteSavingState[item.userId]=false}
}
async function loadOddsSettings(roomId=selectedOddsRoomId.value) {
  const d=await apiFetch(`/api/admin/odds-settings?roomId=${encodeURIComponent(roomId)}`,{headers:userStore.authHeaders})
  oddsRooms.value=d.rooms||[]; if(d.config?.roomId&&selectedOddsRoomId.value!==d.config.roomId)selectedOddsRoomId.value=d.config.roomId
  applyOddsConfig(d.config||{})
}
async function saveOddsSettings() {
  savingOdds.value=true; try{loadError.value='';const d=await apiFetch(`/api/admin/odds-settings?roomId=${encodeURIComponent(selectedOddsRoomId.value)}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify(buildOddsPayload())}); applyOddsConfig(d.config||{}); showToast('Đã lưu cấu hình kèo')}catch(e){loadError.value=e.message||'Error'}finally{savingOdds.value=false}
}
async function resetOddsSettings() {
  savingOdds.value=true; try{loadError.value='';const d=await apiFetch(`/api/admin/odds-settings/reset?roomId=${encodeURIComponent(selectedOddsRoomId.value)}`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})}); applyOddsConfig(d.config||{}); showToast('Đã reset cấu hình kèo')}catch(e){loadError.value=e.message||'Error'}finally{savingOdds.value=false}
}
async function loadSicboControl(roomId=selectedOddsRoomId.value) {
  const d=await apiFetch(`/api/admin/sicbo-control?roomId=${encodeURIComponent(roomId)}`,{headers:userStore.authHeaders}); applySicboControl(d.state||{})
}
async function saveSicboControl() {
  savingControl.value=true; try{loadError.value='';const d=await apiFetch(`/api/admin/sicbo-control?roomId=${encodeURIComponent(selectedOddsRoomId.value)}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({forcedResult:buildForcedResultPayload(),forcedNote:forcedResultForm.forcedNote})}); applySicboControl(d.state||{}); showToast(`Đã lưu kèo ${formatRoomLabel(selectedOddsRoomId.value)}`)}catch(e){loadError.value=e.message||'Error'}finally{savingControl.value=false}
}
async function clearSicboControl() { forcedResultForm.d1='';forcedResultForm.d2='';forcedResultForm.d3='';forcedResultForm.forcedNote=''; await saveSicboControl() }
async function loadPayoutSettings() { const d=await apiFetch('/api/admin/payout-settings',{headers:userStore.authHeaders}); applyPayoutConfig(d.config||{}) }
async function savePayoutSettings() {
  savingPayout.value=true; try{loadError.value='';const d=await apiFetch('/api/admin/payout-settings',{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({withdrawFeeRate:Number(payoutConfig.withdrawFeeRate||0),dailyWithdrawLimit:Number(payoutConfig.dailyWithdrawLimit||0),maxPendingWithdrawals:Number(payoutConfig.maxPendingWithdrawals||1),autoApproveDeposit:Boolean(payoutConfig.autoApproveDeposit),autoApproveWithdraw:Boolean(payoutConfig.autoApproveWithdraw)})}); applyPayoutConfig(d.config||{}); showToast('Đã lưu cài đặt')}catch(e){loadError.value=e.message||'Error'}finally{savingPayout.value=false}
}
async function loadAdmins() {
  const d=await apiFetch('/api/admin/admins',{headers:userStore.authHeaders}); adminUsers.value=d.items||[]
  adminUsers.value.forEach(a=>{if(typeof adminPasswordDrafts[a._id]!=='string')adminPasswordDrafts[a._id]=''})
}
async function createAdminUser() {
  savingAdminForm.value=true; try{loadError.value='';await apiFetch('/api/admin/admins',{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({username:newAdminForm.username,password:newAdminForm.password,fullName:newAdminForm.fullName,phone:newAdminForm.phone})})
    newAdminForm.username='';newAdminForm.password='';newAdminForm.fullName='';newAdminForm.phone=''; await loadAdmins()
    showToast('Đã tạo admin')
  }catch(e){loadError.value=e.message||'Error'}finally{savingAdminForm.value=false}
}
async function toggleAdminStatus(admin,status) {
  if(!admin?._id)return; adminActionSavingState[admin._id]=true
  try{loadError.value='';await apiFetch(`/api/admin/admins/${admin._id}/status`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({status})}); await loadAdmins(); showToast('Đã cập nhật trạng thái')}catch(e){loadError.value=e.message||'Error'}finally{adminActionSavingState[admin._id]=false}
}
async function resetAdminPassword(admin) {
  if(!admin?._id)return; const pw=String(adminPasswordDrafts[admin._id]||''); if(pw.length<6){loadError.value='Mật khẩu tối thiểu 6 ký tự';return}
  adminActionSavingState[admin._id]=true
  try{loadError.value='';await apiFetch(`/api/admin/admins/${admin._id}/password`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({password:pw})}); adminPasswordDrafts[admin._id]=''; showToast('Đã cập nhật mật khẩu')}catch(e){loadError.value=e.message||'Error'}finally{adminActionSavingState[admin._id]=false}
}
async function loadChatStats() {
  const d = await apiFetch('/api/admin/chat/stats', { headers: userStore.authHeaders })
  Object.assign(chatStats, d.stats || {})
}

async function loadChatRooms() {
  const d = await apiFetch('/api/admin/chat/rooms', { headers: userStore.authHeaders })
  chatRooms.value = d.items || []
  if (!selectedRoomId.value && chatRooms.value.length) {
    selectedRoomId.value = chatRooms.value[0].roomId
  }
}

async function loadSiteConfig() {
  try { const d=await apiFetch('/api/admin/site-config',{headers:userStore.authHeaders}); Object.assign(siteConfig,d.config||{}) } catch { /* ignore */ }
}
async function saveSiteConfig() {
  savingSiteConfig.value=true
  try { const d=await apiFetch('/api/admin/site-config',{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify(siteConfig)}); Object.assign(siteConfig,d.config||{}); showToast('Đã lưu cấu hình website') } catch(e){loadError.value=e.message||'Error'}
  finally{savingSiteConfig.value=false}
}
async function loadAdminBanks() {
  try { const d=await apiFetch('/api/admin/bank-accounts',{headers:userStore.authHeaders}); adminBanks.value=d.items||[] } catch { /* ignore */ }
}
async function saveAdminBank() {
  if(!adminBankForm.accountName||!adminBankForm.bankName||!adminBankForm.bankAccount){loadError.value='Vui lòng nhập đầy đủ';return}
  savingAdminBank.value=true
  try{await apiFetch('/api/admin/bank-accounts',{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify(adminBankForm)})
    adminBankForm.accountName='';adminBankForm.bankName='';adminBankForm.bankAccount='';adminBankForm.transferNote=''
    await loadAdminBanks(); showToast('Đã lưu tài khoản ngân hàng')}catch(e){loadError.value=e.message||'Error'}finally{savingAdminBank.value=false}
}
async function deleteAdminBank(id) {
  try{await apiFetch(`/api/admin/bank-accounts/${id}`,{method:'DELETE',headers:authJsonHeaders.value});await loadAdminBanks(); showToast('Đã xóa tài khoản ngân hàng')}catch(e){loadError.value=e.message||'Error'}
}

async function loadSicbo5pControl() {
  try {
    const d=await apiFetch('/api/admin/sicbo-control?roomId=sicbo-5p',{headers:userStore.authHeaders})
    const s=d.state||{}; sicbo5pControl.roomId='sicbo-5p'; sicbo5pControl.roundId=s.roundId||'--'
    sicbo5pControl.timeLeft=Number(s.timeLeft||0); sicbo5pControl.bettingOpen=Boolean(s.bettingOpen)
    sicbo5pControl.forcedResult=Array.isArray(s.forcedResult)?[...s.forcedResult]:null
  } catch { /* ignore */ }
}

async function saveSicbo5pControl() {
  const raw=[forced5p.d1,forced5p.d2,forced5p.d3]
  let forcedResult=null
  if(!raw.every(v=>String(v||'').trim()==='')) {
    forcedResult=raw.map(v=>Number(v))
    if(!forcedResult.every(v=>Number.isInteger(v)&&v>=1&&v<=6)){alert('Kết quả phải là 3 số 1-6');return}
  }
  try{
    const d=await apiFetch('/api/admin/sicbo-control?roomId=sicbo-5p',{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({forcedResult,forcedNote:''})})
    const s=d.state||{}; sicbo5pControl.forcedResult=Array.isArray(s.forcedResult)?[...s.forcedResult]:null
    showToast('Đã lưu kèo Xúc sắc 5P')
  }catch(e){loadError.value=e.message||'Error'}
}

function sendAdminChat() {
  const text=adminChatInput.value.trim(); if(!text||sendingAdminChat.value)return
  sendingAdminChat.value=true
  const socket=socketStore.connect()
  socket.emit('send_chat_message',{roomId:selectedRoomId.value,content:text,token:userStore.token,messageType:'text'},()=>{sendingAdminChat.value=false})
  adminChatInput.value=''
}

function onAdminChatMessage(msg) {
  if (!msg?.roomId) return

  if (msg.roomId === selectedRoomId.value) {
    if(chatMessages.value.some(m=>m._id===msg._id))return
    chatMessages.value.push(msg)
    nextTick(()=>{if(adminChatRef.value)adminChatRef.value.scrollTop=adminChatRef.value.scrollHeight})
    return
  }

  unreadByRoom[msg.roomId] = Number(unreadByRoom[msg.roomId] || 0) + 1
}

function onAdminChatNotify(payload) {
  const roomId = payload?.roomId
  if (!roomId) return
  if (roomId !== selectedRoomId.value) {
    unreadByRoom[roomId] = Number(unreadByRoom[roomId] || 0) + 1
    showToast('Có tin nhắn mới từ khách')
  }
  void loadChatStats()
  void loadChatRooms()
}

function pickAdminImage() {
  if (!adminChatFileRef.value) return
  adminChatFileRef.value.value = ''
  adminChatFileRef.value.click()
}

async function onAdminPickImage(e) {
  const file = e?.target?.files?.[0]
  if (!file || sendingAdminImage.value || !selectedRoomId.value) return

  sendingAdminImage.value = true
  try {
    const form = new FormData()
    form.append('image', file)

    const res = await fetch(`${String(API_BASE_URL || '').replace(/\\/+$/, '')}/api/account/chat/upload-image`, {
      method: 'POST',
      headers: {
        ...userStore.authHeaders
      },
      body: form
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.message || `HTTP ${res.status}`)
    }

    const data = await res.json().catch(() => ({}))
    const imageUrl = String(data?.imageUrl || '').trim()
    if (!imageUrl) {
      throw new Error('Upload ảnh thất bại')
    }

    const socket = socketStore.connect()
    socket.emit('send_chat_message', {
      roomId: selectedRoomId.value,
      content: '',
      imageUrl,
      token: userStore.token,
      messageType: 'image'
    }, () => {
      sendingAdminImage.value = false
    })
  } catch (err) {
    showToast(err?.message || 'Không thể gửi ảnh', 'error')
    sendingAdminImage.value = false
  }
}

let chatSocketCleanup=null
function setupChatSocket() {
  const socket=socketStore.connect()
  if(chatSocketCleanup)chatSocketCleanup()
  socket.emit('join_chat_admin', { token: userStore.token }, () => {})
  if(selectedRoomId.value)socket.emit('join_chat',{roomId:selectedRoomId.value,token:userStore.token})
  socket.on('chat_message',onAdminChatMessage)
  socket.on('chat_notify', onAdminChatNotify)
  chatSocketCleanup=()=>{
    socket.off('chat_message',onAdminChatMessage)
    socket.off('chat_notify', onAdminChatNotify)
    if(selectedRoomId.value)socket.emit('leave_chat',{roomId:selectedRoomId.value})
  }
}
async function loadChatMessages(roomId) {
  if(!roomId){chatMessages.value=[]; selectedChatUser.value=null; return}
  const d=await apiFetch(`/api/admin/chat/messages/${roomId}`,{headers:userStore.authHeaders})
  chatMessages.value=d.items||[]
  selectedChatUser.value = d.roomUser || null
  unreadByRoom[roomId] = 0
  await nextTick()
  if (adminChatRef.value) adminChatRef.value.scrollTop = adminChatRef.value.scrollHeight
}
async function loadMobileChatRooms() { const d=await apiFetch('/api/admin/chat-mobile/rooms',{headers:userStore.authHeaders}); mobileChatRooms.value=d.items||[]; if(!selectedMobileRoomId.value&&mobileChatRooms.value.length)selectedMobileRoomId.value=mobileChatRooms.value[0].roomId }
async function loadMobileChatMessages(roomId) { if(!roomId){mobileChatMessages.value=[];return}; const d=await apiFetch(`/api/admin/chat-mobile/messages/${roomId}`,{headers:userStore.authHeaders}); mobileChatMessages.value=d.items||[] }
async function loadUserDetail(userId) { const d=await apiFetch(`/api/admin/users/${userId}`,{headers:userStore.authHeaders}); selectedUser.value=d.user||null }

async function loadAllData() {
  loadingAll.value=true; loadError.value=''
  try { await Promise.all([loadOverview(),loadUsers(),loadTransactions(),loadGameHistory(),loadRoundHistory(),loadGameSummary(),loadRevenue(),loadInviteCodes(),loadOddsSettings(selectedOddsRoomId.value),loadSicboControl(selectedOddsRoomId.value),loadSicbo5pControl(),loadPayoutSettings(),loadAdmins(),loadChatStats(),loadChatRooms(),loadMobileChatRooms(),loadSiteConfig(),loadAdminBanks()]) }
  catch(e){loadError.value=e.message||'Không thể tải dữ liệu'} finally{loadingAll.value=false}
}

async function refreshAdminData() { await Promise.all([loadOverview(),loadUsers(),loadTransactions(),loadGameHistory(),loadRoundHistory(),loadGameSummary(),loadRevenue()]) }

async function reviewTransaction(txId,action) {
  await apiFetch(`/api/admin/transactions/${txId}/${action}`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})})
  await Promise.all([refreshAdminData(),userStore.fetchMe()])
  showToast(action === 'approve' ? 'Đã duyệt giao dịch' : 'Đã từ chối giao dịch')
}

async function toggleUserStatus(userId,status) {
  await apiFetch(`/api/admin/users/${userId}/status`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({status})})
  await refreshAdminData(); if(selectedUser.value?._id===userId)await loadUserDetail(userId)
  showToast('Đã cập nhật trạng thái người chơi')
}

async function adminAdjustBalance(userId, kind) {
  const key = String(userId || '')
  if (!key) return
  if (isUserRowSaving(key)) return

  const draft = getUserDraft(key)
  const rawAmount = kind === 'bonus' ? draft.bonusAmount : draft.adjustAmount
  const numericAmount = Number(rawAmount || 0)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    showToast('Vui lòng nhập số tiền hợp lệ', 'error')
    return
  }

  userRowSavingState[key] = true
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(key)}/adjust-balance`, {
      method: 'POST',
      headers: authJsonHeaders.value,
      body: JSON.stringify({ kind, amount: numericAmount })
    })
    if (kind === 'bonus') draft.bonusAmount = ''
    else draft.adjustAmount = ''
    await refreshAdminData()
    if (selectedUser.value?._id === key) {
      await loadUserDetail(key)
    }
    showToast('Đã cập nhật số dư')
  } catch (e) {
    showToast(e.message || 'Không thể cập nhật số dư', 'error')
  } finally {
    userRowSavingState[key] = false
  }
}

async function adminSetVip(userId) {
  const key = String(userId || '')
  if (!key) return
  if (isUserRowSaving(key)) return

  const draft = getUserDraft(key)
  const vipLevel = Number(draft.vipLevel || 0)
  if (!Number.isFinite(vipLevel) || vipLevel < 0 || !Number.isInteger(vipLevel)) {
    showToast('VIP không hợp lệ', 'error')
    return
  }

  userRowSavingState[key] = true
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(key)}/vip`, {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify({ vipLevel })
    })
    draft.vipLevel = ''
    await loadUsers()
    showToast('Đã cập nhật VIP')
  } catch (e) {
    showToast(e.message || 'Không thể cập nhật VIP', 'error')
  } finally {
    userRowSavingState[key] = false
  }
}

watch(selectedRoomId, async (nextRoom, prevRoom) => {
  await loadChatMessages(nextRoom)

  const socket = socketStore.socket
  if (!socket) return

  if (prevRoom) {
    socket.emit('leave_chat', { roomId: prevRoom })
  }
  if (nextRoom) {
    socket.emit('join_chat', { roomId: nextRoom, token: userStore.token })
  }
})
watch(selectedMobileRoomId,async r=>{ await loadMobileChatMessages(r) })
watch(selectedOddsRoomId,async r=>{ await Promise.all([loadOddsSettings(r),loadSicboControl(r)]) })
watch(activeTab,(tab)=>{ ensureSicboRealtimeForTab(tab) },{ immediate:true })
watch(
  () => [
    socketStore.roundState.roomId,
    socketStore.roundState.roundId,
    socketStore.roundState.timeLeft,
    socketStore.roundState.bettingOpen,
    socketStore.roundState.betTotalAmount,
    socketStore.roundState.betCount,
    socketStore.roundState.summary
  ],
  () => {
    applySicboRealtimeState(socketStore.roundState)
    void maybeRefreshGameHistoryFromRealtime(socketStore.roundState)
  },
  { immediate: true }
)

onMounted(async ()=>{
  await loadAllData()
  // Ensure socket is connected so the realtime sicbo state can stream in.
  socketStore.connect()
  setupChatSocket()
})

onBeforeUnmount(()=>{
  if(chatSocketCleanup)chatSocketCleanup()
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
  color: #1a1a2e;
}

/* Sidebar */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 250px;
  background: #1e1e2d;
  color: #a2a3b7;
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: transform 0.25s ease;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.sidebar__brand-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar__logo {
  width: 130px;
  height: auto;
  filter: brightness(1.2);
}

.sidebar__domain {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.02em;
}

.sidebar__close {
  display: none;
  border: none;
  background: none;
  color: #a2a3b7;
  font-size: 18px;
  cursor: pointer;
}

.sidebar__nav {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 20px;
  border: none;
  background: transparent;
  color: #a2a3b7;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.sidebar__link:hover {
  background: rgba(255,255,255,0.04);
  color: #fff;
}

.sidebar__link--active {
  background: rgba(99,120,255,0.15);
  color: #6378ff;
  font-weight: 600;
}

.sidebar__link-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
}

.sidebar__footer {
  padding: 12px 0;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.sidebar__link--logout:hover {
  color: #ff6b8a;
}

.sidebar-overlay {
  display: none;
}

/* Main content */
.admin-content {
  flex: 1;
  margin-left: 250px;
  min-height: 100vh;
}

/* Topbar */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8ed;
  position: sticky;
  top: 0;
  z-index: 50;
}

.topbar__hamburger {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: none;
  background: none;
  cursor: pointer;
}

.topbar__hamburger span {
  display: block;
  width: 20px;
  height: 2px;
  background: #333;
  border-radius: 1px;
}

.topbar__breadcrumb {
  flex: 1;
  font-size: 14px;
  color: #888;
}

.topbar__breadcrumb strong {
  color: #1a1a2e;
}

.topbar__breadcrumb-sep {
  margin: 0 6px;
  color: #ccc;
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar__refresh {
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #555;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.topbar__refresh:hover {
  background: #f5f5f5;
}

.topbar__user {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}

.topbar__search {
  height: 34px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  min-width: 200px;
}

/* Admin panel */
.admin-panel {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stats-row--secondary {
  grid-template-columns: repeat(2, 1fr);
}

.stat-card {
  padding: 20px;
  border-radius: 14px;
  color: #fff;
}

.stat-card--blue { background: linear-gradient(135deg, #667eea, #764ba2); }
.stat-card--green { background: linear-gradient(135deg, #43e97b, #38f9d7); color: #1a1a2e; }
.stat-card--orange { background: linear-gradient(135deg, #f6d365, #fda085); color: #1a1a2e; }
.stat-card--purple { background: linear-gradient(135deg, #a18cd1, #fbc2eb); color: #1a1a2e; }
.stat-card--teal { background: linear-gradient(135deg, #2af598, #009efd); }
.stat-card--red { background: linear-gradient(135deg, #ff6a88, #ff99ac); }

.stat-card__label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.85;
}

.stat-card__value {
  display: block;
  margin-top: 8px;
  font-size: 26px;
}

/* Panel card */
.panel-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.panel-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-card__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
}

.panel-card__empty {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

/* Badge */
.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: #e8e8ed;
  color: #555;
}

.badge--success { background: #e6f9ee; color: #1a8a4a; }
.badge--danger { background: #fde8ec; color: #c62828; }
.badge--warning { background: #fff3e0; color: #e65100; }
.badge--info { background: #e8eaf6; color: #3949ab; }

/* Data table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  padding: 10px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background: #f8f9fb;
}

.text-bold { font-weight: 700; }
.text-success { color: #1a8a4a; }
.text-danger { color: #c62828; }

/* Buttons */
.btn {
  padding: 7px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #555;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:hover { background: #f5f5f5; }
.btn--sm { padding: 5px 10px; font-size: 11px; }
.btn--primary { background: #6378ff; color: #fff; border-color: #6378ff; }
.btn--primary:hover { background: #5266e0; }
.btn--success { background: #43e97b; color: #1a1a2e; border-color: #43e97b; }
.btn--danger { background: #ff6b8a; color: #fff; border-color: #ff6b8a; }
.btn--danger:hover { background: #e05575; }

.action-btns {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.action-btns--left { justify-content: flex-start; }

/* Forms */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-field--wide { grid-column: 1 / -1; }

.form-field span {
  font-size: 12px;
  color: #888;
  font-weight: 500;
}

.form-field input,
.form-field select {
  height: 38px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: #1a1a2e;
}

.form-field input:focus,
.form-field select:focus {
  border-color: #6378ff;
}

.inline-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 12px;
  outline: none;
  min-width: 120px;
}

.inline-input--sm {
  height: 30px;
  min-width: 90px;
  width: 140px;
}

.panel-card__header--with-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.panel-card__header--with-tools .inline-input {
  margin-left: auto;
}

.table-scroll {
  width: 100%;
  overflow-x: auto;
}

.data-table--dense th,
.data-table--dense td {
  padding: 8px 10px;
  font-size: 11px;
  white-space: nowrap;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.action-btns--tight {
  justify-content: flex-start;
  flex-wrap: nowrap;
}

.select-input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}

.section-subtitle {
  margin: 18px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #555;
}

.odds-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.odds-quick {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

/* Detail grid */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.detail-grid > div {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8f9fb;
}

.detail-grid span {
  display: block;
  font-size: 11px;
  color: #888;
}

.detail-grid strong {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #1a1a2e;
}

/* Toggle */
.toggle-row {
  display: flex;
  gap: 20px;
  margin-top: 14px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
}

.toggle-item input {
  width: 18px;
  height: 18px;
}

/* Summary cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.summary-card {
  padding: 16px;
  border-radius: 12px;
  background: #f8f9fb;
  border: 1px solid #eee;
}

.summary-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.summary-card__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.summary-card__stat span {
  font-size: 11px;
  color: #888;
}

.summary-card__stat strong {
  display: block;
  font-size: 13px;
  color: #1a1a2e;
}

.summary-card__gates {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.summary-card__gates small {
  font-size: 11px;
  color: #888;
  font-weight: 600;
}

.gate-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: #555;
}

.header-controls {
  display: flex;
  gap: 8px;
}

/* Chat */
.admin-chat-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  min-height: 300px;
}

.admin-chat-rooms {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.admin-chat-room {
  text-align: left;
  padding: 10px 12px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.admin-chat-room--active {
  background: #6378ff;
  border-color: #6378ff;
  color: #fff;
}

.admin-chat-room--active strong { color: #fff; }

.admin-chat-room strong {
  display: block;
  font-size: 13px;
  color: #1a1a2e;
}

.chat-kpi {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.admin-chat-room__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-chat-room span {
  display: block;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-chat-usercard {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #eee;
}

.admin-chat-usercard span {
  display: block;
  font-size: 11px;
  color: #999;
}

.admin-chat-usercard strong {
  display: block;
  font-size: 13px;
  color: #1a1a2e;
}

.admin-chat-image {
  display: block;
  max-width: 260px;
  max-height: 260px;
  border-radius: 12px;
  object-fit: cover;
  margin-top: 6px;
}

.admin-chat-file {
  display: none;
}

.admin-chat-messages {
  padding: 16px;
  border-radius: 12px;
  background: #f8f9fb;
  border: 1px solid #eee;
  overflow-y: auto;
  max-height: 400px;
}

.admin-chat-msg {
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 10px;
  background: #fff;
}

.admin-chat-msg--admin {
  background: #f0f4ff !important;
  border-left: 3px solid #6378ff;
}

.admin-chat-msg strong {
  font-size: 13px;
  color: #1a1a2e;
}

.admin-chat-input {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.admin-chat-input input[type="text"] {
  flex: 1;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 13px;
  outline: none;
}

.admin-chat-input input[type="text"]:focus {
  border-color: #6378ff;
}

.admin-chat-msg p {
  margin: 4px 0;
  font-size: 13px;
  color: #555;
}

.admin-chat-msg small {
  font-size: 11px;
  color: #999;
}

/* Footer */
.admin-footer {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: #aaa;
  letter-spacing: 0.02em;
}

.admin-footer strong {
  color: #6378ff;
  font-weight: 700;
}

.admin-toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(18, 18, 18, 0.92);
  color: #fff;
  box-shadow: 0 12px 30px rgba(0,0,0,0.25);
  z-index: 9999;
  max-width: min(360px, calc(100vw - 32px));
}

.admin-toast--success {
  border-left: 4px solid #4caf50;
}

.admin-toast--error {
  border-left: 4px solid #e53935;
}

.admin-toast__close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(255,255,255,0.12);
  color: #fff;
  cursor: pointer;
}

/* ===== Set Kèo Hero ===== */
.keo-hero {
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(135deg, #1a237e, #283593);
  color: #fff;
  text-align: center;
}

.keo-hero--5p {
  background: linear-gradient(135deg, #4a148c, #6a1b9a);
}

.keo-hero h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
}

.keo-hero__meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  font-size: 14px;
}

.keo-hero__timer {
  font-size: 28px;
  font-weight: 800;
  color: #ffd740;
  font-variant-numeric: tabular-nums;
}

.keo-status--open {
  padding: 3px 12px;
  border-radius: 20px;
  background: #43a047;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.keo-status--closed {
  padding: 3px 12px;
  border-radius: 20px;
  background: #e53935;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

/* Keo Control */
.keo-control {
  padding: 20px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  text-align: center;
}

.keo-control__label {
  margin: 0 0 12px;
  font-size: 15px;
  color: #555;
}

.keo-control__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.keo-select {
  width: 56px;
  height: 44px;
  border: 2px solid #ddd;
  border-radius: 10px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  outline: none;
  background: #fafafa;
}

.keo-select:focus {
  border-color: #6378ff;
}

/* Error */
.error-banner {
  margin: 0 24px 20px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #fde8ec;
  color: #c62828;
  font-size: 13px;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .detail-grid { grid-template-columns: repeat(2, 1fr); }
  .odds-grid { grid-template-columns: repeat(2, 1fr); }
  .summary-cards { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .sidebar__close {
    display: block;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 99;
  }

  .admin-content {
    margin-left: 0;
  }

  .topbar__hamburger {
    display: flex;
  }

  .stats-row,
  .form-grid,
  .detail-grid,
  .odds-grid,
  .odds-quick {
    grid-template-columns: 1fr;
  }

  .admin-panel {
    padding: 16px;
  }

  .admin-chat-layout {
    grid-template-columns: 1fr;
  }

  .panel-card {
    overflow-x: auto;
  }

  .data-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    min-width: 920px;
  }
}
</style>
