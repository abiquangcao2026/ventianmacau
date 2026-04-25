<template>
  <section class="admin-layout">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
      <div class="sidebar__brand">
        <img alt="The Venetian" src="/img/the-venetian-wordmark.svg" class="sidebar__logo" />
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
          <div class="panel-card__header"><h3>Người chơi</h3><span class="badge">{{ users.length }}</span></div>
          <div v-if="users.length === 0" class="panel-card__empty">Chưa có dữ liệu người chơi.</div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Username</th>
                <th>SĐT</th>
                <th>Số dư</th>
                <th>Tổng nạp</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in users" :key="member._id">
                <td>{{ member.fullName || member.username }}</td>
                <td>@{{ member.username }}</td>
                <td>{{ member.phone || '--' }}</td>
                <td>{{ formatMoney(member.balance) }}</td>
                <td>{{ formatMoney(member.totalDeposit) }}</td>
                <td>
                  <span class="badge" :class="member.status === 'active' ? 'badge--success' : 'badge--danger'">
                    {{ member.status }}
                  </span>
                </td>
                <td>
                  <div class="action-btns">
                    <button v-if="member.role !== 'admin' && member.status === 'active'" class="btn btn--danger btn--sm" @click="toggleUserStatus(member._id, 'locked')">Khóa</button>
                    <button v-else-if="member.role !== 'admin'" class="btn btn--success btn--sm" @click="toggleUserStatus(member._id, 'active')">Mở khóa</button>
                    <button class="btn btn--primary btn--sm" @click="loadUserDetail(member._id)">Chi tiết</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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

      <!-- Odds Settings -->
      <div v-if="activeTab === 'odds-settings'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header">
            <h3>Set kèo theo room</h3>
            <div class="header-controls">
              <select v-model="selectedOddsRoomId" class="select-input">
                <option v-for="room in oddsRooms" :key="room.roomId" :value="room.roomId">{{ room.title }}</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <label class="form-field"><span>Thời gian phiên (giây)</span><input v-model.number="oddsConfig.roundDuration" type="number" min="10" /></label>
            <label class="form-field"><span>Khóa cược trước (giây)</span><input v-model.number="oddsConfig.betLockSeconds" type="number" min="1" /></label>
            <label class="form-field"><span>Cược tối thiểu</span><input v-model.number="oddsConfig.minBet" type="number" min="1" /></label>
            <label class="form-field"><span>Cược tối đa</span><input v-model.number="oddsConfig.maxBet" type="number" min="1" /></label>
            <label class="form-field form-field--wide"><span>Chip options</span><input v-model="chipOptionsText" type="text" placeholder="1000, 5000, 10000" /></label>
          </div>

          <h4 class="section-subtitle">Tỉ lệ cược</h4>
          <div class="odds-grid">
            <label v-for="(value, gate) in oddsConfig.odds" :key="gate" class="form-field">
              <span>{{ formatGateLabel(gate) }}</span>
              <input v-model.number="oddsConfig.odds[gate]" type="number" step="0.01" min="0" />
            </label>
          </div>

          <div class="action-btns action-btns--left" style="margin-top:16px">
            <button class="btn btn--primary" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu set kèo' }}</button>
            <button class="btn" :disabled="savingOdds" @click="resetOddsSettings">Khôi phục mặc định</button>
          </div>
        </div>

        <!-- Sicbo Control -->
        <div class="panel-card">
          <div class="panel-card__header">
            <h3>Chỉnh kết quả phiên mở</h3>
            <span class="badge badge--warning">Phiên {{ sicboControl.roundId }} · {{ formatCountdown(sicboControl.timeLeft) }}</span>
          </div>

          <div class="detail-grid" style="margin-bottom:16px">
            <div><span>Room</span><strong>{{ formatRoomLabel(sicboControl.roomId) }}</strong></div>
            <div><span>Trạng thái</span><strong>{{ sicboControl.bettingOpen ? 'Đang mở cược' : 'Khóa cược' }}</strong></div>
            <div><span>Tổng cược</span><strong>{{ formatMoney(sicboControl.betTotalAmount) }}</strong></div>
            <div><span>Số lệnh</span><strong>{{ sicboControl.betCount }}</strong></div>
            <div><span>Ép hiện tại</span><strong>{{ formatForcedResult(sicboControl.forcedResult) }}</strong></div>
            <div><span>Kết quả gần nhất</span><strong>{{ sicboControl.summary ? formatForcedResult(sicboControl.summary.result) : '--' }}</strong></div>
          </div>

          <div class="form-grid">
            <label class="form-field">
              <span>Xúc xắc 1</span>
              <select v-model="forcedResultForm.d1"><option value="">Ngẫu nhiên</option><option v-for="v in [1,2,3,4,5,6]" :key="`d1-${v}`" :value="String(v)">{{ v }}</option></select>
            </label>
            <label class="form-field">
              <span>Xúc xắc 2</span>
              <select v-model="forcedResultForm.d2"><option value="">Ngẫu nhiên</option><option v-for="v in [1,2,3,4,5,6]" :key="`d2-${v}`" :value="String(v)">{{ v }}</option></select>
            </label>
            <label class="form-field">
              <span>Xúc xắc 3</span>
              <select v-model="forcedResultForm.d3"><option value="">Ngẫu nhiên</option><option v-for="v in [1,2,3,4,5,6]" :key="`d3-${v}`" :value="String(v)">{{ v }}</option></select>
            </label>
            <label class="form-field form-field--wide"><span>Ghi chú</span><input v-model="forcedResultForm.forcedNote" type="text" placeholder="Ghi chú điều khiển" /></label>
          </div>

          <div class="action-btns action-btns--left" style="margin-top:12px">
            <button class="btn btn--primary" :disabled="savingControl" @click="saveSicboControl">{{ savingControl ? 'Đang lưu...' : 'Áp kết quả' }}</button>
            <button class="btn btn--danger" :disabled="savingControl" @click="clearSicboControl">Bỏ ép</button>
          </div>
        </div>
      </div>

      <!-- Payout Settings -->
      <div v-if="activeTab === 'payout-settings'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Cài đặt trả thưởng</h3></div>
          <div class="form-grid">
            <label class="form-field"><span>Phí rút (%)</span><input v-model.number="payoutConfig.withdrawFeeRate" type="number" min="0" step="0.01" /></label>
            <label class="form-field"><span>Giới hạn rút/ngày</span><input v-model.number="payoutConfig.dailyWithdrawLimit" type="number" min="0" /></label>
            <label class="form-field"><span>Số lệnh chờ tối đa</span><input v-model.number="payoutConfig.maxPendingWithdrawals" type="number" min="1" /></label>
          </div>
          <div class="toggle-row">
            <label class="toggle-item"><input v-model="payoutConfig.autoApproveDeposit" type="checkbox" /><span>Tự duyệt nạp tiền</span></label>
            <label class="toggle-item"><input v-model="payoutConfig.autoApproveWithdraw" type="checkbox" /><span>Tự duyệt rút tiền</span></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:16px">
            <button class="btn btn--primary" :disabled="savingPayout" @click="savePayoutSettings">{{ savingPayout ? 'Đang lưu...' : 'Lưu cài đặt' }}</button>
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
          <div class="panel-card__header"><h3>Chat / CSKH</h3></div>
          <div class="admin-chat-layout">
            <div class="admin-chat-rooms">
              <button v-for="room in chatRooms" :key="room.roomId" class="admin-chat-room" :class="{ 'admin-chat-room--active': selectedRoomId === room.roomId }" @click="selectedRoomId = room.roomId">
                <strong>{{ room.title }}</strong>
                <span>{{ room.lastMessage }}</span>
              </button>
            </div>
            <div class="admin-chat-messages">
              <div v-if="chatMessages.length === 0" class="panel-card__empty">Chọn phòng để xem tin nhắn.</div>
              <div v-for="msg in chatMessages" :key="msg.id" class="admin-chat-msg">
                <strong>{{ msg.sender }}</strong>
                <p>{{ msg.content }}</p>
                <small>{{ formatDate(msg.createdAt) }}</small>
              </div>
            </div>
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

      <!-- Error -->
      <div v-if="loadError" class="error-banner">{{ loadError }}</div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '@/lib/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const sidebarOpen = ref(false)

const tabs = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'game-summary', label: 'Tổng quan game', icon: '🎲' },
  { key: 'users', label: 'Người chơi', icon: '👥' },
  { key: 'transactions', label: 'Nạp / Rút', icon: '💳' },
  { key: 'game-history', label: 'Lịch sử game', icon: '📜' },
  { key: 'revenue', label: 'Doanh thu', icon: '💰' },
  { key: 'invite-codes', label: 'Mã mời', icon: '🎟️' },
  { key: 'odds-settings', label: 'Cài đặt kèo', icon: '⚙️' },
  { key: 'payout-settings', label: 'Trả thưởng', icon: '🏦' },
  { key: 'admins', label: 'Quản trị viên', icon: '🔑' },
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'chat-mobile', label: 'Chat Mobile', icon: '📱' }
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
const inviteSavingState = reactive({})
const adminActionSavingState = reactive({})
const adminPasswordDrafts = reactive({})
const forcedResultForm = reactive({ d1: '', d2: '', d3: '', forcedNote: '' })
const newAdminForm = reactive({ username: '', password: '', fullName: '', phone: '' })

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
  minBet: 1000, maxBet: 50000, chipOptions: [], odds: {}
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
const mobileChatRooms = ref([])
const mobileChatMessages = ref([])

const currentTabLabel = computed(() => tabs.find(t => t.key === activeTab.value)?.label || 'Dashboard')

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
function formatTransactionType(type) {
  const m = { deposit_pending:'Yêu cầu nạp', deposit:'Nạp thành công', deposit_rejected:'Từ chối nạp', withdraw_pending:'Yêu cầu rút', withdraw:'Rút thành công', withdraw_rejected:'Từ chối rút', bet:'Đặt cược', win:'Trả thưởng' }
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
  } catch(e){loadError.value=e.message||'Error'} finally{inviteSavingState[item.userId]=false}
}
async function regenerateInviteCode(item) {
  if(!item?.userId)return; inviteSavingState[item.userId]=true
  try { loadError.value=''; const d=await apiFetch(`/api/admin/invite-codes/${item.userId}/regenerate`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})})
    const u=d.item||{}; inviteCodes.value=inviteCodes.value.map(e=>e.userId===item.userId?{...e,...u,inviteCodeDraft:u.inviteCode||e.inviteCodeDraft||''}:e)
  } catch(e){loadError.value=e.message||'Error'} finally{inviteSavingState[item.userId]=false}
}
async function loadOddsSettings(roomId=selectedOddsRoomId.value) {
  const d=await apiFetch(`/api/admin/odds-settings?roomId=${encodeURIComponent(roomId)}`,{headers:userStore.authHeaders})
  oddsRooms.value=d.rooms||[]; if(d.config?.roomId&&selectedOddsRoomId.value!==d.config.roomId)selectedOddsRoomId.value=d.config.roomId
  applyOddsConfig(d.config||{})
}
async function saveOddsSettings() {
  savingOdds.value=true; try{loadError.value='';const d=await apiFetch(`/api/admin/odds-settings?roomId=${encodeURIComponent(selectedOddsRoomId.value)}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify(buildOddsPayload())}); applyOddsConfig(d.config||{})}catch(e){loadError.value=e.message||'Error'}finally{savingOdds.value=false}
}
async function resetOddsSettings() {
  savingOdds.value=true; try{loadError.value='';const d=await apiFetch(`/api/admin/odds-settings/reset?roomId=${encodeURIComponent(selectedOddsRoomId.value)}`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})}); applyOddsConfig(d.config||{})}catch(e){loadError.value=e.message||'Error'}finally{savingOdds.value=false}
}
async function loadSicboControl(roomId=selectedOddsRoomId.value) {
  const d=await apiFetch(`/api/admin/sicbo-control?roomId=${encodeURIComponent(roomId)}`,{headers:userStore.authHeaders}); applySicboControl(d.state||{})
}
async function saveSicboControl() {
  savingControl.value=true; try{loadError.value='';const d=await apiFetch(`/api/admin/sicbo-control?roomId=${encodeURIComponent(selectedOddsRoomId.value)}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({forcedResult:buildForcedResultPayload(),forcedNote:forcedResultForm.forcedNote})}); applySicboControl(d.state||{})}catch(e){loadError.value=e.message||'Error'}finally{savingControl.value=false}
}
async function clearSicboControl() { forcedResultForm.d1='';forcedResultForm.d2='';forcedResultForm.d3='';forcedResultForm.forcedNote=''; await saveSicboControl() }
async function loadPayoutSettings() { const d=await apiFetch('/api/admin/payout-settings',{headers:userStore.authHeaders}); applyPayoutConfig(d.config||{}) }
async function savePayoutSettings() {
  savingPayout.value=true; try{loadError.value='';const d=await apiFetch('/api/admin/payout-settings',{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({withdrawFeeRate:Number(payoutConfig.withdrawFeeRate||0),dailyWithdrawLimit:Number(payoutConfig.dailyWithdrawLimit||0),maxPendingWithdrawals:Number(payoutConfig.maxPendingWithdrawals||1),autoApproveDeposit:Boolean(payoutConfig.autoApproveDeposit),autoApproveWithdraw:Boolean(payoutConfig.autoApproveWithdraw)})}); applyPayoutConfig(d.config||{})}catch(e){loadError.value=e.message||'Error'}finally{savingPayout.value=false}
}
async function loadAdmins() {
  const d=await apiFetch('/api/admin/admins',{headers:userStore.authHeaders}); adminUsers.value=d.items||[]
  adminUsers.value.forEach(a=>{if(typeof adminPasswordDrafts[a._id]!=='string')adminPasswordDrafts[a._id]=''})
}
async function createAdminUser() {
  savingAdminForm.value=true; try{loadError.value='';await apiFetch('/api/admin/admins',{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({username:newAdminForm.username,password:newAdminForm.password,fullName:newAdminForm.fullName,phone:newAdminForm.phone})})
    newAdminForm.username='';newAdminForm.password='';newAdminForm.fullName='';newAdminForm.phone=''; await loadAdmins()
  }catch(e){loadError.value=e.message||'Error'}finally{savingAdminForm.value=false}
}
async function toggleAdminStatus(admin,status) {
  if(!admin?._id)return; adminActionSavingState[admin._id]=true
  try{loadError.value='';await apiFetch(`/api/admin/admins/${admin._id}/status`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({status})}); await loadAdmins()}catch(e){loadError.value=e.message||'Error'}finally{adminActionSavingState[admin._id]=false}
}
async function resetAdminPassword(admin) {
  if(!admin?._id)return; const pw=String(adminPasswordDrafts[admin._id]||''); if(pw.length<6){loadError.value='Mật khẩu tối thiểu 6 ký tự';return}
  adminActionSavingState[admin._id]=true
  try{loadError.value='';await apiFetch(`/api/admin/admins/${admin._id}/password`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({password:pw})}); adminPasswordDrafts[admin._id]=''}catch(e){loadError.value=e.message||'Error'}finally{adminActionSavingState[admin._id]=false}
}
async function loadChatRooms() { const d=await apiFetch('/api/admin/chat/rooms',{headers:userStore.authHeaders}); chatRooms.value=d.items||[]; if(!selectedRoomId.value&&chatRooms.value.length)selectedRoomId.value=chatRooms.value[0].roomId }
async function loadChatMessages(roomId) { if(!roomId){chatMessages.value=[];return}; const d=await apiFetch(`/api/admin/chat/messages/${roomId}`,{headers:userStore.authHeaders}); chatMessages.value=d.items||[] }
async function loadMobileChatRooms() { const d=await apiFetch('/api/admin/chat-mobile/rooms',{headers:userStore.authHeaders}); mobileChatRooms.value=d.items||[]; if(!selectedMobileRoomId.value&&mobileChatRooms.value.length)selectedMobileRoomId.value=mobileChatRooms.value[0].roomId }
async function loadMobileChatMessages(roomId) { if(!roomId){mobileChatMessages.value=[];return}; const d=await apiFetch(`/api/admin/chat-mobile/messages/${roomId}`,{headers:userStore.authHeaders}); mobileChatMessages.value=d.items||[] }
async function loadUserDetail(userId) { const d=await apiFetch(`/api/admin/users/${userId}`,{headers:userStore.authHeaders}); selectedUser.value=d.user||null }

async function loadAllData() {
  loadingAll.value=true; loadError.value=''
  try { await Promise.all([loadOverview(),loadUsers(),loadTransactions(),loadGameHistory(),loadRoundHistory(),loadGameSummary(),loadRevenue(),loadInviteCodes(),loadOddsSettings(selectedOddsRoomId.value),loadSicboControl(selectedOddsRoomId.value),loadPayoutSettings(),loadAdmins(),loadChatRooms(),loadMobileChatRooms()]) }
  catch(e){loadError.value=e.message||'Không thể tải dữ liệu'} finally{loadingAll.value=false}
}

async function refreshAdminData() { await Promise.all([loadOverview(),loadUsers(),loadTransactions(),loadGameHistory(),loadRoundHistory(),loadGameSummary(),loadRevenue()]) }

async function reviewTransaction(txId,action) {
  await apiFetch(`/api/admin/transactions/${txId}/${action}`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})})
  await Promise.all([refreshAdminData(),userStore.fetchMe()])
}

async function toggleUserStatus(userId,status) {
  await apiFetch(`/api/admin/users/${userId}/status`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({status})})
  await refreshAdminData(); if(selectedUser.value?._id===userId)await loadUserDetail(userId)
}

watch(selectedRoomId,async r=>{ await loadChatMessages(r) })
watch(selectedMobileRoomId,async r=>{ await loadMobileChatMessages(r) })
watch(selectedOddsRoomId,async r=>{ await Promise.all([loadOddsSettings(r),loadSicboControl(r)]) })

onMounted(loadAllData)
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

.sidebar__logo {
  width: 130px;
  height: auto;
  filter: brightness(1.2);
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

.admin-chat-room span {
  display: block;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.admin-chat-msg strong {
  font-size: 13px;
  color: #1a1a2e;
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
  .odds-grid {
    grid-template-columns: 1fr;
  }

  .admin-panel {
    padding: 16px;
  }

  .admin-chat-layout {
    grid-template-columns: 1fr;
  }

  .data-table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
