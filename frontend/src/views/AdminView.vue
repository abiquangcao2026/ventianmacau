<template>
  <section class="admin-layout" :class="{ 'admin-layout--chat': activeTab === 'chat' }">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
      <div class="sidebar__brand">
        <div class="sidebar__brand-info">
          <img :alt="siteBrandDisplayName" :src="resolvedSiteLogoSrc" class="sidebar__logo" />
          <span class="sidebar__domain">{{ siteAdminCaptionDisplay }}</span>
        </div>
        <button class="sidebar__close" @click="sidebarOpen = false">✕</button>
      </div>

      <nav class="sidebar__nav">
        <div v-for="group in adminNavGroups" :key="group.key" class="sidebar__section">
          <button
            class="sidebar__section-toggle"
            :class="{ 'sidebar__section-toggle--active': isAdminNavGroupActive(group) }"
            @click="toggleAdminNavGroup(group.key)"
          >
            <span>{{ group.label }}</span>
            <span class="sidebar__caret" :class="{ 'sidebar__caret--open': isAdminNavGroupOpen(group) }">▾</span>
          </button>
          <div v-if="isAdminNavGroupOpen(group)" class="sidebar__submenu sidebar__submenu--group">
            <template v-for="item in group.items" :key="item.key">
              <button
                v-if="item.children"
                class="sidebar__sublink sidebar__sublink--nav sidebar__sublink--parent"
                :class="{ 'sidebar__sublink--active': isAdminNavItemActive(item) }"
                @click="kenoMenuOpen = !kenoMenuOpen"
              >
                <span class="sidebar__link-icon" v-html="item.icon"></span>
                <span>{{ item.label }}</span>
                <span class="sidebar__caret" :class="{ 'sidebar__caret--open': kenoMenuOpen }">▾</span>
              </button>
              <div v-if="item.children && kenoMenuOpen" class="sidebar__nested">
                <button
                  v-for="child in item.children"
                  :key="child.key"
                  class="sidebar__sublink sidebar__sublink--child"
                  :class="{ 'sidebar__sublink--active': activeTab === child.key }"
                  @click="setActiveTab(child.key); sidebarOpen = false"
                >
                  <span>{{ child.label }}</span>
                </button>
              </div>
              <button
                v-if="!item.children"
                class="sidebar__sublink sidebar__sublink--nav"
                :class="{ 'sidebar__sublink--active': activeTab === item.key }"
                @click="setActiveTab(item.key); sidebarOpen = false"
              >
                <span class="sidebar__link-icon" v-html="item.icon"></span>
                <span>{{ item.label }}</span>
              </button>
            </template>
          </div>
        </div>
      </nav>

      <div class="sidebar__footer">
        <button class="sidebar__link" @click="goToGame">
          <span class="sidebar__link-icon" v-html="gamepadIcon"></span>
          <span>Về trang game</span>
        </button>
        <button class="sidebar__link sidebar__link--logout" @click="handleLogout">
          <span class="sidebar__link-icon" v-html="logoutIcon"></span>
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>

    <!-- Overlay for mobile -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- Main content -->
    <div class="admin-content" :class="{ 'admin-content--chat': activeTab === 'chat' }">
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
          <button v-if="unreadChatCount > 0" class="topbar__notify topbar__notify--alert" @click="setActiveTab('chat')">
            <span>CSKH</span>
            <strong>{{ unreadChatCount }}</strong>
          </button>
          <button v-if="showTopbarRefresh" class="topbar__refresh" :disabled="loadingAll" @click="loadAllData">
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

        <div class="dashboard-analytics-grid">
          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Biểu đồ tổng quan doanh thu</h3>
                <p class="panel-card__subtext">So sánh nhanh dòng tiền, tổng cược, trả thưởng và doanh thu game trên cùng một khung đo lường.</p>
              </div>
            </div>
            <div class="analytics-bars">
              <div v-for="metric in revenueOverviewMetrics" :key="metric.key" class="analytics-bar-row">
                <div class="analytics-bar-row__meta">
                  <strong>{{ metric.label }}</strong>
                  <span>{{ metric.display }}</span>
                </div>
                <div class="analytics-bar-track">
                  <div class="analytics-bar-fill" :class="`analytics-bar-fill--${metric.tone}`" :style="{ width: `${metric.percent}%` }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Cơ cấu dòng tiền</h3>
                <p class="panel-card__subtext">Biểu đồ tròn hiển thị tỷ trọng nạp, rút và doanh thu game theo tổng giá trị hiện tại.</p>
              </div>
            </div>
            <div class="analytics-donut">
              <svg viewBox="0 0 220 220" class="analytics-donut__svg" aria-hidden="true">
                <circle cx="110" cy="110" r="72" class="analytics-donut__base"></circle>
                <circle
                  v-for="segment in revenueDonutSegments"
                  :key="segment.key"
                  cx="110"
                  cy="110"
                  r="72"
                  class="analytics-donut__segment"
                  :class="`analytics-donut__segment--${segment.tone}`"
                  :stroke-dasharray="segment.dasharray"
                  :stroke-dashoffset="segment.dashoffset"
                ></circle>
              </svg>
              <div class="analytics-donut__center">
                <strong>{{ formatMoney(revenue.totalDeposit + revenue.totalWithdraw + revenue.netGamingRevenue) }}</strong>
                <span>Tổng lưu chuyển</span>
              </div>
            </div>
            <div class="analytics-legend">
              <div v-for="segment in revenueDonutSegments" :key="`legend-${segment.key}`" class="analytics-legend__item">
                <span class="analytics-legend__dot" :class="`analytics-legend__dot--${segment.tone}`"></span>
                <span>{{ segment.label }}</span>
                <strong>{{ segment.display }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Pending transactions -->
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Yêu cầu chờ duyệt</h3>
              <p class="panel-card__subtext">Theo dõi nhanh yêu cầu ví đang treo để duyệt ngay trong một màn hình.</p>
            </div>
            <span class="badge badge--warning">{{ overview.pendingTransactions.length }}</span>
          </div>
          <div v-if="overview.pendingTransactions.length === 0" class="panel-card__empty">
            Không có yêu cầu chờ xử lý.
          </div>
          <div v-else class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Người chơi</th>
                  <th>Loại</th>
                  <th>Thông tin thanh toán</th>
                  <th>Số tiền</th>
                  <th>Thời gian</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in overview.pendingTransactions" :key="item._id">
                  <td>{{ item.userId?.fullName || item.userId?.username || 'N/A' }}</td>
                  <td>{{ formatTransactionType(item.type) }}</td>
                  <td>
                    <div class="request-payment">
                      <strong>{{ buildPendingPaymentInfo(item).bank || '--' }}</strong>
                      <span>{{ buildPendingPaymentInfo(item).accountName || buildPendingPaymentInfo(item).note || 'Chưa có tên nhận' }}</span>
                      <small>{{ buildPendingPaymentInfo(item).accountNumber || '--' }}</small>
                    </div>
                  </td>
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
            <span class="badge">{{ paginationSummary(userPaging) }}</span>
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
                  <th>TRUY CẬP CUỐI</th>
                  <th>MÃ GT</th>
                  <th>SỐ TIỀN</th>
                  <th>ADMIN CỘNG</th>
                  <th>ADMIN TRỪ</th>
                  <th>TỔNG ĐẶT</th>
                  <th>TỔNG WIN</th>
                  <th>NẠP / RÚT</th>
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
                  <td>{{ formatDate(member.lastLoginAt || member.updatedAt || member.createdAt) }}</td>
                  <td>{{ member.referredByCode || '--' }}</td>
                  <td>{{ formatMoney(member.balance) }}</td>
                  <td>{{ formatMoney(member.adminCreditTotal) }}</td>
                  <td>{{ formatMoney(member.adminDebitTotal) }}</td>
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
          <div class="admin-pagination">
            <span>{{ paginationSummary(userPaging) }}</span>
            <div class="admin-pagination__actions">
              <button class="btn btn--sm" :disabled="!hasPrevPage(userPaging) || userPaging.loading" @click="changeUserPage(-1)">Trước</button>
              <button class="btn btn--sm" :disabled="!hasNextPage(userPaging) || userPaging.loading" @click="changeUserPage(1)">Sau</button>
            </div>
          </div>
        </div>
        <div v-if="selectedUser" class="admin-user-overlay" @click.self="closeSelectedUserDetail">
          <div class="panel-card admin-user-sheet">
            <div class="admin-user-sheet__head">
              <div>
                <h3>Hồ sơ người chơi: @{{ selectedUser.username }}</h3>
                <p class="panel-card__subtext">Hiển thị tập trung toàn bộ hồ sơ, tài khoản ngân hàng, bảo mật và hoạt động gần nhất của khách hàng.</p>
              </div>
              <div class="admin-user-sheet__head-actions">
                <div class="request-board__stats">
                  <span class="badge badge--info">{{ selectedUser.userCode || '--' }}</span>
                  <span class="badge" :class="selectedUser.status === 'active' ? 'badge--success' : 'badge--danger'">
                    {{ selectedUser.status === 'active' ? 'Đang hoạt động' : 'Đã khóa' }}
                  </span>
                  <span class="badge badge--warning">VIP {{ Number(selectedUser.vipLevel || 0) }}</span>
                </div>
                <button class="admin-user-sheet__close" type="button" @click="closeSelectedUserDetail">×</button>
              </div>
            </div>

            <div class="stats-row stats-row--secondary">
              <div class="stat-card stat-card--blue"><span class="stat-card__label">Số dư hiện tại</span><strong class="stat-card__value">{{ formatMoney(selectedUser.balance) }}</strong></div>
              <div class="stat-card stat-card--teal"><span class="stat-card__label">Tổng nạp / rút</span><strong class="stat-card__value">{{ formatMoney(selectedUser.totalDeposit) }} / {{ formatMoney(selectedUser.totalWithdraw) }}</strong></div>
              <div class="stat-card stat-card--purple"><span class="stat-card__label">Tổng đặt / tổng thắng</span><strong class="stat-card__value">{{ formatMoney(selectedUser.totalBetAmount) }} / {{ formatMoney(selectedUser.totalWinAmount) }}</strong></div>
            </div>

            <div class="admin-user-summary-grid">
              <div class="admin-user-summary-card"><span>Mã giới thiệu</span><strong>{{ selectedUser.referredByCode || '--' }}</strong></div>
              <div class="admin-user-summary-card"><span>Tên đầy đủ</span><strong>{{ selectedUser.fullName || '--' }}</strong></div>
              <div class="admin-user-summary-card"><span>Điện thoại</span><strong>{{ selectedUser.phone || '--' }}</strong></div>
              <div class="admin-user-summary-card"><span>IP gần nhất</span><strong>{{ selectedUser.lastLoginIp || '--' }}</strong></div>
              <div class="admin-user-summary-card"><span>Đăng nhập gần nhất</span><strong>{{ formatDate(selectedUser.lastLoginAt) }}</strong></div>
              <div class="admin-user-summary-card"><span>Tạo lúc</span><strong>{{ formatDate(selectedUser.createdAt) }}</strong></div>
            </div>

            <div class="detail-edit-grid">
              <section class="panel-card panel-card--inner">
                <div class="panel-card__header"><h3>Thông tin cơ bản</h3></div>
                <div class="form-grid">
                  <label class="form-field"><span>Username</span><input :value="selectedUser.username" type="text" disabled /></label>
                  <label class="form-field"><span>Mã user</span><input :value="selectedUser.userCode || '--'" type="text" disabled /></label>
                  <label class="form-field"><span>Họ tên</span><input v-model="selectedUserProfileForm.fullName" type="text" /></label>
                  <label class="form-field"><span>Điện thoại</span><input v-model="selectedUserProfileForm.phone" type="text" placeholder="VD: 0912345678" /></label>
                  <label class="form-field"><span>Tên gợi nhớ</span><input v-model="selectedUserProfileForm.displayName" type="text" /></label>
                  <label class="form-field"><span>Tên nhân vật</span><input v-model="selectedUserProfileForm.characterName" type="text" /></label>
                  <label class="form-field"><span>Mã giới thiệu</span><input v-model="selectedUserProfileForm.referredByCode" type="text" /></label>
                  <label class="form-field"><span>Mã mời</span><input v-model="selectedUserProfileForm.inviteCode" type="text" /></label>
                </div>
                <div class="action-btns action-btns--left" style="margin-top:12px">
                  <button class="btn btn--primary" :disabled="savingSelectedUserProfile" @click="saveSelectedUserProfile">
                    {{ savingSelectedUserProfile ? 'Đang lưu...' : 'Lưu thông tin' }}
                  </button>
                </div>
              </section>

              <section class="panel-card panel-card--inner">
                <div class="panel-card__header"><h3>Tài khoản ngân hàng</h3></div>
                <div class="form-grid">
                  <label class="form-field"><span>Tên ngân hàng</span><input v-model="selectedUserBankForm.bankName" type="text" /></label>
                  <label class="form-field"><span>Số tài khoản</span><input v-model="selectedUserBankForm.bankAccount" type="text" /></label>
                  <label class="form-field form-field--wide"><span>Chủ tài khoản</span><input v-model="selectedUserBankForm.accountName" type="text" /></label>
                </div>
                <div class="action-btns action-btns--left" style="margin-top:12px">
                  <button class="btn btn--primary" :disabled="savingSelectedUserBank" @click="saveSelectedUserBank">
                    {{ savingSelectedUserBank ? 'Đang lưu...' : 'Lưu ngân hàng' }}
                  </button>
                </div>
              </section>

              <section class="panel-card panel-card--inner">
                <div class="panel-card__header"><h3>Bảo mật người chơi</h3></div>
                <div class="form-grid">
                  <label class="form-field"><span>Mật khẩu đăng nhập mới</span><input v-model="selectedUserSecurityForm.password" type="text" placeholder="Để trống nếu không đổi" /></label>
                  <label class="form-field"><span>Mật khẩu rút mới</span><input v-model="selectedUserSecurityForm.withdrawPassword" type="text" placeholder="Để trống nếu không đổi" /></label>
                  <label class="form-field"><span>Trạng thái</span><input :value="selectedUser.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'" type="text" disabled /></label>
                  <label class="form-field"><span>Mật khẩu rút</span><input :value="selectedUser.hasWithdrawPassword ? 'Đã thiết lập' : 'Chưa thiết lập'" type="text" disabled /></label>
                  <div class="form-field form-field--wide">
                    <span>Xem mật khẩu khách</span>
                    <div class="admin-password-grid">
                      <div class="admin-password-box">
                        <small>Mật khẩu đăng nhập</small>
                        <input :type="isSelectedUserPasswordVisible('login') ? 'text' : 'password'" :value="getSelectedUserPasswordValue('login')" disabled />
                        <button class="btn btn--sm" type="button" :disabled="selectedUserPasswordVault.loading" @click="revealSelectedUserPassword('login')">
                          {{ isSelectedUserPasswordVisible('login') ? 'Ẩn' : 'Hiện' }}
                        </button>
                      </div>
                      <div class="admin-password-box">
                        <small>Mật khẩu rút tiền</small>
                        <input :type="isSelectedUserPasswordVisible('withdraw') ? 'text' : 'password'" :value="getSelectedUserPasswordValue('withdraw')" disabled />
                        <button class="btn btn--sm" type="button" :disabled="selectedUserPasswordVault.loading" @click="revealSelectedUserPassword('withdraw')">
                          {{ isSelectedUserPasswordVisible('withdraw') ? 'Ẩn' : 'Hiện' }}
                        </button>
                      </div>
                    </div>
                    <small v-if="selectedUserPasswordVault.message" class="admin-password-note">{{ selectedUserPasswordVault.message }}</small>
                  </div>
                </div>
                <div class="action-btns action-btns--left" style="margin-top:12px">
                  <button class="btn btn--primary" :disabled="savingSelectedUserSecurity" @click="saveSelectedUserSecurity">
                    {{ savingSelectedUserSecurity ? 'Đang lưu...' : 'Đổi mật khẩu' }}
                  </button>
                </div>
              </section>
            </div>

            <section class="panel-card panel-card--inner admin-user-history-panel">
              <div class="panel-card__header panel-card__header--stack">
                <div>
                  <h3>Lịch sử khách hàng theo ngày</h3>
                  <p class="panel-card__subtext">Tra cứu nạp tiền, rút tiền, biến động ví và lịch sử chơi game theo khoảng ngày tự chọn.</p>
                </div>
                <span class="badge">{{ selectedUserHistory.total || selectedUserHistory.items.length }}</span>
              </div>
              <div class="admin-user-history-filters">
                <label class="form-field">
                  <span>Chế độ xem</span>
                  <select v-model="selectedUserHistoryFilters.mode">
                    <option value="all">Tất cả lịch sử</option>
                    <option value="deposit">Chỉ nạp tiền</option>
                    <option value="withdraw">Chỉ rút tiền</option>
                    <option value="wallet">Giao dịch ví</option>
                    <option value="bet">Lịch sử chơi game</option>
                  </select>
                </label>
                <label class="form-field">
                  <span>Từ ngày</span>
                  <input v-model="selectedUserHistoryFilters.from" type="date" />
                </label>
                <label class="form-field">
                  <span>Đến ngày</span>
                  <input v-model="selectedUserHistoryFilters.to" type="date" />
                </label>
                <label class="form-field">
                  <span>Số dòng</span>
                  <select v-model="selectedUserHistoryFilters.limit">
                    <option :value="100">100</option>
                    <option :value="200">200</option>
                    <option :value="500">500</option>
                  </select>
                </label>
                <div class="admin-user-history-actions">
                  <button class="btn btn--primary" type="button" :disabled="selectedUserHistory.loading" @click="loadSelectedUserHistory">
                    {{ selectedUserHistory.loading ? 'Đang tải...' : 'Xem lịch sử' }}
                  </button>
                  <button class="btn btn--sm" type="button" :disabled="selectedUserHistory.loading" @click="resetSelectedUserHistoryFilters">
                    Xóa lọc
                  </button>
                </div>
              </div>
              <div v-if="selectedUserHistory.error" class="panel-card__empty panel-card__empty--danger">{{ selectedUserHistory.error }}</div>
              <div v-else-if="selectedUserHistory.loading" class="panel-card__empty">Đang tải lịch sử khách hàng...</div>
              <div v-else-if="!selectedUserHistory.items.length" class="panel-card__empty">Không có dữ liệu trong khoảng thời gian đã chọn.</div>
              <div v-else class="table-scroll">
                <table class="data-table data-table--dense admin-user-history-table">
                  <thead>
                    <tr>
                      <th>THỜI GIAN</th>
                      <th>LOẠI</th>
                      <th>NỘI DUNG</th>
                      <th>SỐ TIỀN</th>
                      <th>TRẠNG THÁI</th>
                      <th>SỐ DƯ / KẾT QUẢ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in selectedUserHistory.items" :key="`${item.source}-${item._id}`">
                      <td>{{ formatDate(item.createdAt) }}</td>
                      <td><span class="badge" :class="getUserHistoryBadgeClass(item)">{{ formatUserHistoryType(item) }}</span></td>
                      <td>{{ describeUserHistoryItem(item) }}</td>
                      <td :class="getUserHistoryAmountClass(item)">{{ formatUserHistoryAmount(item) }}</td>
                      <td>{{ formatUserHistoryStatus(item) }}</td>
                      <td>{{ formatUserHistoryResult(item) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <div class="detail-edit-grid detail-edit-grid--activity">
              <section class="panel-card panel-card--inner">
                <div class="panel-card__header panel-card__header--stack">
                  <div>
                    <h3>Giao dịch gần nhất</h3>
                    <p class="panel-card__subtext">Hiển thị trực tiếp các biến động ví để admin theo dõi nhanh.</p>
                  </div>
                  <span class="badge">{{ selectedUser.recentTransactions?.length || 0 }}</span>
                </div>
                <div v-if="!selectedUser.recentTransactions?.length" class="panel-card__empty">Chưa có giao dịch.</div>
                <div v-else class="admin-activity-list">
                  <article v-for="tx in selectedUser.recentTransactions" :key="tx._id" class="admin-activity-item">
                    <div class="admin-activity-item__top">
                      <strong>{{ formatTransactionType(tx.type) }}</strong>
                      <span>{{ formatMoney(tx.amount) }}</span>
                    </div>
                    <div class="admin-activity-item__meta">
                      <span>{{ formatDate(tx.createdAt) }}</span>
                      <span>Số dư: {{ formatMoney(tx.balanceAfter) }}</span>
                    </div>
                  </article>
                </div>
              </section>

              <section class="panel-card panel-card--inner">
                <div class="panel-card__header panel-card__header--stack">
                  <div>
                    <h3>Lịch sử nạp tiền</h3>
                    <p class="panel-card__subtext">Các yêu cầu nạp và giao dịch nạp đã xử lý của khách hàng.</p>
                  </div>
                  <span class="badge">{{ selectedUser.recentDepositTransactions?.length || 0 }}</span>
                </div>
                <div v-if="!selectedUser.recentDepositTransactions?.length" class="panel-card__empty">Chưa có lịch sử nạp.</div>
                <div v-else class="admin-activity-list">
                  <article v-for="tx in selectedUser.recentDepositTransactions" :key="tx._id" class="admin-activity-item">
                    <div class="admin-activity-item__top">
                      <strong>{{ formatTransactionType(tx.type) }}</strong>
                      <span>{{ formatMoney(tx.amount) }}</span>
                    </div>
                    <div class="admin-activity-item__meta">
                      <span>{{ formatDate(tx.createdAt) }}</span>
                      <span>{{ formatRequestStatus(tx) }}</span>
                    </div>
                  </article>
                </div>
              </section>

              <section class="panel-card panel-card--inner">
                <div class="panel-card__header panel-card__header--stack">
                  <div>
                    <h3>Lịch sử rút tiền</h3>
                    <p class="panel-card__subtext">Các yêu cầu rút, trạng thái duyệt và số dư sau giao dịch.</p>
                  </div>
                  <span class="badge">{{ selectedUser.recentWithdrawTransactions?.length || 0 }}</span>
                </div>
                <div v-if="!selectedUser.recentWithdrawTransactions?.length" class="panel-card__empty">Chưa có lịch sử rút.</div>
                <div v-else class="admin-activity-list">
                  <article v-for="tx in selectedUser.recentWithdrawTransactions" :key="tx._id" class="admin-activity-item">
                    <div class="admin-activity-item__top">
                      <strong>{{ formatTransactionType(tx.type) }}</strong>
                      <span>{{ formatMoney(Math.abs(Number(tx.amount || 0))) }}</span>
                    </div>
                    <div class="admin-activity-item__meta">
                      <span>{{ formatDate(tx.createdAt) }}</span>
                      <span>{{ formatRequestStatus(tx) }}</span>
                    </div>
                  </article>
                </div>
              </section>

              <section class="panel-card panel-card--inner">
                <div class="panel-card__header panel-card__header--stack">
                  <div>
                    <h3>Cược gần nhất</h3>
                    <p class="panel-card__subtext">Theo dõi trực tiếp trạng thái thắng thua và số tiền từng lệnh.</p>
                  </div>
                  <span class="badge">{{ selectedUser.recentBets?.length || 0 }}</span>
                </div>
                <div v-if="!selectedUser.recentBets?.length" class="panel-card__empty">Chưa có lệnh cược.</div>
                <div v-else class="admin-activity-list">
                  <article v-for="bet in selectedUser.recentBets" :key="bet._id" class="admin-activity-item">
                    <div class="admin-activity-item__top">
                      <strong>{{ formatGateLabel(bet.gate) }} · {{ bet.roomId }}</strong>
                      <span>{{ formatMoney(bet.amount) }}</span>
                    </div>
                    <div class="admin-activity-item__meta">
                      <span>Phiên {{ bet.roundId }}</span>
                      <span>{{ formatBetStatus(bet.status, bet.payout) }}</span>
                    </div>
                  </article>
                </div>
              </section>
            </div>

            <section class="panel-card panel-card--inner" style="margin-top:18px">
              <div class="panel-card__header panel-card__header--stack">
                <div>
                  <h3>Lịch sử thay đổi thông tin</h3>
                  <p class="panel-card__subtext">Theo dõi các lần sửa hồ sơ, ngân hàng, mật khẩu, trạng thái và VIP của người chơi.</p>
                </div>
                <span class="badge">{{ selectedUserChangeLogs.length }}</span>
              </div>
              <div v-if="selectedUserChangeLogs.length === 0" class="panel-card__empty">Chưa có lịch sử thay đổi.</div>
              <div v-else class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>THỜI GIAN</th>
                      <th>LOẠI THAY ĐỔI</th>
                      <th>ADMIN</th>
                      <th>NỘI DUNG</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="log in selectedUserChangeLogs" :key="log._id">
                      <td>{{ formatDate(log.createdAt) }}</td>
                      <td><span class="badge badge--info">{{ formatUserChangeAction(log.action) }}</span></td>
                      <td>{{ log.adminSnapshot?.fullName || log.adminSnapshot?.username || 'Admin' }}</td>
                      <td>{{ describeUserChangeLog(log) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>

      <!-- Transactions -->
      <div v-if="activeTab === 'transactions'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Giao dịch ví</h3><span class="badge">{{ paginationSummary(transactionPaging.all) }}</span></div>
          <div v-if="transactions.length === 0" class="panel-card__empty">Chưa có giao dịch.</div>
          <div v-else class="table-scroll">
            <table class="data-table">
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
          <div class="admin-pagination">
            <span>{{ paginationSummary(transactionPaging.all) }}</span>
            <div class="admin-pagination__actions">
              <button class="btn btn--sm" :disabled="!hasPrevPage(transactionPaging.all) || transactionPaging.all.loading" @click="changeTransactionPage('all', -1)">Trước</button>
              <button class="btn btn--sm" :disabled="!hasNextPage(transactionPaging.all) || transactionPaging.all.loading" @click="changeTransactionPage('all', 1)">Sau</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Game History -->
      <div v-if="activeTab === 'game-history'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header"><h3>Lịch sử round Sicbo</h3><span class="badge">{{ paginationSummary(roundHistoryPaging) }}</span></div>
          <div v-if="roundHistory.length === 0" class="panel-card__empty">Chưa có lịch sử round.</div>
          <div v-else class="table-scroll">
            <table class="data-table">
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
          <div class="admin-pagination">
            <span>{{ paginationSummary(roundHistoryPaging) }}</span>
            <div class="admin-pagination__actions">
              <button class="btn btn--sm" :disabled="!hasPrevPage(roundHistoryPaging) || roundHistoryPaging.loading" @click="changeRoundHistoryPage(-1)">Trước</button>
              <button class="btn btn--sm" :disabled="!hasNextPage(roundHistoryPaging) || roundHistoryPaging.loading" @click="changeRoundHistoryPage(1)">Sau</button>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Lịch sử cược</h3><span class="badge">{{ paginationSummary(gameHistoryPaging) }}</span></div>
          <div v-if="gameHistory.length === 0" class="panel-card__empty">Chưa có lịch sử game.</div>
          <div v-else class="table-scroll">
            <table class="data-table">
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
          <div class="admin-pagination">
            <span>{{ paginationSummary(gameHistoryPaging) }}</span>
            <div class="admin-pagination__actions">
              <button class="btn btn--sm" :disabled="!hasPrevPage(gameHistoryPaging) || gameHistoryPaging.loading" @click="changeGameHistoryPage(-1)">Trước</button>
              <button class="btn btn--sm" :disabled="!hasNextPage(gameHistoryPaging) || gameHistoryPaging.loading" @click="changeGameHistoryPage(1)">Sau</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Revenue -->
      <div v-if="activeTab === 'revenue'" class="admin-panel">
        <div class="stats-row">
          <div class="stat-card stat-card--blue"><span class="stat-card__label">Gross Bet</span><strong class="stat-card__value">{{ formatMoney(revenue.totalBetAmount) }}</strong></div>
          <div class="stat-card stat-card--green"><span class="stat-card__label">Total Payout</span><strong class="stat-card__value">{{ formatMoney(revenue.totalPayout) }}</strong></div>
          <div class="stat-card stat-card--purple"><span class="stat-card__label">Total Rounds</span><strong class="stat-card__value">{{ revenue.totalRounds }}</strong></div>
        </div>
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Biểu đồ đo lường tổng quan</h3>
              <p class="panel-card__subtext">Khối doanh thu chính được chuẩn hóa theo cùng một thang đo để admin đọc nhanh hơn.</p>
            </div>
          </div>
          <div class="analytics-bars">
            <div v-for="metric in revenueOverviewMetrics" :key="`revenue-${metric.key}`" class="analytics-bar-row">
              <div class="analytics-bar-row__meta">
                <strong>{{ metric.label }}</strong>
                <span>{{ metric.display }}</span>
              </div>
              <div class="analytics-bar-track">
                <div class="analytics-bar-fill" :class="`analytics-bar-fill--${metric.tone}`" :style="{ width: `${metric.percent}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Invite Codes -->
      <div v-if="activeTab === 'invite-codes'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Mã mời</h3>
              <p class="panel-card__subtext">Quản lý đồng bộ mã giới thiệu với giao diện đăng ký và chỉnh ngay theo từng người chơi.</p>
            </div>
            <input v-model="inviteSearchKeyword" type="text" class="topbar__search" placeholder="Tìm user / mã mời..." />
          </div>
          <div v-if="filteredInviteCodes.length === 0" class="panel-card__empty">Chưa có mã mời.</div>
          <div v-else class="table-scroll">
            <table class="data-table">
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
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Giới hạn cược và chip</h3>
              <p class="panel-card__subtext">Đặt `0` ở cược tối đa để mở không giới hạn mỗi lệnh.</p>
            </div>
            <span class="badge badge--info">{{ oddsConfig.maxBet > 0 ? formatMoney(oddsConfig.maxBet) : 'Không giới hạn' }}</span>
          </div>
          <div class="form-grid">
            <label class="form-field"><span>Cược tối thiểu</span><input v-model="oddsConfig.minBet" type="number" min="1" step="1" /></label>
            <label class="form-field"><span>Cược tối đa</span><input v-model="oddsConfig.maxBet" type="number" min="0" step="1" placeholder="0 = Không giới hạn" /></label>
            <label class="form-field"><span>Khóa cược trước</span><input v-model="oddsConfig.betLockSeconds" type="number" min="0" step="1" /></label>
            <label class="form-field"><span>Chip nhanh</span><input v-model="chipOptionsText" type="text" placeholder="10, 50, 100, 500..." /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:10px">
            <button class="btn btn--primary btn--sm" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu giới hạn' }}</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Tỉ lệ nhanh (Lớn/Nhỏ/Chẵn/Lẻ)</h3></div>
          <div class="odds-quick">
            <label class="form-field"><span>Lớn</span><input v-model="oddsConfig.odds.tai" type="number" step="0.01" /></label>
            <label class="form-field"><span>Nhỏ</span><input v-model="oddsConfig.odds.xiu" type="number" step="0.01" /></label>
            <label class="form-field"><span>Chẵn</span><input v-model="oddsConfig.odds.even" type="number" step="0.01" /></label>
            <label class="form-field"><span>Lẻ</span><input v-model="oddsConfig.odds.odd" type="number" step="0.01" /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:10px">
            <button class="btn btn--primary btn--sm" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu tỉ lệ' }}</button>
            <button class="btn btn--sm" :disabled="savingOdds" @click="resetOddsSettings">Reset</button>
          </div>
        </div>

        <!-- Bảng cược -->
        <div class="panel-card">
          <div class="panel-card__header"><h3>Lệnh cược gần đây</h3></div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>ID</th><th>Username</th><th>Cửa</th><th>Số tiền</th><th>Thời gian</th></tr></thead>
              <tbody>
                <tr v-if="recentGameHistory.filter(b=>b.roomId==='sicbo-3p').length===0"><td colspan="5" class="panel-card__empty">Chưa có lệnh cược</td></tr>
                <tr v-for="bet in recentGameHistory.filter(b=>b.roomId==='sicbo-3p').slice(0,15)" :key="bet._id">
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
      </div>

      <!-- Cài đặt hệ thống -->
      <div v-if="activeTab === 'payout-settings'" class="admin-panel">
        <div class="settings-shell">
          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Cài đặt chung</h3>
                <p class="panel-card__subtext">Gom toàn bộ cấu hình website, tỷ lệ trò chơi và bảng VIP vào một màn hình gọn, dễ kiểm soát.</p>
              </div>
            </div>
          </div>

          <div class="panel-card admin-sound-settings">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Âm thanh</h3>
                <p class="panel-card__subtext">Cài đặt âm báo toàn hệ thống cho CSKH, nạp/rút, cảnh báo và lời chào admin.</p>
              </div>
            </div>
            <div class="admin-sound-grid">
              <label v-for="field in systemSoundFields" :key="field.key" class="form-field admin-sound-field">
                <span>{{ field.label }}</span>
                <div class="admin-sound-control">
                  <select v-model="siteConfig[field.key]">
                    <option v-for="option in systemSoundOptions" :key="`${field.key}-${option.value}`" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <button class="btn btn--sm" type="button" @click="previewConfiguredSystemSound(field.key)">Nghe thử</button>
                </div>
              </label>
              <label class="form-field">
                <span>Âm lượng lời chào admin</span>
                <input v-model="siteConfig.adminWelcomeVoiceVolume" type="range" min="20" max="200" />
              </label>
              <label class="form-field admin-sound-toggle">
                <span>Lời chào khi đăng nhập admin</span>
                <select v-model="siteConfig.adminWelcomeVoiceEnabled">
                  <option :value="true">Bật lời chào</option>
                  <option :value="false">Tắt lời chào</option>
                </select>
              </label>
              <label class="form-field form-field--wide">
                <span>Nội dung AI Voice</span>
                <textarea v-model="siteConfig.adminWelcomeVoiceText" rows="2" placeholder="Xin chào ông chủ - Chúng ta chuẩn bị ăn to rồi đấy nhé"></textarea>
              </label>
            </div>
            <div class="action-btns action-btns--left" style="margin-top:16px">
              <button class="btn btn--sm" type="button" @click="previewAdminWelcomeVoice">Nghe thử lời chào</button>
              <button class="btn btn--primary" :disabled="savingSiteConfig" @click="saveSiteConfig">{{ savingSiteConfig ? 'Đang lưu...' : 'Lưu cài đặt âm thanh' }}</button>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Tỷ lệ trò chơi</h3>
                <p class="panel-card__subtext">Các mức trả thưởng và tỷ lệ lỗi của Keno, Xúc sắc 3P, Xúc sắc 5P.</p>
              </div>
            </div>
            <div class="form-grid">
              <label class="form-field"><span>Đôi bên</span><input v-model="siteConfig.oddsDoi" type="text" /></label>
              <label class="form-field"><span>Xúc sắc 3P</span><input v-model="siteConfig.oddsXs3p" type="text" /></label>
              <label class="form-field"><span>Hai số trùng Xúc sắc 3P</span><input v-model="siteConfig.oddsHaiTrung3p" type="text" /></label>
              <label class="form-field"><span>Ba số trùng Xúc sắc 3P</span><input v-model="siteConfig.oddsBaTrung3p" type="text" /></label>
              <label class="form-field"><span style="color:#e53935">Lỗi CLTX Xúc sắc 3P</span><input v-model="siteConfig.oddsLoiCltx3p" type="text" /></label>
              <label class="form-field"><span>Xúc sắc 5P</span><input v-model="siteConfig.oddsXs5p" type="text" /></label>
              <label class="form-field"><span>Hai số trùng Xúc sắc 5P</span><input v-model="siteConfig.oddsHaiTrung5p" type="text" /></label>
              <label class="form-field"><span>Ba số trùng Xúc sắc 5P</span><input v-model="siteConfig.oddsBaTrung5p" type="text" /></label>
              <label class="form-field"><span style="color:#e53935">Lỗi CLTX Xúc sắc 5P</span><input v-model="siteConfig.oddsLoiCltx5p" type="text" /></label>
              <label class="form-field"><span style="color:#4caf50">Lỗi Keno Xúc sắc 5P</span><input v-model="siteConfig.oddsLoiKeno5p" type="text" /></label>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Nhận diện website</h3>
                <p class="panel-card__subtext">Logo, tên thương hiệu, mô tả SEO và thông báo đầu trang.</p>
              </div>
            </div>
            <div class="form-grid">
              <label class="form-field"><span>Tên thương hiệu</span><input v-model="siteConfig.siteBrandName" type="text" placeholder="THE VENETIAN" /></label>
              <label class="form-field"><span>Chú thích admin</span><input v-model="siteConfig.siteAdminCaption" type="text" placeholder="admin.casinovenetianmacau.com" /></label>
              <label class="form-field form-field--wide"><span>Đường dẫn logo</span><input v-model="siteConfig.siteLogoUrl" type="text" placeholder="/img/the-venetian-wordmark.svg hoặc https://..." /></label>
              <label class="form-field"><span>Mã giới thiệu</span><input v-model="siteConfig.referralCode" type="text" placeholder="VD: HT5555" /></label>
              <label class="form-field"><span>SEO - Tiêu đề</span><input v-model="siteConfig.seoTitle" type="text" /></label>
              <label class="form-field"><span>SEO - Mô tả</span><input v-model="siteConfig.seoDescription" type="text" /></label>
              <label class="form-field form-field--wide"><span>Thông báo trang chủ (ngăn cách bằng dấu ';')</span><input v-model="siteConfig.homeBanner" type="text" placeholder="CHÀO MỪNG BẠN ĐẾN THE VENETIAN !" /></label>
            </div>
            <div class="brand-preview-card">
              <div class="brand-preview-card__media">
                <img :src="resolvedSiteLogoSrc" :alt="siteBrandDisplayName" class="brand-preview-card__logo" />
              </div>
              <div class="brand-preview-card__meta">
                <strong>{{ siteBrandDisplayName }}</strong>
                <span>{{ siteAdminCaptionDisplay }}</span>
              </div>
            </div>
            <div class="action-btns action-btns--left" style="margin-top:20px">
              <button class="btn btn--primary" :disabled="savingSiteConfig" @click="saveSiteConfig">{{ savingSiteConfig ? 'Đang lưu...' : 'Lưu cài đặt chung' }}</button>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Cài đặt giao diện game</h3>
                <p class="panel-card__subtext">Chọn game nào đang hoạt động và game nào đang bảo trì mà không làm thay đổi các chức năng còn lại.</p>
              </div>
            </div>
            <div class="form-grid">
              <label class="form-field">
                <span>Trạng thái game KENO</span>
                <select v-model="siteConfig.kenoMaintenanceEnabled">
                  <option :value="false">Đang hoạt động</option>
                  <option :value="true">Đang bảo trì</option>
                </select>
              </label>
              <label class="form-field form-field--wide">
                <span>Thông báo bảo trì KENO</span>
                <input v-model="siteConfig.kenoMaintenanceMessage" type="text" placeholder="Game KENO đang bảo trì. Vui lòng quay lại sau." />
              </label>
              <label class="form-field">
                <span>Trạng thái game Xúc sắc</span>
                <select v-model="siteConfig.sicboMaintenanceEnabled">
                  <option :value="false">Đang hoạt động</option>
                  <option :value="true">Đang bảo trì</option>
                </select>
              </label>
              <label class="form-field form-field--wide">
                <span>Thông báo bảo trì Xúc sắc</span>
                <input v-model="siteConfig.sicboMaintenanceMessage" type="text" placeholder="Game Xúc sắc đang bảo trì. Vui lòng quay lại sau." />
              </label>
            </div>
            <div class="action-btns action-btns--left" style="margin-top:20px">
              <button class="btn btn--primary" :disabled="savingSiteConfig" @click="saveSiteConfig">{{ savingSiteConfig ? 'Đang lưu...' : 'Lưu trạng thái game' }}</button>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-card__header panel-card__header--stack">
              <div>
                <h3>Bảng đặc quyền VIP</h3>
                <p class="panel-card__subtext">Chỉnh tiêu đề, mô tả và các mốc VIP ngay trong mục cài đặt chung, không tách tab riêng.</p>
              </div>
            </div>

            <div class="form-grid">
              <label class="form-field">
                <span>Tiêu đề</span>
                <input v-model="siteConfig.vipPrivilegeTitle" type="text" />
              </label>
              <label class="form-field">
                <span>Mô tả</span>
                <input v-model="siteConfig.vipPrivilegeSubtitle" type="text" />
              </label>
            </div>

            <div class="vip-admin-table-wrap">
              <table class="data-table data-table--dense vip-admin-table">
                <thead>
                  <tr>
                    <th>TÍCH LŨY</th>
                    <th>CẤP</th>
                    <th>THƯỞNG</th>
                    <th>HẠN MỨC</th>
                    <th>SẮP XẾP</th>
                    <th>XÓA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in siteConfig.vipPrivilegeRows" :key="`vip-row-${index}`">
                    <td><input v-model="row.tich_luy" class="inline-input" type="text" /></td>
                    <td><input v-model="row.cap" class="inline-input" type="text" /></td>
                    <td><input v-model="row.thuong" class="inline-input" type="text" /></td>
                    <td><input v-model="row.han_muc" class="inline-input" type="text" /></td>
                    <td>
                      <div class="action-btns action-btns--tight">
                        <button class="btn btn--sm" type="button" :disabled="index === 0" @click="moveVipPrivilegeRow(index, -1)">↑</button>
                        <button class="btn btn--sm" type="button" :disabled="index === siteConfig.vipPrivilegeRows.length - 1" @click="moveVipPrivilegeRow(index, 1)">↓</button>
                      </div>
                    </td>
                    <td>
                      <button class="btn btn--danger btn--sm" type="button" :disabled="siteConfig.vipPrivilegeRows.length <= 1" @click="removeVipPrivilegeRow(index)">Xóa</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="action-btns action-btns--left" style="margin-top:14px">
              <button class="btn btn--sm" type="button" @click="addVipPrivilegeRow">Thêm dòng VIP</button>
              <button class="btn btn--sm" type="button" @click="resetVipPrivilegeRows">Khôi phục mặc định</button>
              <button class="btn btn--primary" :disabled="savingVipPrivilege" @click="saveVipPrivilegeSettings">
                {{ savingVipPrivilege ? 'Đang lưu...' : 'Lưu bảng VIP' }}
              </button>
            </div>

            <div class="vip-privilege-preview-card" style="margin-top:18px">
              <h4>{{ siteConfig.vipPrivilegeTitle }}</h4>
              <p>{{ siteConfig.vipPrivilegeSubtitle }}</p>
              <div class="vip-privilege-preview-card__table-wrap">
                <table class="vip-privilege-preview-card__table">
                  <thead>
                    <tr>
                      <th>TÍCH LŨY</th>
                      <th>CẤP VIP</th>
                      <th>THƯỞNG</th>
                      <th>HẠN MỨC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in toVipPrivilegeDisplayRows(siteConfig.vipPrivilegeRows)" :key="`vip-preview-${index}-${row.cap}`">
                      <td>{{ row.tich_luy }}</td>
                      <td>{{ row.cap }}</td>
                      <td>{{ row.thuong }}</td>
                      <td>{{ row.han_muc }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="!toVipPrivilegeDisplayRows(siteConfig.vipPrivilegeRows).length" class="panel-card__empty">Chưa có dòng VIP đang bật.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Admins -->
      <div v-if="activeTab === 'admins'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Tạo admin mới</h3>
              <p class="panel-card__subtext">Khởi tạo nhanh tài khoản vận hành mới với thông tin cơ bản đầy đủ.</p>
            </div>
          </div>
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
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Quản trị viên</h3>
              <p class="panel-card__subtext">Theo dõi trạng thái tài khoản vận hành, khóa mở nhanh và đổi mật khẩu trực tiếp.</p>
            </div>
            <span class="badge">{{ adminUsers.length }}</span>
          </div>
          <div v-if="!adminUsers.length" class="panel-card__empty">Chưa có tài khoản quản trị.</div>
          <div v-else class="table-scroll">
            <table class="data-table">
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
      </div>

      <!-- Chat -->
      <div v-if="activeTab === 'chat'" class="admin-panel admin-panel--chat-screen">
          <div class="panel-card panel-card--chat">
          <div class="panel-card__header panel-card__header--chat">
            <h3>CSKH TRỰC TUYẾN - CHAT</h3>
            <div class="chat-kpi">
              <button class="chat-kpi__chip" :class="{ 'chat-kpi__chip--active': chatInboxFilter === 'today' }" type="button" @click="chatInboxFilter = chatInboxFilter === 'today' ? 'all' : 'today'">
                Tin nhắn hôm nay: {{ chatStats.todayMessages }}
              </button>
              <button class="chat-kpi__chip" :class="{ 'chat-kpi__chip--active': chatInboxFilter === 'pending', 'chat-kpi__chip--warning': chatStats.pendingRooms }" type="button" @click="chatInboxFilter = chatInboxFilter === 'pending' ? 'all' : 'pending'">
                Chưa trả lời: {{ chatStats.pendingRooms }}
              </button>
              <button class="admin-chat-toolbar__gear" type="button" @click="showChatSettingsModal = true" aria-label="Mở cài đặt auto chat">
                ⚙
              </button>
            </div>
          </div>
          <div class="admin-chat-layout">
            <div class="admin-chat-sidebar">
              <div class="admin-chat-filters">
                <button
                  v-for="filter in chatTagFilters"
                  :key="filter.key"
                  class="admin-chat-filter"
                  :class="[
                    `admin-chat-filter--${filter.color}`,
                    { 'admin-chat-filter--active': chatRoomFilter === filter.key }
                  ]"
                  @click="chatRoomFilter = filter.key"
                >
                  <span>{{ filter.label }}</span>
                  <strong>{{ filter.count }}</strong>
                </button>
              </div>
              <div class="admin-chat-rooms">
                <button
                  v-for="room in filteredChatRooms"
                  :key="room.roomId"
                  class="admin-chat-room"
                  :class="{
                    'admin-chat-room--active': selectedRoomId === room.roomId,
                    'admin-chat-room--unread': unreadByRoom[room.roomId] > 0
                  }"
                  @click="selectChatRoom(room.roomId)"
                >
                  <span v-if="unreadByRoom[room.roomId]" class="admin-chat-room__unread-dot" aria-hidden="true"></span>
                  <div class="admin-chat-room__top">
                    <strong>{{ room.title }}</strong>
                    <span v-if="unreadByRoom[room.roomId]" class="badge badge--warning">{{ unreadByRoom[room.roomId] }}</span>
                    <span v-else-if="room.needsReply" class="badge badge--warning">Chờ trả lời</span>
                  </div>
                  <div class="admin-chat-room__meta">
                    <span class="presence-pill" :class="room.user?.isOnline ? 'presence-pill--online' : 'presence-pill--offline'">
                      {{ room.user?.isOnline ? 'Online' : 'Offline' }}
                    </span>
                    <span v-if="room.user?.chatTag" class="chat-tag-pill" :class="chatTagClass(room.user.chatTag)">
                      {{ formatChatTag(room.user.chatTag) }}
                    </span>
                  </div>
                  <small class="admin-chat-room__lastseen">
                    {{ room.user?.isOnline ? 'Đang hoạt động' : `Lần cuối ${formatRelativeAccess(room.user?.lastSeenAt || room.user?.lastLoginAt)}` }}
                  </small>
                  <span class="admin-chat-room__preview">{{ room.lastMessage }}</span>
                </button>
                <div v-if="filteredChatRooms.length === 0" class="panel-card__empty admin-chat-empty">
                  Không có khách thuộc nhóm này.
                </div>
              </div>
            </div>
            <div class="admin-chat-main">
              <div v-if="selectedChatUser" class="admin-chat-toolbar">
                <div class="admin-chat-toolbar__identity">
                  <div>
                    <strong>{{ selectedChatUser.displayName || selectedChatUser.characterName || selectedChatUser.fullName || selectedChatUser.username }}</strong>
                    <span class="admin-chat-customerbar__username">@{{ selectedChatUser.username }}</span>
                    <span class="admin-chat-toolbar__presence" :class="selectedChatUser.isOnline ? 'admin-chat-toolbar__presence--online' : 'admin-chat-toolbar__presence--offline'">
                      {{ selectedChatUser.isOnline ? 'Online' : `Offline · ${formatRelativeAccess(selectedChatUser.lastSeenAt || selectedChatUser.lastLoginAt)}` }}
                    </span>
                  </div>
                  <span v-if="selectedChatUser.chatTag" class="chat-tag-pill" :class="chatTagClass(selectedChatUser.chatTag)">
                    {{ formatChatTag(selectedChatUser.chatTag) }}
                  </span>
                </div>
                <div class="admin-chat-toolbar__actions">
                  <button class="btn btn--sm" type="button" @click="showChatCustomerPanel = !showChatCustomerPanel">
                    {{ showChatCustomerPanel ? 'Ẩn thông tin khách' : 'Xem thông tin khách' }}
                  </button>
                </div>
              </div>
              <div v-else class="panel-card__empty admin-chat-empty admin-chat-empty--top">
                Chọn khách hàng để xem thông tin và hội thoại.
              </div>
              <div v-if="selectedChatUser && showChatCustomerPanel" class="admin-chat-customerbar">
                <div class="admin-chat-usercard">
                  <div><span>Gợi nhớ</span><strong>{{ selectedChatUser.displayName || '--' }}</strong></div>
                  <div><span>Nhân vật</span><strong>{{ selectedChatUser.characterName || '--' }}</strong></div>
                  <div><span>Username</span><strong>@{{ selectedChatUser.username }}</strong></div>
                  <div><span>ID</span><strong>{{ selectedChatUser.userCode || '--' }}</strong></div>
                  <div><span>IP</span><strong>{{ selectedChatUser.lastLoginIp || '--' }}</strong></div>
                  <div><span>Số dư</span><strong>{{ formatMoney(selectedChatUser.balance) }}</strong></div>
                </div>
                <div class="admin-chat-settings admin-chat-settings--customer">
                  <div class="admin-chat-settings__block">
                  <h4>Thông tin khách nhắn tin</h4>
                  <label class="form-field">
                    <span>Tên gợi nhớ</span>
                    <input v-model.trim="chatProfileForm.displayName" type="text" maxlength="60" placeholder="Ví dụ: Khách VIP 01" :disabled="!selectedChatUser" />
                  </label>
                  <label class="form-field">
                    <span>Tên nhân vật</span>
                    <input v-model.trim="chatProfileForm.characterName" type="text" maxlength="60" placeholder="Ví dụ: Rồng Vàng" :disabled="!selectedChatUser" />
                  </label>
                  <div class="admin-chat-tag-picker">
                    <button
                      v-for="option in chatTagOptions"
                      :key="option.key"
                      type="button"
                      class="admin-chat-tag-btn"
                      :class="[
                        `admin-chat-tag-btn--${option.color}`,
                        { 'admin-chat-tag-btn--active': chatProfileForm.chatTag === option.key }
                      ]"
                      :disabled="!selectedChatUser"
                      @click="chatProfileForm.chatTag = option.key"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                  <button class="btn btn--primary btn--sm" :disabled="savingChatProfile || !selectedChatUser" @click="saveSelectedChatProfile">
                    {{ savingChatProfile ? 'Đang lưu...' : 'Lưu thông tin khách' }}
                  </button>
                </div>
                </div>
              </div>
              <div class="admin-chat-messages" ref="adminChatRef">
                <div v-if="chatMessages.length === 0" class="panel-card__empty admin-chat-empty">Chọn phòng để xem tin nhắn.</div>
                <div
                  v-for="msg in chatMessages"
                  :key="msg._id"
                  class="admin-chat-msg"
                  :class="msg.senderRole === 'user' ? 'admin-chat-msg--user' : 'admin-chat-msg--support'"
                >
                  <div class="admin-chat-msg__bubble">
                    <div v-if="msg.senderRole === 'admin'" class="admin-chat-msg__sender admin-chat-msg__sender--status-only">
                      <span>{{ adminChatDeliveryLabel(msg) }}</span>
                    </div>
                    <div v-if="editingAdminMessageId === String(msg._id)" class="admin-chat-msg__edit">
                      <textarea v-model="editingAdminMessageText" rows="3"></textarea>
                      <div class="admin-chat-msg__edit-actions">
                        <button class="btn btn--primary btn--sm" :disabled="savingAdminMessageEdit" @click="saveEditAdminChatMessage(msg)">Lưu</button>
                        <button class="btn btn--sm" :disabled="savingAdminMessageEdit" @click="cancelEditAdminChatMessage">Hủy</button>
                      </div>
                    </div>
                    <template v-else-if="msg.deletedAt || msg.isDeleted">
                      <p class="admin-chat-msg__text admin-chat-msg__text--deleted">Tin nhắn đã được thu hồi ở cả hai phía</p>
                    </template>
                    <template v-else-if="msg.messageType === 'image' && msg.imageUrl">
                      <button class="admin-chat-image-btn" type="button" @click="openChatImagePreview(resolveImageSrc(msg.imageUrl))">
                        <img class="admin-chat-image" :src="resolveImageSrc(msg.imageUrl)" alt="Ảnh" />
                      </button>
                      <div class="admin-chat-image-actions">
                        <button class="admin-chat-image-link" type="button" @click="copyChatImage(resolveImageSrc(msg.imageUrl))">Sao chép ảnh</button>
                        <a class="admin-chat-image-link" :href="resolveImageSrc(msg.imageUrl)" target="_blank" rel="noopener" download>Tải ảnh</a>
                      </div>
                      <p v-if="msg.content" class="admin-chat-msg__text admin-chat-msg__text--caption">{{ msg.content }}</p>
                    </template>
                    <template v-else-if="msg.messageType === 'file' && msg.fileUrl">
                      <div class="admin-chat-file-card">
                        <strong class="admin-chat-file-name">{{ getChatFileName(msg) }}</strong>
                        <span v-if="Number(msg.fileSize || 0) > 0" class="admin-chat-file-size">{{ formatFileSize(msg.fileSize) }}</span>
                        <div class="admin-chat-file-actions">
                          <a class="admin-chat-image-link" :href="resolveFileSrc(msg.fileUrl)" target="_blank" rel="noopener">Mở tệp</a>
                          <a class="admin-chat-image-link" :href="resolveFileSrc(msg.fileUrl)" :download="getChatFileName(msg)" target="_blank" rel="noopener">Tải tệp</a>
                        </div>
                      </div>
                      <p v-if="msg.content" class="admin-chat-msg__text admin-chat-msg__text--caption">{{ msg.content }}</p>
                    </template>
                    <template v-else>
                      <p class="admin-chat-msg__text">{{ msg.content }}</p>
                      <div v-if="extractChatQrData(msg.content)" class="chat-qr-card">
                        <img class="chat-qr-card__image" :src="buildChatQrUrl(extractChatQrData(msg.content))" alt="Mã QR chuyển khoản" />
                        <div class="chat-qr-card__meta">
                          <strong>{{ extractChatQrData(msg.content).bankLabel }}</strong>
                          <span>STK: {{ extractChatQrData(msg.content).accountNumber }}</span>
                          <small v-if="extractChatQrData(msg.content).accountName">{{ extractChatQrData(msg.content).accountName }}</small>
                        </div>
                      </div>
                    </template>
                    <small>{{ formatDate(msg.createdAt) }}<span v-if="msg.editedAt && !msg.deletedAt && !msg.isDeleted"> · đã chỉnh sửa</span></small>
                    <div v-if="canAdminManageChatMessage(msg)" class="admin-chat-msg__tools">
                      <button class="admin-chat-msg__more" type="button" aria-label="Mở thao tác tin nhắn">⋯</button>
                      <div class="admin-chat-msg__menu">
                        <button type="button" @click="startEditAdminChatMessage(msg)">Sửa</button>
                        <button type="button" :disabled="deletingAdminMessageId === String(msg._id)" @click="deleteAdminChatMessage(msg)">Xóa 2 phía</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="adminCustomerTypingActive" class="admin-chat-typing-indicator">
                  <span>Khách đang soạn tin nhắn</span>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              </div>
              <button v-if="adminHasNewMessageBelow" class="admin-chat-jump-new" type="button" @click="jumpAdminChatToLatest">
                <span>↓</span>
                Tin nhắn mới
              </button>
              <div class="admin-chat-input">
                <input ref="adminChatCameraRef" class="admin-chat-file" type="file" accept="image/*" capture="environment" @change="onAdminPickImage" />
                <input ref="adminChatGalleryRef" class="admin-chat-file" type="file" accept="image/*" @change="onAdminPickImage" />
                <input ref="adminChatFileRef" class="admin-chat-file" type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" @change="onAdminPickImage" />
                <div v-if="adminPendingImagePreview" class="admin-chat-input__preview">
                  <img :src="adminPendingImagePreview" alt="Ảnh chờ gửi" class="admin-chat-input__preview-image" />
                  <button class="admin-chat-input__preview-remove" type="button" @click="clearAdminPendingImage">×</button>
                </div>
                <div class="admin-chat-quickbar">
                  <button
                    v-for="reply in quickReplyButtons"
                    :key="reply.key"
                    type="button"
                    class="admin-chat-chip"
                    :disabled="!selectedRoomId"
                    @click="sendQuickReply(reply)"
                  >
                    {{ reply.label }}
                  </button>
                </div>
                <div class="admin-chat-input__helper">
                  <span>{{ selectedChatUser ? `Đang trả lời @${selectedChatUser.username}` : 'Chọn khách hàng để bắt đầu hỗ trợ' }}</span>
                </div>
                <div class="admin-chat-input__composer">
                  <textarea
                    v-model="adminChatInput"
                    rows="2"
                    placeholder="Trả lời khách hàng..."
                    @input="handleAdminChatTyping"
                    @keydown="handleAdminChatKeydown"
                  ></textarea>
                  <div class="admin-chat-input__actions">
                    <div class="admin-chat-input__attach-wrap">
                      <button class="admin-chat-input__icon" type="button" :disabled="sendingAdminChat || sendingAdminImage || !selectedRoomId" @click="toggleAdminAttachMenu" aria-label="Gửi ảnh hoặc tệp">📎</button>
                      <div v-if="showAdminAttachMenu" class="admin-chat-input__attach-menu">
                        <button class="admin-chat-input__attach-menu-item" type="button" :disabled="sendingAdminChat || sendingAdminImage || !selectedRoomId" @click="handleAdminAttachAction('camera')">Chụp ảnh</button>
                        <button class="admin-chat-input__attach-menu-item" type="button" :disabled="sendingAdminChat || sendingAdminImage || !selectedRoomId" @click="handleAdminAttachAction('gallery')">Chọn từ thư viện</button>
                        <button class="admin-chat-input__attach-menu-item" type="button" :disabled="sendingAdminChat || sendingAdminImage || !selectedRoomId" @click="handleAdminAttachAction('file')">Gửi tệp hình ảnh</button>
                      </div>
                    </div>
                    <button class="admin-chat-input__icon admin-chat-input__icon--send" type="button" :disabled="sendingAdminChat || sendingAdminImage || (!selectedRoomId || (!adminChatInput.trim() && !adminPendingImageFile))" @click="sendAdminChat">➤</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showChatSettingsModal" class="admin-chat-settings-modal" @click.self="showChatSettingsModal = false">
        <div class="admin-chat-settings-modal__dialog">
          <div class="admin-chat-settings-modal__head">
            <div>
              <strong>Cài đặt Chat CSKH</strong>
              <span>Quản lý theo từng nhóm chức năng riêng để giao diện gọn hơn, dễ đọc hơn.</span>
            </div>
            <button class="admin-chat-settings-modal__close" type="button" @click="showChatSettingsModal = false">×</button>
          </div>
          <div class="admin-chat-settings__nav">
            <button
              v-for="section in chatSettingsSections"
              :key="section.key"
              type="button"
              class="admin-chat-settings__nav-btn"
              :class="{ 'admin-chat-settings__nav-btn--active': activeChatSettingsSection === section.key }"
              @click="activeChatSettingsSection = section.key"
            >
              {{ section.label }}
            </button>
          </div>
          <div class="admin-chat-settings__block">
            <div v-if="activeChatSettingsSection === 'auto'" class="admin-chat-settings__section">
              <div class="admin-chat-settings__section-head">
                <strong>Tin nhắn tự động</strong>
                <span>Lời chào, phản hồi đầu tiên và chế độ vắng mặt có thể gắn kèm ảnh hoặc sticker.</span>
              </div>
              <div class="admin-chat-settings__message-card">
                <label class="form-field">
                  <span>Lời chào khi khách mở phòng chat</span>
                  <textarea v-model.trim="chatSettingsForm.supportWelcomeMessage" rows="3" placeholder="Để trống nếu không muốn gửi tự động"></textarea>
                </label>
                <div class="admin-chat-settings__attach-grid">
                  <label class="form-field">
                    <span>Kiểu đính kèm</span>
                    <select v-model="chatSettingsForm.supportWelcomeAttachmentType">
                      <option v-for="option in supportAttachmentOptions" :key="`welcome-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <label v-if="chatSettingsForm.supportWelcomeAttachmentType === 'image'" class="form-field">
                    <span>Đường dẫn ảnh</span>
                    <input v-model.trim="chatSettingsForm.supportWelcomeAttachmentUrl" type="text" placeholder="/uploads/chat/ten-anh.png" />
                  </label>
                  <label v-else-if="chatSettingsForm.supportWelcomeAttachmentType === 'sticker'" class="form-field">
                    <span>Sticker</span>
                    <select v-model="chatSettingsForm.supportWelcomeAttachmentUrl">
                      <option value="">Chọn sticker</option>
                      <option v-for="option in supportStickerOptions" :key="`welcome-sticker-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <div v-else-if="chatSettingsForm.supportWelcomeAttachmentType === 'vip'" class="admin-chat-vip-card">
                    <small>Lời chào mở phòng chat sẽ tự hiển thị bảng VIP động theo cấu hình hiện tại.</small>
                  </div>
                </div>
              </div>
              <div class="admin-chat-settings__message-card">
                <label class="form-field">
                  <span>Phản hồi tự động khi khách nhắn tin đầu tiên</span>
                  <textarea v-model.trim="chatSettingsForm.supportAutoReplyMessage" rows="3" placeholder="Để trống nếu không muốn trả lời tự động"></textarea>
                </label>
                <div class="admin-chat-settings__attach-grid">
                  <label class="form-field">
                    <span>Kiểu đính kèm</span>
                    <select v-model="chatSettingsForm.supportAutoReplyAttachmentType">
                      <option v-for="option in supportAttachmentOptions.filter((item) => item.value !== 'vip')" :key="`auto-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <label v-if="chatSettingsForm.supportAutoReplyAttachmentType === 'image'" class="form-field">
                    <span>Đường dẫn ảnh</span>
                    <input v-model.trim="chatSettingsForm.supportAutoReplyAttachmentUrl" type="text" placeholder="/uploads/chat/ten-anh.png" />
                  </label>
                  <label v-else-if="chatSettingsForm.supportAutoReplyAttachmentType === 'sticker'" class="form-field">
                    <span>Sticker</span>
                    <select v-model="chatSettingsForm.supportAutoReplyAttachmentUrl">
                      <option value="">Chọn sticker</option>
                      <option v-for="option in supportStickerOptions" :key="`auto-sticker-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                </div>
              </div>
              <label class="admin-chat-settings__check">
                <input v-model="chatSettingsForm.supportAwayEnabled" type="checkbox" />
                <span>Bật chế độ vắng mặt</span>
              </label>
              <div class="admin-chat-settings__message-card">
                <label class="form-field">
                  <span>Tin nhắn vắng mặt</span>
                  <textarea
                    v-model.trim="chatSettingsForm.supportAwayMessage"
                    rows="4"
                    :disabled="!chatSettingsForm.supportAwayEnabled"
                    placeholder="Dùng {queueNumber}, {etaMinutes}, {etaMaxMinutes} để hệ thống tự thay số"
                  ></textarea>
                </label>
                <div class="admin-chat-settings__attach-grid">
                  <label class="form-field">
                    <span>Kiểu đính kèm</span>
                    <select v-model="chatSettingsForm.supportAwayAttachmentType" :disabled="!chatSettingsForm.supportAwayEnabled">
                      <option v-for="option in supportAttachmentOptions.filter((item) => item.value !== 'vip')" :key="`away-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <label v-if="chatSettingsForm.supportAwayAttachmentType === 'image'" class="form-field">
                    <span>Đường dẫn ảnh</span>
                    <input v-model.trim="chatSettingsForm.supportAwayAttachmentUrl" type="text" :disabled="!chatSettingsForm.supportAwayEnabled" placeholder="/uploads/chat/ten-anh.png" />
                  </label>
                  <label v-else-if="chatSettingsForm.supportAwayAttachmentType === 'sticker'" class="form-field">
                    <span>Sticker</span>
                    <select v-model="chatSettingsForm.supportAwayAttachmentUrl" :disabled="!chatSettingsForm.supportAwayEnabled">
                      <option value="">Chọn sticker</option>
                      <option v-for="option in supportStickerOptions" :key="`away-sticker-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div v-if="activeChatSettingsSection === 'sound'" class="admin-chat-settings__section">
              <div class="admin-chat-settings__section-head">
                <strong>Âm báo</strong>
                <span>10 lựa chọn âm, mỗi âm phát chuỗi 3 tiếng rõ hơn.</span>
              </div>
              <div class="admin-chat-settings__sound-grid">
                <label class="form-field">
                  <span>Âm báo tin nhắn mới</span>
                  <select v-model="chatSettingsForm.supportNotifySound">
                    <option v-for="option in supportSoundOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </label>
                <label class="form-field">
                  <span>Âm lượng thông báo: {{ chatSettingsForm.supportNotifyVolume }}%</span>
                  <input v-model="chatSettingsForm.supportNotifyVolume" type="range" min="80" max="320" step="10" />
                </label>
              </div>
              <div class="action-btns action-btns--left">
                <button class="btn btn--sm" type="button" @click="previewSupportNotifySound">Nghe thử</button>
              </div>
            </div>

            <div v-if="activeChatSettingsSection === 'quick'" class="admin-chat-settings__section">
              <div class="admin-chat-settings__section-head">
                <strong>Nút gửi nhanh</strong>
                <span>Ấn vào từng nút để chỉnh tên, kiểu đính kèm và nội dung gửi. Có thể xóa nút hoặc bật lại slot trống.</span>
              </div>
              <div class="admin-chat-quick-manager">
                <div class="admin-chat-quick-manager__list">
                  <button
                    v-for="reply in editableQuickReplyButtons"
                    :key="`setting-pill-${reply.key}`"
                    type="button"
                    class="admin-chat-quick-manager__item"
                    :class="{
                      'admin-chat-quick-manager__item--active': activeQuickReplyKey === reply.key,
                      'admin-chat-quick-manager__item--empty': !reply.enabled
                    }"
                    @click="activeQuickReplyKey = reply.key"
                  >
                    <strong>{{ reply.label || 'Nút trống' }}</strong>
                    <span>{{ formatQuickAttachmentLabel(reply.attachmentType) }}</span>
                    <em v-if="!reply.enabled">Đã ẩn</em>
                  </button>
                </div>
                <div class="action-btns action-btns--left">
                  <button class="btn btn--sm" type="button" @click="addQuickReplyButton">Thêm nút</button>
                  <button class="btn btn--danger btn--sm" type="button" :disabled="!activeQuickReplyConfig" @click="deleteQuickReplyButton(activeQuickReplyConfig)">Xóa nút đang chọn</button>
                </div>
              </div>

              <div v-if="activeQuickReplyConfig" class="admin-chat-settings__message-card admin-chat-settings__message-card--active">
                <div class="admin-chat-settings__quick-grid">
                  <label class="form-field">
                    <span>Tên nút</span>
                    <input v-model.trim="chatSettingsForm[activeQuickReplyConfig.labelKey]" type="text" maxlength="40" placeholder="Tên nút hiển thị" />
                  </label>
                  <label class="form-field">
                    <span>Nội dung gửi</span>
                    <textarea
                      v-if="activeQuickReplyConfig.messageKey"
                      v-model.trim="chatSettingsForm[activeQuickReplyConfig.messageKey]"
                      rows="3"
                      maxlength="500"
                      placeholder="Nội dung khi bấm nút này"
                    ></textarea>
                    <textarea
                      v-else
                      :value="activeQuickReplyConfig.defaultMessage || ''"
                      rows="3"
                      disabled
                    ></textarea>
                  </label>
                </div>
                <div class="admin-chat-settings__attach-grid">
                  <label class="form-field">
                    <span>Kiểu đính kèm</span>
                    <select v-model="chatSettingsForm[activeQuickReplyConfig.attachmentTypeKey]">
                      <option v-for="option in supportQuickAttachmentOptions" :key="`${activeQuickReplyConfig.key}-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <label v-if="chatSettingsForm[activeQuickReplyConfig.attachmentTypeKey] === 'image'" class="form-field">
                    <span>Đường dẫn ảnh</span>
                    <input v-model.trim="chatSettingsForm[activeQuickReplyConfig.attachmentUrlKey]" type="text" placeholder="/uploads/chat/ten-anh.png" />
                  </label>
                  <label v-else-if="chatSettingsForm[activeQuickReplyConfig.attachmentTypeKey] === 'sticker'" class="form-field">
                    <span>Sticker</span>
                    <select v-model="chatSettingsForm[activeQuickReplyConfig.attachmentUrlKey]">
                      <option value="">Chọn sticker</option>
                      <option v-for="option in supportStickerOptions" :key="`${activeQuickReplyConfig.key}-sticker-${option.value}`" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                  <label v-else-if="chatSettingsForm[activeQuickReplyConfig.attachmentTypeKey] === 'url'" class="form-field">
                    <span>URL đính kèm</span>
                    <input v-model.trim="chatSettingsForm[activeQuickReplyConfig.attachmentUrlKey]" type="text" placeholder="https://..." />
                  </label>
                  <label v-else-if="chatSettingsForm[activeQuickReplyConfig.attachmentTypeKey] === 'bank'" class="form-field">
                    <span>Thông tin chuyển khoản</span>
                    <textarea v-model.trim="chatSettingsForm[activeQuickReplyConfig.attachmentUrlKey]" rows="3" placeholder="BIDV - 860058891 hoặc STK 860058891 BIDV"></textarea>
                  </label>
                  <div v-else-if="chatSettingsForm[activeQuickReplyConfig.attachmentTypeKey] === 'vip'" class="admin-chat-vip-card">
                    <small>Nút này sẽ tự tạo ảnh bảng VIP theo cấu hình hiện tại rồi gửi thẳng cho khách.</small>
                  </div>
                </div>
              </div>
            </div>
            <div class="action-btns action-btns--left">
              <button class="btn btn--primary btn--sm" :disabled="savingChatSettings" @click="saveChatSettings">
                {{ savingChatSettings ? 'Đang lưu...' : 'Lưu cài đặt CSKH' }}
              </button>
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
              <div
                v-for="msg in mobileChatMessages"
                :key="msg._id || msg.id || msg.createdAt"
                class="admin-chat-msg"
                :class="msg.senderRole === 'user' ? 'admin-chat-msg--user' : 'admin-chat-msg--admin'"
              >
                <div class="admin-chat-msg__bubble">
                  <template v-if="msg.messageType === 'image' && msg.imageUrl">
                    <button class="admin-chat-image-btn" type="button" @click="openChatImagePreview(resolveImageSrc(msg.imageUrl))">
                      <img class="admin-chat-image" :src="resolveImageSrc(msg.imageUrl)" alt="Ảnh" />
                    </button>
                    <div class="admin-chat-image-actions">
                      <button class="admin-chat-image-link" type="button" @click="copyChatImage(resolveImageSrc(msg.imageUrl))">Sao chép ảnh</button>
                      <a class="admin-chat-image-link" :href="resolveImageSrc(msg.imageUrl)" target="_blank" rel="noopener" download>Tải ảnh</a>
                    </div>
                    <p v-if="msg.content" class="admin-chat-msg__text admin-chat-msg__text--caption">{{ msg.content }}</p>
                  </template>
                  <template v-else-if="msg.messageType === 'file' && msg.fileUrl">
                    <div class="admin-chat-file-card">
                      <strong class="admin-chat-file-name">{{ getChatFileName(msg) }}</strong>
                      <span v-if="Number(msg.fileSize || 0) > 0" class="admin-chat-file-size">{{ formatFileSize(msg.fileSize) }}</span>
                      <div class="admin-chat-file-actions">
                        <a class="admin-chat-image-link" :href="resolveFileSrc(msg.fileUrl)" target="_blank" rel="noopener">Mở tệp</a>
                        <a class="admin-chat-image-link" :href="resolveFileSrc(msg.fileUrl)" :download="getChatFileName(msg)" target="_blank" rel="noopener">Tải tệp</a>
                      </div>
                    </div>
                    <p v-if="msg.content" class="admin-chat-msg__text admin-chat-msg__text--caption">{{ msg.content }}</p>
                  </template>
                  <template v-else>
                    <p class="admin-chat-msg__text">{{ msg.content }}</p>
                    <div v-if="extractChatQrData(msg.content)" class="chat-qr-card">
                      <img class="chat-qr-card__image" :src="buildChatQrUrl(extractChatQrData(msg.content))" alt="Mã QR chuyển khoản" />
                      <div class="chat-qr-card__meta">
                        <strong>{{ extractChatQrData(msg.content).bankLabel }}</strong>
                        <span>STK: {{ extractChatQrData(msg.content).accountNumber }}</span>
                        <small v-if="extractChatQrData(msg.content).accountName">{{ extractChatQrData(msg.content).accountName }}</small>
                      </div>
                    </div>
                  </template>
                  <small>{{ formatDate(msg.createdAt) }}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'incidents'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Quản lý sự cố hệ thống</h3>
              <p class="panel-card__subtext">Lưu và theo dõi lỗi realtime để xử lý nhanh, không bị trôi log.</p>
            </div>
            <div class="action-btns action-btns--left">
              <button class="btn btn--sm" type="button" :disabled="incidentLoading" @click="refreshIncidentData">
                {{ incidentLoading ? 'Đang tải...' : 'Làm mới' }}
              </button>
            </div>
          </div>

          <div class="stats-grid stats-grid--incident">
            <div class="kpi-card">
              <span>Tổng sự cố</span>
              <strong>{{ incidentStats.total }}</strong>
            </div>
            <div class="kpi-card">
              <span>24 giờ</span>
              <strong>{{ incidentStats.last24h }}</strong>
            </div>
            <div class="kpi-card">
              <span>Đang mở</span>
              <strong>{{ incidentStats.open }}</strong>
            </div>
            <div class="kpi-card">
              <span>Đang xử lý</span>
              <strong>{{ incidentStats.investigating }}</strong>
            </div>
            <div class="kpi-card">
              <span>Đã xử lý</span>
              <strong>{{ incidentStats.resolved }}</strong>
            </div>
          </div>

          <div class="admin-incident-filters">
            <label class="form-field">
              <span>Trạng thái</span>
              <select v-model="incidentFilters.status">
                <option v-for="item in incidentStatusOptions" :key="`status-${item.value || 'all'}`" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label class="form-field">
              <span>Nguồn lỗi</span>
              <select v-model="incidentFilters.source">
                <option v-for="item in incidentSourceOptions" :key="`source-${item.value || 'all'}`" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label class="form-field">
              <span>Mức độ</span>
              <select v-model="incidentFilters.level">
                <option v-for="item in incidentLevelOptions" :key="`level-${item.value || 'all'}`" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label class="form-field form-field--search">
              <span>Từ khóa</span>
              <input v-model.trim="incidentFilters.keyword" type="text" placeholder="Mã lỗi, URL, nội dung..." @keydown.enter.prevent="applyIncidentFilters" />
            </label>
            <div class="action-btns action-btns--left">
              <button class="btn btn--primary btn--sm" type="button" :disabled="incidentLoading" @click="applyIncidentFilters">Lọc</button>
              <button class="btn btn--sm" type="button" :disabled="incidentLoading" @click="resetIncidentFilters">Đặt lại</button>
            </div>
          </div>

          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                  <th>Nội dung</th>
                  <th>Vị trí</th>
                  <th>Số lần</th>
                  <th>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="incidentLoading && !incidentLogs.length">
                  <td colspan="7" class="data-table__empty">Đang tải danh sách sự cố...</td>
                </tr>
                <tr v-else-if="!incidentLoading && !incidentLogs.length">
                  <td colspan="7" class="data-table__empty">Chưa có sự cố theo bộ lọc hiện tại.</td>
                </tr>
                <tr v-for="item in incidentLogs" :key="item._id">
                  <td>{{ formatDate(item.lastSeenAt || item.createdAt) }}</td>
                  <td>
                    <span class="badge badge--info">{{ incidentSourceLabel(item.source) }}</span>
                    <span class="badge" :class="incidentLevelClass(item.level)">{{ incidentLevelLabel(item.level) }}</span>
                  </td>
                  <td>
                    <span class="badge" :class="incidentStatusClass(item.status)">{{ incidentStatusLabel(item.status) }}</span>
                  </td>
                  <td>
                    <strong>{{ item.message || '--' }}</strong>
                    <p v-if="item.code" class="admin-incident-code">Mã: {{ item.code }}</p>
                    <details v-if="item.stack" class="admin-incident-stack">
                      <summary>Xem stack</summary>
                      <pre>{{ item.stack }}</pre>
                    </details>
                  </td>
                  <td>
                    <div>{{ item.request?.method || '--' }} {{ item.request?.path || '--' }}</div>
                    <small v-if="item.context?.roomId">Room: {{ item.context.roomId }}</small>
                  </td>
                  <td>{{ Number(item.count || 1) }}</td>
                  <td>
                    <div class="action-btns action-btns--left">
                      <button class="btn btn--sm" type="button" :disabled="Boolean(incidentActionLoading[item._id])" @click="setIncidentStatus(item, 'investigating')">Đang xử lý</button>
                      <button class="btn btn--sm btn--primary" type="button" :disabled="Boolean(incidentActionLoading[item._id])" @click="setIncidentStatus(item, 'resolved')">Đã xử lý</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="panel-card__subtext">Trang {{ incidentPaging.page }}/{{ incidentPaging.pages }} · Tổng {{ incidentPaging.total }} bản ghi.</p>
        </div>
      </div>

      <div v-if="chatImagePreviewUrl" class="chat-image-viewer" @click.self="closeChatImagePreview">
        <div class="chat-image-viewer__dialog">
          <button class="chat-image-viewer__close" type="button" @click="closeChatImagePreview">×</button>
          <img class="chat-image-viewer__image" :src="chatImagePreviewUrl" alt="Xem ảnh lớn" />
          <div class="chat-image-viewer__actions">
            <button class="chat-image-viewer__btn" type="button" @click="copyChatImage(chatImagePreviewUrl)">Sao chép ảnh</button>
            <a class="chat-image-viewer__btn chat-image-viewer__btn--link" :href="chatImagePreviewUrl" target="_blank" rel="noopener" download>Tải ảnh</a>
          </div>
        </div>
      </div>

      <!-- Set Kèo 1/3/5 (Keno placeholders) -->
      <div v-if="activeTab === 'set-keo-1' || activeTab === 'set-keo-3' || activeTab === 'set-keo-5'" class="admin-panel">
        <div class="panel-card">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Set kèo</h3>
              <p class="panel-card__subtext">Khung chờ vận hành Keno. Bảng này đã chuẩn bị sẵn layout realtime và cuộn ngang cho mobile.</p>
            </div>
          </div>
          <p style="text-align:center;padding:14px 0;font-size:15px;font-weight:700">Kỳ {{ kenoRoundLabel }}</p>
          <p style="text-align:center;color:#888;font-size:14px">{{ formatCountdown(sicboControl.timeLeft) }}</p>
          <div class="table-scroll">
            <table class="data-table" style="margin-top:16px">
              <thead><tr><th>ID USER</th><th>USERNAME</th><th>CHỌN</th><th>SỐ TIỀN</th><th>THỜI GIAN ĐẶT</th></tr></thead>
              <tbody>
                <tr><td colspan="5" style="text-align:center;color:#999;padding:20px">Chưa có dữ liệu cược Keno</td></tr>
              </tbody>
            </table>
          </div>
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
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Giới hạn cược và chip</h3>
              <p class="panel-card__subtext">Đặt `0` ở cược tối đa để mở không giới hạn mỗi lệnh.</p>
            </div>
            <span class="badge badge--info">{{ oddsConfig.maxBet > 0 ? formatMoney(oddsConfig.maxBet) : 'Không giới hạn' }}</span>
          </div>
          <div class="form-grid">
            <label class="form-field"><span>Cược tối thiểu</span><input v-model="oddsConfig.minBet" type="number" min="1" step="1" /></label>
            <label class="form-field"><span>Cược tối đa</span><input v-model="oddsConfig.maxBet" type="number" min="0" step="1" placeholder="0 = Không giới hạn" /></label>
            <label class="form-field"><span>Khóa cược trước</span><input v-model="oddsConfig.betLockSeconds" type="number" min="0" step="1" /></label>
            <label class="form-field"><span>Chip nhanh</span><input v-model="chipOptionsText" type="text" placeholder="10, 50, 100, 500..." /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:10px">
            <button class="btn btn--primary btn--sm" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu giới hạn' }}</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Tỉ lệ nhanh (Lớn/Nhỏ/Chẵn/Lẻ)</h3></div>
          <div class="odds-quick">
            <label class="form-field"><span>Lớn</span><input v-model="oddsConfig.odds.tai" type="number" step="0.01" /></label>
            <label class="form-field"><span>Nhỏ</span><input v-model="oddsConfig.odds.xiu" type="number" step="0.01" /></label>
            <label class="form-field"><span>Chẵn</span><input v-model="oddsConfig.odds.even" type="number" step="0.01" /></label>
            <label class="form-field"><span>Lẻ</span><input v-model="oddsConfig.odds.odd" type="number" step="0.01" /></label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:10px">
            <button class="btn btn--primary btn--sm" :disabled="savingOdds" @click="saveOddsSettings">{{ savingOdds ? 'Đang lưu...' : 'Lưu tỉ lệ' }}</button>
            <button class="btn btn--sm" :disabled="savingOdds" @click="resetOddsSettings">Reset</button>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-card__header"><h3>Lệnh cược gần đây</h3></div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>ID</th><th>Username</th><th>Cửa</th><th>Số tiền</th><th>Thời gian</th></tr></thead>
              <tbody>
                <tr v-if="recentGameHistory.filter(b=>b.roomId==='sicbo-5p').length===0"><td colspan="5" class="panel-card__empty">Chưa có lệnh cược</td></tr>
                <tr v-for="bet in recentGameHistory.filter(b=>b.roomId==='sicbo-5p').slice(0,15)" :key="bet._id">
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
      </div>

      <div v-if="activeTab === 'live-bets'" class="admin-panel admin-panel--compact">
        <div class="panel-card panel-card--live">
          <div class="request-board__toolbar">
            <div>
              <h3>Giao dịch đặt cược realtime</h3>
              <p>Theo dõi phòng đang chạy, phiên hiện tại, người chơi đang vào cửa và lịch sử lệnh ngay trong một màn hình.</p>
            </div>
            <input v-model="liveBetSearchKeyword" type="text" class="topbar__search" placeholder="Tìm user / mã user / cửa / phiên..." />
          </div>

          <div class="live-room-switch">
            <button
              v-for="room in liveRoomCards"
              :key="room.roomId"
              type="button"
              class="live-room-switch__item"
              :class="{ 'live-room-switch__item--active': liveRoomId === room.roomId }"
              @click="liveRoomId = room.roomId"
            >
              <small>{{ room.roomId === 'sicbo-5p' ? 'Phòng ổn định' : 'Phòng nhanh' }}</small>
              <strong>{{ formatRoomLabel(room.roomId) }}</strong>
              <span>Phiên {{ room.roundId }} · {{ formatCountdown(room.timeLeft) }}</span>
            </button>
          </div>

          <div class="live-overview">
            <article class="live-overview__card">
              <span>Phòng hiện tại</span>
              <strong>{{ formatRoomLabel(liveBetsFeed.roomId) }}</strong>
              <small>Realtime 3.5 giây / lần + đồng bộ socket</small>
            </article>
            <article class="live-overview__card">
              <span>Phiên giao dịch</span>
              <strong>{{ liveBetsFeed.state?.roundId || '--' }}</strong>
              <small>{{ formatCountdown(liveBetsFeed.state?.timeLeft || 0) }}</small>
            </article>
            <article class="live-overview__card">
              <span>Trạng thái</span>
              <strong :class="liveBetsFeed.state?.bettingOpen ? 'text-success' : 'text-danger'">
                {{ liveBetsFeed.state?.bettingOpen ? 'Đang mở cược' : 'Đã khóa cược' }}
              </strong>
              <small>{{ Number(liveBetsFeed.state?.betCount || 0) }} lệnh hiện tại</small>
            </article>
            <article class="live-overview__card">
              <span>Tổng tiền đang vào</span>
              <strong>{{ formatMoney(liveCurrentBetAmount) }}</strong>
              <small>{{ liveCurrentBetUsers }} người chơi đang tham gia</small>
            </article>
          </div>

          <div v-if="liveCurrentBetGateSummary.length" class="live-gates">
            <span
              v-for="item in liveCurrentBetGateSummary"
              :key="item.gate"
              class="live-gates__pill"
            >
              {{ formatGateLabel(item.gate) }} · {{ formatMoney(item.amount) }}
            </span>
          </div>

          <div class="panel-card__section">
            <div class="panel-card__header">
              <h3>Người chơi đang vào lệnh</h3>
              <span class="badge badge--info">{{ filteredLiveCurrentBets.length }}</span>
            </div>
            <div v-if="filteredLiveCurrentBets.length === 0" class="panel-card__empty">Hiện chưa có lệnh mở trong phiên này.</div>
            <div v-else class="table-scroll">
              <table class="data-table data-table--request">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Người chơi</th>
                    <th>Mã user</th>
                    <th>Đang đặt</th>
                    <th>Số tiền</th>
                    <th>Phiên GD</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="bet in filteredLiveCurrentBets" :key="bet._id">
                    <td>{{ formatRoomLabel(bet.roomId) }}</td>
                    <td>{{ bet.userId?.username || 'N/A' }}</td>
                    <td>{{ bet.userId?.userCode || '--' }}</td>
                    <td><strong>{{ formatGateLabel(bet.gate) }}</strong></td>
                    <td class="text-bold">{{ formatMoney(bet.amount) }}</td>
                    <td>{{ bet.roundId }}</td>
                    <td>{{ formatDate(bet.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-card__section">
            <div class="panel-card__header">
              <h3>Lịch sử cược gần nhất</h3>
              <span class="badge">{{ filteredLiveRecentBets.length }}</span>
            </div>
            <div v-if="filteredLiveRecentBets.length === 0" class="panel-card__empty">Chưa có lịch sử cược.</div>
            <div v-else class="table-scroll">
              <table class="data-table data-table--request">
                <thead>
                  <tr>
                    <th>Người chơi</th>
                    <th>Mã user</th>
                    <th>Cửa</th>
                    <th>Tiền cược</th>
                    <th>Trả thưởng</th>
                    <th>Trạng thái</th>
                    <th>Phiên</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="bet in filteredLiveRecentBets.slice(0, 25)" :key="`recent-${bet._id}`">
                    <td>{{ bet.userId?.username || 'N/A' }}</td>
                    <td>{{ bet.userId?.userCode || '--' }}</td>
                    <td>{{ formatGateLabel(bet.gate) }}</td>
                    <td>{{ formatMoney(bet.amount) }}</td>
                    <td>{{ formatMoney(bet.payout) }}</td>
                    <td>
                      <span class="badge" :class="bet.status === 'won' ? 'badge--success' : bet.status === 'lost' ? 'badge--danger' : 'badge--warning'">
                        {{ formatBetStatus(bet.status, bet.payout) }}
                      </span>
                    </td>
                    <td>{{ bet.roundId }}</td>
                    <td>{{ formatDate(bet.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-card__section">
            <div class="panel-card__header">
              <h3>Phiên gần đây</h3>
              <span class="badge">{{ liveBetsFeed.rounds.length }}</span>
            </div>
            <div v-if="!liveBetsFeed.rounds.length" class="panel-card__empty">Chưa có lịch sử phiên.</div>
            <div v-else class="table-scroll">
              <table class="data-table data-table--request">
                <thead>
                  <tr>
                    <th>Phòng</th>
                    <th>Phiên</th>
                    <th>Kết quả</th>
                    <th>Tổng điểm</th>
                    <th>Tổng cược</th>
                    <th>Trạng thái</th>
                    <th>Chốt lúc</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="round in liveBetsFeed.rounds.slice(0, 12)" :key="`round-${round._id}`">
                    <td>{{ formatRoomLabel(round.roomId) }}</td>
                    <td>{{ round.roundId }}</td>
                    <td>{{ Array.isArray(round.result) && round.result.length === 3 ? round.result.join(' - ') : '--' }}</td>
                    <td>{{ round.total || '--' }}</td>
                    <td>{{ formatMoney(round.betTotalAmount) }}</td>
                    <td><span class="badge" :class="round.status === 'settled' ? 'badge--success' : 'badge--warning'">{{ round.status === 'settled' ? 'Đã chốt' : 'Đang mở' }}</span></td>
                    <td>{{ formatDate(round.settledAt || round.updatedAt || round.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Yêu cầu rút tiền -->
      <div v-if="activeTab === 'withdraw-requests'" class="admin-panel admin-panel--compact">
        <div class="panel-card request-board">
          <div class="request-board__toolbar">
            <div>
              <h3>Yêu cầu rút tiền</h3>
              <p>Kiểm tra ngân hàng nhận, số dư và chốt trạng thái ngay tại bảng giao dịch.</p>
            </div>
            <input v-model="withdrawSearchKeyword" type="text" class="topbar__search" placeholder="Tìm user / mã user / ngân hàng / STK..." />
          </div>
          <div class="request-board__stats">
            <span class="badge badge--info">{{ paginationSummary(transactionPaging.withdraw) }}</span>
            <span class="badge badge--warning">Chờ xử lý: {{ filteredWithdrawRequests.filter((item) => item.status === 'pending').length }}</span>
            <span class="badge badge--success">Thành công: {{ filteredWithdrawRequests.filter((item) => formatRequestStatus(item) === 'Thành công').length }}</span>
            <span class="badge badge--danger">Từ chối: {{ filteredWithdrawRequests.filter((item) => formatRequestStatus(item) === 'Từ chối').length }}</span>
          </div>
          <div v-if="filteredWithdrawRequests.length === 0" class="panel-card__empty">Không có yêu cầu rút tiền.</div>
          <div v-else class="table-scroll">
            <table class="data-table data-table--request">
              <thead>
                <tr>
                  <th>Tên tài khoản</th>
                  <th>Người dùng ID</th>
                  <th>Thông tin thanh toán</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tx in filteredWithdrawRequests" :key="tx._id">
                  <td>{{ tx.userId?.username || 'N/A' }}</td>
                  <td>{{ tx.userId?.userCode || '--' }}</td>
                  <td>
                    <div class="request-payment">
                      <strong>{{ buildWithdrawPaymentInfo(tx).bank || '--' }}</strong>
                      <span>{{ buildWithdrawPaymentInfo(tx).accountName || 'Chưa có tên nhận' }}</span>
                      <span>{{ buildWithdrawPaymentInfo(tx).accountNumber || 'Chưa có số tài khoản' }}</span>
                    </div>
                  </td>
                  <td class="text-bold">{{ formatMoney(Math.abs(tx.amount)) }}</td>
                  <td><span class="badge" :class="requestStatusClass(tx)">{{ formatRequestStatus(tx) }}</span></td>
                  <td>
                    <div v-if="tx.status === 'pending'" class="action-btns action-btns--left">
                      <button class="btn btn--success btn--sm" @click="reviewTransaction(tx._id,'approve')">Xác nhận</button>
                      <button class="btn btn--danger btn--sm" @click="reviewTransaction(tx._id,'reject')">Từ chối</button>
                    </div>
                    <span v-else class="request-done">Đã xử lý</span>
                  </td>
                  <td>{{ formatDate(tx.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination">
            <span>{{ paginationSummary(transactionPaging.withdraw) }}</span>
            <div class="admin-pagination__actions">
              <button class="btn btn--sm" :disabled="!hasPrevPage(transactionPaging.withdraw) || transactionPaging.withdraw.loading" @click="changeTransactionPage('withdraw', -1)">Trước</button>
              <button class="btn btn--sm" :disabled="!hasNextPage(transactionPaging.withdraw) || transactionPaging.withdraw.loading" @click="changeTransactionPage('withdraw', 1)">Sau</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Yêu cầu nạp tiền -->
      <div v-if="activeTab === 'deposit-requests'" class="admin-panel admin-panel--compact">
        <div class="panel-card request-board">
          <div class="request-board__toolbar">
            <div>
              <h3>Yêu cầu nạp tiền</h3>
              <p>Đối soát nhanh theo người chơi, tài khoản nhận, nội dung chuyển khoản và trạng thái xử lý.</p>
            </div>
            <input v-model="depositSearchKeyword" type="text" class="topbar__search" placeholder="Tìm user / mã user / ngân hàng / nội dung..." />
          </div>
          <div class="request-board__stats">
            <span class="badge badge--info">{{ paginationSummary(transactionPaging.deposit) }}</span>
            <span class="badge badge--warning">Chờ xử lý: {{ filteredDepositRequests.filter((item) => item.status === 'pending').length }}</span>
            <span class="badge badge--success">Thành công: {{ filteredDepositRequests.filter((item) => formatRequestStatus(item) === 'Thành công').length }}</span>
            <span class="badge badge--danger">Từ chối: {{ filteredDepositRequests.filter((item) => formatRequestStatus(item) === 'Từ chối').length }}</span>
          </div>
          <div v-if="filteredDepositRequests.length === 0" class="panel-card__empty">Không có yêu cầu nạp tiền.</div>
          <div v-else class="table-scroll">
            <table class="data-table data-table--request">
              <thead>
                <tr>
                  <th>Tên tài khoản</th>
                  <th>Người dùng ID</th>
                  <th>Thông tin thanh toán</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tx in filteredDepositRequests" :key="tx._id">
                  <td>{{ tx.userId?.username || 'N/A' }}</td>
                  <td>{{ tx.userId?.userCode || '--' }}</td>
                  <td>
                    <div class="request-payment">
                      <strong>{{ buildDepositPaymentInfo(tx).bank || '--' }}</strong>
                      <span>{{ buildDepositPaymentInfo(tx).accountName || 'Chưa có tên nhận' }}</span>
                      <span>{{ buildDepositPaymentInfo(tx).accountNumber || 'Chưa có số tài khoản' }}</span>
                      <small>{{ buildDepositPaymentInfo(tx).note || 'Chưa có nội dung CK' }}</small>
                    </div>
                  </td>
                  <td class="text-bold">{{ formatMoney(tx.amount) }}</td>
                  <td><span class="badge" :class="requestStatusClass(tx)">{{ formatRequestStatus(tx) }}</span></td>
                  <td>
                    <div v-if="tx.status === 'pending'" class="action-btns action-btns--left">
                      <button class="btn btn--success btn--sm" @click="reviewTransaction(tx._id,'approve')">Xác nhận</button>
                      <button class="btn btn--danger btn--sm" @click="reviewTransaction(tx._id,'reject')">Từ chối</button>
                    </div>
                    <span v-else class="request-done">Đã xử lý</span>
                  </td>
                  <td>{{ formatDate(tx.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-pagination">
            <span>{{ paginationSummary(transactionPaging.deposit) }}</span>
            <div class="admin-pagination__actions">
              <button class="btn btn--sm" :disabled="!hasPrevPage(transactionPaging.deposit) || transactionPaging.deposit.loading" @click="changeTransactionPage('deposit', -1)">Trước</button>
              <button class="btn btn--sm" :disabled="!hasNextPage(transactionPaging.deposit) || transactionPaging.deposit.loading" @click="changeTransactionPage('deposit', 1)">Sau</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Thêm mới nhân viên -->
      <div v-if="activeTab === 'add-staff'" class="admin-panel">
        <div class="panel-card panel-card--narrow">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Tạo tài khoản nhân viên</h3>
              <p class="panel-card__subtext">Phiên bản rút gọn để tạo nhanh tài khoản vận hành mới từ điện thoại hoặc desktop.</p>
            </div>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>Tài khoản</span>
              <input v-model="newAdminForm.username" type="text" />
            </label>
            <label class="form-field">
              <span>Mật khẩu</span>
              <input v-model="newAdminForm.password" type="password" />
            </label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:16px">
            <button class="btn btn--primary" style="min-width:140px" :disabled="savingAdminForm" @click="createAdminUser">
              {{ savingAdminForm ? 'Đang tạo...' : 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tài khoản ngân hàng (Admin) -->
      <div v-if="activeTab === 'bank-accounts'" class="admin-panel">
        <div class="panel-card panel-card--medium">
          <div class="panel-card__header panel-card__header--stack">
            <div>
              <h3>Cài đặt ngân hàng</h3>
              <p class="panel-card__subtext">Thiết lập tài khoản nhận tiền mặc định cho người chơi và đồng bộ trực tiếp vào yêu cầu nạp.</p>
            </div>
          </div>
          <div class="form-grid">
            <label class="form-field">
              <span>Tên người nhận</span>
              <input v-model="adminBankForm.accountName" type="text" />
            </label>
            <label class="form-field">
              <span>Tên ngân hàng</span>
              <input v-model="adminBankForm.bankName" type="text" />
            </label>
            <label class="form-field">
              <span>STK</span>
              <input v-model="adminBankForm.bankAccount" type="text" />
            </label>
            <label class="form-field">
              <span>Nội dung chuyển khoản</span>
              <input v-model="adminBankForm.transferNote" type="text" />
            </label>
          </div>
          <div class="action-btns action-btns--left" style="margin-top:16px">
            <button class="btn btn--primary" style="min-width:120px" :disabled="savingAdminBank" @click="saveAdminBank">
              {{ savingAdminBank ? 'Đang lưu...' : 'Lưu' }}
            </button>
          </div>
        </div>

        <div class="panel-card" style="margin-top:20px">
          <div class="panel-card__header">
            <h3>Tài khoản ngân hàng đang dùng</h3>
            <span class="badge">{{ adminBanks.length }}</span>
          </div>
          <div class="table-scroll">
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
import { useRoute, useRouter } from 'vue-router'
import { apiFetch, API_BASE_URL } from '@/lib/api'
import { useUserStore } from '@/stores/user'
import { useSocketStore } from '@/stores/socket'
import { formatDateTimeVN, isSameVietnamDay } from '@/utils/vietnamTime'
import {
  VIP_PRIVILEGE_DEFAULT_ROWS,
  VIP_PRIVILEGE_DEFAULT_SUBTITLE,
  VIP_PRIVILEGE_DEFAULT_TITLE,
  cloneVipPrivilegeRows,
  toVipPrivilegeDisplayRows
} from '@/constants/vipPrivilegeDefaults'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const socketStore = useSocketStore()

const sidebarOpen = ref(false)

function sidebarIcon(paths, viewBox = '0 0 24 24') {
  return `<svg viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`
}

const logoutIcon = sidebarIcon(
  '<path d="M10 6V4.5A2.5 2.5 0 0 1 12.5 2h4A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2h-4A2.5 2.5 0 0 1 10 19v-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
)
const gamepadIcon = sidebarIcon(
  '<path d="M7 10h10a4 4 0 0 1 3.9 4.9l-.4 1.8a3 3 0 0 1-4.9 1.6L13.9 17a3 3 0 0 0-3.8 0l-1.7 1.3a3 3 0 0 1-4.9-1.6l-.4-1.8A4 4 0 0 1 7 10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 14h4M10 12v4M16.5 13.5h.01M18.5 15.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
)

const tabs = [
  { key: 'dashboard', label: 'Doanh Thu', icon: sidebarIcon('<path d="M4 19V11M10 19V5M16 19v-8M22 19V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2 19h20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') },
  { key: 'users', label: 'Người chơi', icon: sidebarIcon('<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8"/><path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') },
  { key: 'admins', label: 'Quản lý nhân viên', icon: sidebarIcon('<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" stroke-width="1.8"/><path d="M3 20a6 6 0 0 1 12 0M15 20a4.5 4.5 0 0 1 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') },
  { key: 'set-keo-1', label: 'Set Kèo 1', icon: sidebarIcon('<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/>') },
  { key: 'set-keo-3', label: 'Set Kèo 3', icon: sidebarIcon('<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/>') },
  { key: 'set-keo-5', label: 'Set Kèo 5', icon: sidebarIcon('<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/>') },
  { key: 'odds-settings', label: 'Set Kèo Xúc sắc 3p', icon: sidebarIcon('<path d="M5 7.5 9 4l10 2.5L15 10l-10-2.5ZM5 7.5V14l10 2.5v-6.5M19 6.5V13l-4 3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>') },
  { key: 'odds-5p', label: 'Set Kèo Xúc sắc 5p', icon: sidebarIcon('<path d="M5 7.5 9 4l10 2.5L15 10l-10-2.5ZM5 7.5V14l10 2.5v-6.5M19 6.5V13l-4 3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>') },
  { key: 'live-bets', label: 'Đang chơi', icon: sidebarIcon('<path d="M5 18h14M8 18V9m4 9V6m4 12v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m6 6 3 3 3-4 3 2 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>') },
  { key: 'withdraw-requests', label: 'Yêu cầu rút tiền', icon: sidebarIcon('<path d="M12 4v12m0 0-4-4m4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="16" width="16" height="4" rx="2" stroke="currentColor" stroke-width="1.8"/>') },
  { key: 'deposit-requests', label: 'Yêu cầu nạp tiền', icon: sidebarIcon('<path d="M12 20V8m0 0-4 4m4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="4" width="16" height="4" rx="2" stroke="currentColor" stroke-width="1.8"/>') },
  { key: 'game-history', label: 'Lịch sử trò chơi', icon: sidebarIcon('<path d="M6 4h10l4 4v12H6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 4v4h4M9 12h8M9 16h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') },
  { key: 'payout-settings', label: 'Cài đặt', icon: sidebarIcon('<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>') },
  { key: 'incidents', label: 'Sự cố hệ thống', icon: sidebarIcon('<path d="M12 3 2.8 19a1.2 1.2 0 0 0 1.04 1.8h16.32A1.2 1.2 0 0 0 21.2 19L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v5m0 3h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') },
  { key: 'add-staff', label: 'Thêm mới nhân viên', icon: sidebarIcon('<path d="M15 20a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') },
  { key: 'bank-accounts', label: 'Tài khoản ngân hàng', icon: sidebarIcon('<path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M2 19h20M4 6l8-3 8 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>') },
  { key: 'chat', label: 'Chat CSKH', icon: sidebarIcon('<path d="M7 18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6l-4 3v-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>') }
]
const kenoTabKeys = ['set-keo-1', 'set-keo-3', 'set-keo-5']
const kenoGroupIcon = sidebarIcon('<rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>')

const loadingAll = ref(false)
const loadError = ref('')
const ADMIN_TAB_STORAGE_KEY = 'admin_active_tab'
const activeTab = ref('dashboard')
const kenoMenuOpen = ref(false)
const adminNavOpenGroups = reactive({
  overview: true,
  players: true,
  transactions: true,
  games: true,
  support: true,
  system: true
})
const selectedUser = ref(null)
const selectedUserChangeLogs = ref([])
const selectedUserProfileForm = reactive({
  fullName: '',
  phone: '',
  displayName: '',
  characterName: '',
  referredByCode: '',
  inviteCode: ''
})
const selectedUserBankForm = reactive({
  bankName: '',
  bankAccount: '',
  accountName: ''
})
const selectedUserSecurityForm = reactive({
  password: '',
  withdrawPassword: ''
})
const selectedUserPasswordVault = reactive({
  loaded: false,
  loading: false,
  password: '',
  withdrawPassword: '',
  message: ''
})
const selectedUserPasswordVisible = reactive({
  password: false,
  withdrawPassword: false
})
const selectedUserHistoryFilters = reactive({
  mode: 'all',
  from: '',
  to: '',
  limit: 200
})
const selectedUserHistory = reactive({
  loading: false,
  error: '',
  total: 0,
  items: []
})
const savingSelectedUserProfile = ref(false)
const savingSelectedUserBank = ref(false)
const savingSelectedUserSecurity = ref(false)
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
const ADMIN_PAGE_SIZE = 20
function createPagingState() {
  return { page: 1, limit: ADMIN_PAGE_SIZE, total: 0, pages: 1, loading: false }
}
const inviteSavingState = reactive({})
const adminActionSavingState = reactive({})
const adminPasswordDrafts = reactive({})
const userRowSavingState = reactive({})
const userRowDrafts = reactive({})
const forcedResultForm = reactive({ d1: '', d2: '', d3: '', forcedNote: '' })
const newAdminForm = reactive({ username: '', password: '', fullName: '', phone: '' })

const toast = reactive({ message: '', type: 'success' })
let toastTimer = null
let userSearchDebounceTimer = null
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
  minBet: 1000, maxBet: 0, chipOptions: [], odds: { tai: 1.98, xiu: 1.98, odd: 1.98, even: 1.98 }
})

const users = ref([])
const transactions = ref([])
const depositTransactions = ref([])
const withdrawTransactions = ref([])
const gameHistory = ref([])
const recentGameHistory = ref([])
const roundHistory = ref([])
const gameSummary = ref([])
const inviteCodes = ref([])
const oddsRooms = ref([])
const adminUsers = ref([])
const chatRooms = ref([])
const chatMessages = ref([])
const adminChatRef = ref(null)
const userPaging = reactive(createPagingState())
const transactionPaging = reactive({
  all: createPagingState(),
  deposit: createPagingState(),
  withdraw: createPagingState()
})
const gameHistoryPaging = reactive(createPagingState())
const roundHistoryPaging = reactive(createPagingState())
const adminChatInput = ref('')
const sendingAdminChat = ref(false)
const editingAdminMessageId = ref('')
const editingAdminMessageText = ref('')
const savingAdminMessageEdit = ref(false)
const deletingAdminMessageId = ref('')
const adminChatCameraRef = ref(null)
const adminChatGalleryRef = ref(null)
const adminChatFileRef = ref(null)
const activeChatSettingsSection = ref('auto')
const showAdminAttachMenu = ref(false)
const sendingAdminImage = ref(false)
const adminPendingImageFile = ref(null)
const adminPendingImagePreview = ref('')
const adminCustomerTypingActive = ref(false)
const adminShouldStickToBottom = ref(true)
const forceAdminChatScrollOnOwnSend = ref(false)
const adminHasNewMessageBelow = ref(false)
const chatImagePreviewUrl = ref('')
const selectedChatUser = ref(null)
const chatProfileForm = reactive({ displayName: '', characterName: '', chatTag: '' })
let adminTypingTimer = null
let lastAdminTypingState = false
let adminCustomerTypingTimer = null
const savingChatProfile = ref(false)
const chatSettingsForm = reactive({
  supportWelcomeMessage: '',
  supportWelcomeAttachmentType: 'vip',
  supportWelcomeAttachmentUrl: '',
  supportAutoReplyMessage: '',
  supportAutoReplyAttachmentType: 'none',
  supportAutoReplyAttachmentUrl: '',
  supportAwayEnabled: false,
  supportNotifySound: 'messenger',
  supportNotifyVolume: 220,
  supportAwayMessage: '',
  supportAwayAttachmentType: 'none',
  supportAwayAttachmentUrl: '',
  supportQuickReplyOneLabel: '',
  supportQuickReplyOne: '',
  supportQuickReplyOneAttachmentType: 'none',
  supportQuickReplyOneAttachmentUrl: '',
  supportQuickReplyTwoLabel: '',
  supportQuickReplyTwo: '',
  supportQuickReplyTwoAttachmentType: 'none',
  supportQuickReplyTwoAttachmentUrl: '',
  supportQuickReplyThreeLabel: '',
  supportQuickReplyThree: '',
  supportQuickReplyThreeAttachmentType: 'none',
  supportQuickReplyThreeAttachmentUrl: '',
  supportQuickReplyFourLabel: '',
  supportQuickReplyFour: '',
  supportQuickReplyFourAttachmentType: 'none',
  supportQuickReplyFourAttachmentUrl: '',
  supportQuickReplyFiveLabel: '',
  supportQuickReplyFive: '',
  supportQuickReplyFiveAttachmentType: 'none',
  supportQuickReplyFiveAttachmentUrl: '',
  supportQuickReplyVipLabel: '',
  supportQuickReplyVipAttachmentType: 'vip',
  supportQuickReplyVipAttachmentUrl: ''
})
const savingChatSettings = ref(false)
const showChatCustomerPanel = ref(false)
const showChatSettingsModal = ref(false)
const activeQuickReplyKey = ref('one')
const chatRoomFilter = ref('all')
const chatInboxFilter = ref('all')
const unreadByRoom = reactive({})
const chatStats = reactive({ todayMessages: 0, pendingRooms: 0 })
const kenoForceInput = ref('')
const kenoRoundLabel = computed(() => Math.floor(Date.now() / 60000))
const currentBets5p = ref([])
const forced5p = reactive({ d1: '', d2: '', d3: '' })
const sicbo5pControl = reactive({ roomId:'sicbo-5p', roundId:'--', timeLeft:0, bettingOpen:false, forcedResult:null })
const depositSearchKeyword = ref('')
const withdrawSearchKeyword = ref('')
const liveBetSearchKeyword = ref('')
const liveRoomId = ref('sicbo-5p')
const liveBetsFeed = reactive({
  roomId: 'sicbo-5p',
  rooms: [],
  state: null,
  currentBets: [],
  recentBets: [],
  rounds: []
})
const incidentLogs = ref([])
const incidentLoading = ref(false)
const incidentActionLoading = reactive({})
const incidentStats = reactive({
  total: 0,
  last24h: 0,
  open: 0,
  investigating: 0,
  resolved: 0,
  ignored: 0
})
const incidentFilters = reactive({
  status: '',
  source: '',
  level: '',
  keyword: ''
})
const incidentPaging = reactive({
  page: 1,
  limit: 40,
  total: 0,
  pages: 1
})
const incidentStatusOptions = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'open', label: 'Đang mở' },
  { value: 'investigating', label: 'Đang xử lý' },
  { value: 'resolved', label: 'Đã xử lý' },
  { value: 'ignored', label: 'Bỏ qua' }
]
const incidentSourceOptions = [
  { value: '', label: 'Tất cả nguồn lỗi' },
  { value: 'api', label: 'API' },
  { value: 'socket', label: 'Socket' },
  { value: 'upload', label: 'Upload' },
  { value: 'process', label: 'Process' },
  { value: 'system', label: 'System' }
]
const incidentLevelOptions = [
  { value: '', label: 'Tất cả mức độ' },
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' }
]
const systemSoundOptions = [
  { value: 'messenger', label: 'Messenger rõ' },
  { value: 'zalo', label: 'Zalo nhanh' },
  { value: 'telegram', label: 'Telegram sáng' },
  { value: 'iphone', label: 'iPhone ngân' },
  { value: 'android', label: 'Android pop' },
  { value: 'alarm', label: 'Chuông báo mạnh' },
  { value: 'siren', label: 'Cảnh báo siren' },
  { value: 'emergency', label: 'Khẩn cấp 3 nhịp' },
  { value: 'classic', label: 'Chuông cổ điển' },
  { value: 'slack', label: 'Thông báo gọn' }
]
const systemSoundFields = [
  { key: 'systemSoundMessage', label: 'Tin nhắn mới' },
  { key: 'systemSoundDeposit', label: 'Âm thanh nạp tiền' },
  { key: 'systemSoundWithdraw', label: 'Âm thanh rút tiền' },
  { key: 'systemSoundFeedback', label: 'Âm thanh phản hồi' },
  { key: 'systemSoundAlert', label: 'Âm thanh cảnh báo' },
  { key: 'systemSoundSicbo', label: 'Âm thanh game Xúc sắc' }
]

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
    return
  }

  if (tabKey === 'live-bets') {
    socketStore.joinSicboRoom(userStore.user?._id, liveRoomId.value)
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
    await loadRecentGameHistory()
  } catch {
    /* ignore */
  }
}

const siteConfig = reactive({
  oddsDoi:'1.98', oddsXs3p:'1.98', oddsHaiTrung3p:'1.98', oddsBaTrung3p:'1.98', oddsLoiCltx3p:'1.98',
  oddsXs5p:'1.98', oddsHaiTrung5p:'1.98', oddsBaTrung5p:'1.98', oddsLoiCltx5p:'1.98', oddsLoiKeno5p:'2.3',
  referralCode:'', seoTitle:'', seoDescription:'', homeBanner:'CHÀO MỪNG BẠN ĐẾN THE VENETIAN !', siteBrandName:'THE VENETIAN', siteAdminCaption:'admin.casinovenetianmacau.com', siteLogoUrl:'/img/the-venetian-wordmark.svg',
  vipPrivilegeTitle: VIP_PRIVILEGE_DEFAULT_TITLE,
  vipPrivilegeSubtitle: VIP_PRIVILEGE_DEFAULT_SUBTITLE,
  vipPrivilegeRows: cloneVipPrivilegeRows(),
  kenoMaintenanceEnabled:true,
  kenoMaintenanceMessage:'Game KENO đang bảo trì. Vui lòng quay lại sau.',
  sicboMaintenanceEnabled:false,
  sicboMaintenanceMessage:'Game Xúc sắc đang bảo trì. Vui lòng quay lại sau.',
  supportWelcomeMessage:'Xin chào! Chăm sóc khách hàng đã kết nối. Vui lòng để lại nội dung, hệ thống sẽ chuyển ngay cho CSKH.',
  supportWelcomeAttachmentType:'vip',
  supportWelcomeAttachmentUrl:'',
  supportAutoReplyMessage:'Xin chào, CSKH đã nhận được thông báo về phản hồi của bạn, vui lòng chờ một lát để kết nối trực tiếp với nhân viên CSKH hỗ trợ ngay bây giờ.',
  supportAutoReplyAttachmentType:'none',
  supportAutoReplyAttachmentUrl:'',
  supportAwayEnabled:false,
  supportNotifySound:'messenger',
  supportNotifyVolume:'220',
  systemSoundMessage:'messenger',
  systemSoundDeposit:'zalo',
  systemSoundWithdraw:'emergency',
  systemSoundFeedback:'telegram',
  systemSoundAlert:'siren',
  systemSoundSicbo:'classic',
  adminWelcomeVoiceEnabled:true,
  adminWelcomeVoiceText:'Xin chào ông chủ - Chúng ta chuẩn bị ăn to rồi đấy nhé',
  adminWelcomeVoiceVolume:'100',
  supportAwayMessage:'Hiện tại lượng khách truy cập vào CSKH đang rất nhiều. Số thứ tự hỗ trợ của quý khách là #{queueNumber}. Vui lòng chờ trong khoảng {etaMinutes}-{etaMaxMinutes} phút để kết nối trực tiếp với CSKH.',
  supportAwayAttachmentType:'none',
  supportAwayAttachmentUrl:'',
  supportQuickReplyOneLabel:'Đã nhận',
  supportQuickReplyOne:'CSKH đã nhận được tin nhắn của bạn.',
  supportQuickReplyOneAttachmentType:'none',
  supportQuickReplyOneAttachmentUrl:'',
  supportQuickReplyTwoLabel:'Chờ kiểm tra',
  supportQuickReplyTwo:'Vui lòng chờ CSKH kiểm tra trong ít phút.',
  supportQuickReplyTwoAttachmentType:'none',
  supportQuickReplyTwoAttachmentUrl:'',
  supportQuickReplyThreeLabel:'Gửi thông tin',
  supportQuickReplyThree:'Bạn vui lòng gửi hình ảnh hoặc nội dung cụ thể hơn để CSKH hỗ trợ nhanh.',
  supportQuickReplyThreeAttachmentType:'none',
  supportQuickReplyThreeAttachmentUrl:'',
  supportQuickReplyFourLabel:'Đang xử lý',
  supportQuickReplyFour:'CSKH đang theo dõi yêu cầu của bạn. Vui lòng đợi trong giây lát.',
  supportQuickReplyFourAttachmentType:'none',
  supportQuickReplyFourAttachmentUrl:'',
  supportQuickReplyFiveLabel:'Gửi thêm',
  supportQuickReplyFive:'Nếu cần nhanh hơn, vui lòng gửi rõ nội dung, hình ảnh hoặc mã giao dịch.',
  supportQuickReplyFiveAttachmentType:'none',
  supportQuickReplyFiveAttachmentUrl:'',
  supportQuickReplyVipLabel:'Bảng VIP',
  supportQuickReplyVipAttachmentType:'vip',
  supportQuickReplyVipAttachmentUrl:'',
  kenoMaintenanceEnabled:true,
  kenoMaintenanceMessage:'Game KENO đang bảo trì. Vui lòng quay lại sau.'
})
const savingSiteConfig = ref(false)
const savingVipPrivilege = ref(false)
const adminBankForm = reactive({ accountName:'', bankName:'', bankAccount:'', transferNote:'' })
const adminBanks = ref([])
const savingAdminBank = ref(false)

const withdrawRequests = computed(() => withdrawTransactions.value || [])
const depositRequests = computed(() => depositTransactions.value || [])
const usersWithBank = computed(() => users.value.filter(u => u.linkedBank?.bankName))
const mobileChatRooms = ref([])
const mobileChatMessages = ref([])

const filteredDepositRequests = computed(() =>
  depositRequests.value.filter((tx) => matchesRequestSearch(tx, depositSearchKeyword.value))
)
const filteredWithdrawRequests = computed(() =>
  withdrawRequests.value.filter((tx) => matchesRequestSearch(tx, withdrawSearchKeyword.value))
)
const liveRoomCards = computed(() => liveBetsFeed.rooms || [])
const filteredLiveCurrentBets = computed(() =>
  (liveBetsFeed.currentBets || []).filter((bet) => matchesLiveBetSearch(bet, liveBetSearchKeyword.value))
)
const filteredLiveRecentBets = computed(() =>
  (liveBetsFeed.recentBets || []).filter((bet) => matchesLiveBetSearch(bet, liveBetSearchKeyword.value))
)
const liveCurrentBetAmount = computed(() =>
  (liveBetsFeed.currentBets || []).reduce((sum, bet) => sum + Number(bet.amount || 0), 0)
)
const liveCurrentBetUsers = computed(() =>
  new Set((liveBetsFeed.currentBets || []).map((bet) => String(bet.userId?._id || bet.userId || '')))
    .size
)
const liveCurrentBetGateSummary = computed(() => {
  const grouped = new Map()

  for (const bet of liveBetsFeed.currentBets || []) {
    const gate = String(bet.gate || '--')
    grouped.set(gate, Number(grouped.get(gate) || 0) + Number(bet.amount || 0))
  }

  return Array.from(grouped.entries())
    .map(([gate, amount]) => ({ gate, amount }))
    .sort((left, right) => right.amount - left.amount)
})

const currentTabLabel = computed(() => tabs.find(t => t.key === activeTab.value)?.label || 'Dashboard')
const unreadChatCount = computed(() =>
  Object.values(unreadByRoom).reduce((sum, value) => sum + Number(value || 0), 0)
)
const kenoTabs = computed(() => tabs.filter((tab) => kenoTabKeys.includes(tab.key)))
const primaryTabs = computed(() => tabs.filter((tab) => !kenoTabKeys.includes(tab.key)))
const isKenoTabActive = computed(() => kenoTabKeys.includes(activeTab.value))
const showTopbarRefresh = computed(() =>
  [
    'dashboard',
    'game-summary',
    'users',
    'live-bets',
    'withdraw-requests',
    'deposit-requests',
    'game-history',
    'bank-accounts',
    'incidents',
    'chat'
  ].includes(activeTab.value)
)
function getAdminTab(key, fallbackLabel = '') {
  const tab = tabs.find((item) => item.key === key)
  return tab ? { ...tab, label: fallbackLabel || tab.label } : null
}
const adminNavGroups = computed(() => {
  const groups = [
    { key: 'overview', label: 'Tổng quan', items: [getAdminTab('dashboard', 'Doanh thu'), getAdminTab('live-bets', 'Đang chơi')] },
    { key: 'players', label: 'Người chơi', items: [getAdminTab('users'), getAdminTab('game-history')] },
    { key: 'transactions', label: 'Giao dịch', items: [getAdminTab('deposit-requests'), getAdminTab('withdraw-requests'), getAdminTab('bank-accounts')] },
    {
      key: 'games',
      label: 'Trò chơi',
      items: [
        getAdminTab('odds-settings', 'Set Kèo Xúc sắc 3p'),
        getAdminTab('odds-5p', 'Set Kèo Xúc sắc 5p'),
        { key: 'keno-group', label: 'SET KÈO KENO', icon: kenoGroupIcon, children: kenoTabs.value }
      ]
    },
    { key: 'support', label: 'CSKH', items: [getAdminTab('chat')] },
    {
      key: 'system',
      label: 'Hệ thống',
      items: [getAdminTab('admins'), getAdminTab('add-staff'), getAdminTab('payout-settings', 'Cài đặt'), getAdminTab('incidents', 'Sự cố hệ thống')]
    }
  ]
  return groups.map((group) => ({
    ...group,
    items: group.items.filter(Boolean)
  }))
})
function isAdminNavItemActive(item) {
  if (!item) return false
  if (item.children) return item.children.some((child) => child.key === activeTab.value)
  return item.key === activeTab.value
}
function isAdminNavGroupActive(group) {
  return group.items.some((item) => isAdminNavItemActive(item))
}
function isAdminNavGroupOpen(group) {
  return Boolean(adminNavOpenGroups[group.key] || isAdminNavGroupActive(group))
}
function toggleAdminNavGroup(key) {
  adminNavOpenGroups[key] = !adminNavOpenGroups[key]
}
const chatSettingsSections = [
  { key: 'auto', label: 'Tin nhắn tự động' },
  { key: 'sound', label: 'Âm báo' },
  { key: 'quick', label: 'Nút gửi nhanh' }
]
const supportSoundOptions = [
  { value: 'messenger', label: '1. Messenger mạnh' },
  { value: 'telegram', label: '2. Telegram' },
  { value: 'zalo', label: '3. Zalo sáng' },
  { value: 'iphone', label: '4. iPhone Tri-tone' },
  { value: 'android', label: '5. Android ping' },
  { value: 'discord', label: '6. Discord' },
  { value: 'slack', label: '7. Slack knock' },
  { value: 'alarm', label: '8. Alarm lớn' },
  { value: 'siren', label: '9. Siren mạnh' },
  { value: 'emergency', label: '10. Khẩn cấp' }
]
const supportAttachmentOptions = [
  { value: 'none', label: 'Không đính kèm' },
  { value: 'image', label: 'Ảnh' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'vip', label: 'Bảng VIP động' }
]
const supportQuickAttachmentOptions = [
  ...supportAttachmentOptions,
  { value: 'url', label: 'Đính kèm URL' },
  { value: 'bank', label: 'Thông tin chuyển khoản' }
]
const supportStickerOptions = [
  { value: '/img/support-stickers/da-nhan.svg', label: 'Sticker Đã nhận' },
  { value: '/img/support-stickers/cho-kiem-tra.svg', label: 'Sticker Chờ kiểm tra' },
  { value: '/img/support-stickers/gui-thong-tin.svg', label: 'Sticker Gửi thông tin' },
  { value: '/img/support-stickers/dang-xu-ly.svg', label: 'Sticker Đang xử lý' },
  { value: '/img/support-stickers/gui-them.svg', label: 'Sticker Gửi thêm' }
]
const chatQuickReplyConfigs = [
  { key: 'one', labelKey: 'supportQuickReplyOneLabel', messageKey: 'supportQuickReplyOne', attachmentTypeKey: 'supportQuickReplyOneAttachmentType', attachmentUrlKey: 'supportQuickReplyOneAttachmentUrl', fallbackLabel: 'Đã nhận' },
  { key: 'two', labelKey: 'supportQuickReplyTwoLabel', messageKey: 'supportQuickReplyTwo', attachmentTypeKey: 'supportQuickReplyTwoAttachmentType', attachmentUrlKey: 'supportQuickReplyTwoAttachmentUrl', fallbackLabel: 'Chờ kiểm tra' },
  { key: 'three', labelKey: 'supportQuickReplyThreeLabel', messageKey: 'supportQuickReplyThree', attachmentTypeKey: 'supportQuickReplyThreeAttachmentType', attachmentUrlKey: 'supportQuickReplyThreeAttachmentUrl', fallbackLabel: 'Gửi thông tin' },
  { key: 'four', labelKey: 'supportQuickReplyFourLabel', messageKey: 'supportQuickReplyFour', attachmentTypeKey: 'supportQuickReplyFourAttachmentType', attachmentUrlKey: 'supportQuickReplyFourAttachmentUrl', fallbackLabel: 'Đang xử lý' },
  { key: 'five', labelKey: 'supportQuickReplyFiveLabel', messageKey: 'supportQuickReplyFive', attachmentTypeKey: 'supportQuickReplyFiveAttachmentType', attachmentUrlKey: 'supportQuickReplyFiveAttachmentUrl', fallbackLabel: 'Gửi thêm' },
  { key: 'vip', labelKey: 'supportQuickReplyVipLabel', messageKey: null, attachmentTypeKey: 'supportQuickReplyVipAttachmentType', attachmentUrlKey: 'supportQuickReplyVipAttachmentUrl', fallbackLabel: 'Bảng VIP', defaultMessage: 'Bảng thưởng nạp VIP mới nhất.' }
]
const quickReplyButtons = computed(() =>
  chatQuickReplyConfigs
    .map((item) => ({
      key: item.key,
      label: String(siteConfig[item.labelKey] ?? item.fallbackLabel).trim(),
      message: String(item.messageKey ? (siteConfig[item.messageKey] ?? '') : (item.defaultMessage || '')).trim(),
      attachmentType: String(siteConfig[item.attachmentTypeKey] || 'none').trim(),
      attachmentUrl: String(siteConfig[item.attachmentUrlKey] || '').trim()
    }))
    .filter((item) => item.label && (item.message || item.attachmentType !== 'none' || item.attachmentUrl))
)
const editableQuickReplyButtons = computed(() =>
  chatQuickReplyConfigs.map((item) => {
    const label = String(chatSettingsForm[item.labelKey] ?? '').trim()
    const message = String(item.messageKey ? (chatSettingsForm[item.messageKey] ?? '') : (item.defaultMessage || '')).trim()
    const attachmentType = String(chatSettingsForm[item.attachmentTypeKey] || 'none').trim()
    const attachmentUrl = String(chatSettingsForm[item.attachmentUrlKey] || '').trim()
    return {
      ...item,
      label,
      message,
      attachmentType,
      attachmentUrl,
      enabled: Boolean(label && (message || attachmentType !== 'none' || attachmentUrl))
    }
  })
)
const activeQuickReplyConfig = computed(() =>
  chatQuickReplyConfigs.find((item) => item.key === activeQuickReplyKey.value) || chatQuickReplyConfigs[0] || null
)

const chatTagOptions = [
  { key: 'moi_ngon', label: 'Mồi ngon', color: 'red' },
  { key: 'cho_lam_thit', label: 'Chờ làm thịt', color: 'green' },
  { key: 'da_thit_xong_7_mon', label: 'Đã thịt xong 7 món', color: 'yellow' }
]

const filteredChatRooms = computed(() => {
  return chatRooms.value.filter((room) => {
    const matchTag =
      chatRoomFilter.value === 'all' || String(room.user?.chatTag || '') === chatRoomFilter.value

    if (!matchTag) return false

    if (chatInboxFilter.value === 'pending') {
      return Boolean(room.needsReply)
    }

    if (chatInboxFilter.value === 'today') {
      return isSameVietnamDay(room.updatedAt)
    }

    return true
  })
})

const chatTagFilters = computed(() => {
  const counts = Object.fromEntries(chatTagOptions.map((option) => [option.key, 0]))

  for (const room of chatRooms.value) {
    const key = String(room.user?.chatTag || '')
    if (counts[key] !== undefined) {
      counts[key] += 1
    }
  }

  return [
    { key: 'all', label: 'Tất cả', color: 'default', count: chatRooms.value.length },
    ...chatTagOptions.map((option) => ({
      ...option,
      count: counts[option.key] || 0
    }))
  ]
})

const filteredUsers = computed(() => users.value || [])

function getUserDraft(userId) {
  const key = String(userId || '')
  if (!key) return { adjustAmount: '', vipLevel: '' }
  if (!userRowDrafts[key]) {
    userRowDrafts[key] = { adjustAmount: '', vipLevel: '' }
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

const siteBrandDisplayName = computed(() => String(siteConfig.siteBrandName || 'THE VENETIAN').trim() || 'THE VENETIAN')
const siteAdminCaptionDisplay = computed(() => String(siteConfig.siteAdminCaption || 'admin.casinovenetianmacau.com').trim() || 'admin.casinovenetianmacau.com')
const resolvedSiteLogoSrc = computed(() => resolveImageSrc(String(siteConfig.siteLogoUrl || '/img/the-venetian-wordmark.svg').trim() || '/img/the-venetian-wordmark.svg'))

const revenueOverviewMetrics = computed(() => {
  const raw = [
    { key: 'deposit', label: 'Tổng nạp', value: Number(revenue.totalDeposit || 0), tone: 'teal' },
    { key: 'withdraw', label: 'Tổng rút', value: Number(revenue.totalWithdraw || 0), tone: 'red' },
    { key: 'bet', label: 'Tổng cược', value: Number(revenue.totalBetAmount || 0), tone: 'blue' },
    { key: 'payout', label: 'Trả thưởng', value: Number(revenue.totalPayout || 0), tone: 'gold' },
    { key: 'net', label: 'Doanh thu game', value: Number(revenue.netGamingRevenue || 0), tone: 'purple' }
  ]
  const maxValue = Math.max(...raw.map((item) => item.value), 1)
  return raw.map((item) => ({
    ...item,
    percent: Math.max(8, Math.round((item.value / maxValue) * 100)),
    display: formatMoney(item.value)
  }))
})

const revenueDonutSegments = computed(() => {
  const source = [
    { key: 'deposit', label: 'Tổng nạp', value: Number(revenue.totalDeposit || 0), tone: 'teal' },
    { key: 'withdraw', label: 'Tổng rút', value: Number(revenue.totalWithdraw || 0), tone: 'red' },
    { key: 'net', label: 'Doanh thu game', value: Number(revenue.netGamingRevenue || 0), tone: 'purple' }
  ]
  const total = source.reduce((sum, item) => sum + item.value, 0) || 1
  const circumference = 2 * Math.PI * 72
  let offset = 0
  return source.map((item) => {
    const length = (item.value / total) * circumference
    const segment = {
      ...item,
      display: formatMoney(item.value),
      dasharray: `${length} ${circumference - length}`,
      dashoffset: `${-offset}`
    }
    offset += length
    return segment
  })
})

const authJsonHeaders = computed(() => ({ 'Content-Type': 'application/json', ...userStore.authHeaders }))

function handleLogout() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ADMIN_TAB_STORAGE_KEY)
  }
  userStore.logout()
  router.push('/admin/login')
}

function formatMoney(v) {
  return `${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v || 0))}$`
}
function formatDate(v) { return formatDateTimeVN(v) }
function formatRelativeAccess(value) {
  if (!value) return '--'
  const diffMs = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return formatDate(value)
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ngày trước`
  return formatDate(value)
}
function formatCountdown(v) { const s = Math.max(Number(v||0),0); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }
function formatRequestStatus(tx) {
  if (!tx) return '--'
  if (tx.status === 'pending') return 'Chờ xử lý'
  if (tx.status === 'approved' || tx.status === 'completed' || tx.type === 'deposit' || tx.type === 'withdraw') return 'Thành công'
  if (tx.status === 'rejected' || String(tx.type || '').endsWith('_rejected')) return 'Từ chối'
  return String(tx.status || '--')
}
function requestStatusClass(tx) {
  if (!tx) return 'badge--info'
  if (tx.status === 'pending') return 'badge--warning'
  if (tx.status === 'approved' || tx.status === 'completed' || tx.type === 'deposit' || tx.type === 'withdraw') return 'badge--success'
  if (tx.status === 'rejected' || String(tx.type || '').endsWith('_rejected')) return 'badge--danger'
  return 'badge--info'
}
function incidentStatusLabel(status) {
  const map = {
    open: 'Đang mở',
    investigating: 'Đang xử lý',
    resolved: 'Đã xử lý',
    ignored: 'Bỏ qua'
  }
  return map[String(status || '').toLowerCase()] || 'Không rõ'
}
function incidentStatusClass(status) {
  const key = String(status || '').toLowerCase()
  if (key === 'open') return 'badge--danger'
  if (key === 'investigating') return 'badge--warning'
  if (key === 'resolved') return 'badge--success'
  return 'badge--info'
}
function incidentSourceLabel(source) {
  const map = {
    api: 'API',
    socket: 'Socket',
    upload: 'Upload',
    process: 'Process',
    system: 'System'
  }
  return map[String(source || '').toLowerCase()] || 'Khác'
}
function incidentLevelLabel(level) {
  const map = {
    error: 'Error',
    warn: 'Warning',
    info: 'Info'
  }
  return map[String(level || '').toLowerCase()] || 'Unknown'
}
function incidentLevelClass(level) {
  const key = String(level || '').toLowerCase()
  if (key === 'error') return 'badge--danger'
  if (key === 'warn') return 'badge--warning'
  return 'badge--info'
}
function buildDepositPaymentInfo(tx) {
  const meta = tx?.meta || {}
  return {
    bank: meta.receiverBankName || meta.bankCode || '--',
    accountName: meta.receiverAccountName || '',
    accountNumber: meta.receiverBankAccount || '',
    note: meta.receiverTransferNote || meta.transferContent || ''
  }
}
function buildWithdrawPaymentInfo(tx) {
  const meta = tx?.meta || {}
  return {
    bank: meta.bankName || '--',
    accountName: meta.accountName || '',
    accountNumber: meta.bankAccount || ''
  }
}
function buildPendingPaymentInfo(tx) {
  if (String(tx?.type || '').startsWith('withdraw')) {
    return buildWithdrawPaymentInfo(tx)
  }
  return buildDepositPaymentInfo(tx)
}
function matchesRequestSearch(tx, keyword) {
  const kw = String(keyword || '').trim().toLowerCase()
  if (!kw) return true
  const fields = [
    tx.userId?.username,
    tx.userId?.userCode,
    tx.userId?.fullName,
    tx.meta?.bankCode,
    tx.meta?.transferContent,
    tx.meta?.receiverBankName,
    tx.meta?.receiverAccountName,
    tx.meta?.receiverBankAccount,
    tx.meta?.bankName,
    tx.meta?.bankAccount,
    tx.meta?.accountName,
    tx.amount,
    formatRequestStatus(tx)
  ]
  return fields.some((value) => String(value || '').toLowerCase().includes(kw))
}
function matchesLiveBetSearch(bet, keyword) {
  const kw = String(keyword || '').trim().toLowerCase()
  if (!kw) return true
  return [
    bet.userId?.username,
    bet.userId?.userCode,
    bet.userId?.fullName,
    bet.roundId,
    bet.roomId,
    formatGateLabel(bet.gate),
    bet.amount
  ].some((value) => String(value || '').toLowerCase().includes(kw))
}
function formatChatTag(tag) {
  return chatTagOptions.find((option) => option.key === tag)?.label || 'Chưa gắn nhãn'
}
function chatTagClass(tag) {
  const color = chatTagOptions.find((option) => option.key === tag)?.color || 'default'
  return `chat-tag-pill--${color}`
}
function normalizeAdminTab(tabKey) {
  const raw = String(tabKey || '').trim()
  if (raw === 'vip-privilege-settings') return 'payout-settings'
  return raw
}
function isValidAdminTab(tabKey) {
  const normalized = normalizeAdminTab(tabKey)
  return tabs.some((tab) => tab.key === normalized)
}
function persistActiveTab(tabKey) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, normalizeAdminTab(tabKey))
}
function replaceTabQuery(tabKey) {
  const normalized = normalizeAdminTab(tabKey)
  const currentTab = normalizeAdminTab(typeof route.query.tab === 'string' ? route.query.tab : '')
  if (currentTab === normalized) return
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      tab: normalized
    }
  })
}
function setActiveTab(tabKey) {
  const normalized = normalizeAdminTab(tabKey)
  const nextTab = isValidAdminTab(normalized) ? normalized : 'dashboard'
  activeTab.value = nextTab
  kenoMenuOpen.value = kenoTabKeys.includes(nextTab)
  persistActiveTab(nextTab)
  replaceTabQuery(nextTab)
}
function syncActiveTabFromRoute() {
  const routeTab = normalizeAdminTab(typeof route.query.tab === 'string' ? route.query.tab : '')
  if (isValidAdminTab(routeTab)) {
    activeTab.value = routeTab
    kenoMenuOpen.value = kenoTabKeys.includes(routeTab)
    persistActiveTab(routeTab)
    return
  }

  if (typeof window !== 'undefined') {
    const storedTab = normalizeAdminTab(String(window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY) || ''))
    if (isValidAdminTab(storedTab)) {
      activeTab.value = storedTab
      kenoMenuOpen.value = kenoTabKeys.includes(storedTab)
      replaceTabQuery(storedTab)
      return
    }
  }

  activeTab.value = 'dashboard'
  kenoMenuOpen.value = false
  replaceTabQuery('dashboard')
}
function resolveImageSrc(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${String(API_BASE_URL || '').replace(/\/+$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function resolveFileSrc(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `${String(API_BASE_URL || '').replace(/\/+$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`
}

function getChatFileName(msg) {
  const explicitName = String(msg?.fileName || '').trim()
  if (explicitName) return explicitName
  const fallbackText = String(msg?.content || '').trim()
  if (fallbackText) return fallbackText
  const fileUrl = String(msg?.fileUrl || '').trim()
  if (!fileUrl) return 'Tệp đính kèm'
  try {
    const pathPart = fileUrl.split('?')[0].split('#')[0]
    const name = decodeURIComponent(pathPart.split('/').pop() || '').trim()
    return name || 'Tệp đính kèm'
  } catch {
    return 'Tệp đính kèm'
  }
}

function formatFileSize(size) {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value < 1024) return `${value} B`
  const kiloBytes = value / 1024
  if (kiloBytes < 1024) return `${kiloBytes.toFixed(kiloBytes < 10 ? 1 : 0)} KB`
  const megaBytes = kiloBytes / 1024
  if (megaBytes < 1024) return `${megaBytes.toFixed(megaBytes < 10 ? 1 : 0)} MB`
  const gigaBytes = megaBytes / 1024
  return `${gigaBytes.toFixed(gigaBytes < 10 ? 1 : 0)} GB`
}

const CHAT_QR_BANK_ALIASES = [
  { code: '970418', label: 'BIDV', aliases: ['bidv', 'bankdautuvaphattrien', 'dautuvaphattrien'] },
  { code: '970407', label: 'Techcombank', aliases: ['techcombank', 'tcb', 'techcom'] },
  { code: '970436', label: 'Vietcombank', aliases: ['vietcombank', 'vcb', 'vietcom'] },
  { code: '970415', label: 'VietinBank', aliases: ['vietinbank', 'vietin', 'ctg'] },
  { code: '970405', label: 'Agribank', aliases: ['agribank', 'agri'] },
  { code: '970422', label: 'MB Bank', aliases: ['mbbank', 'mb', 'mbb'] },
  { code: '970416', label: 'ACB', aliases: ['acb'] },
  { code: '970423', label: 'TPBank', aliases: ['tpbank', 'tpb'] },
  { code: '970403', label: 'Sacombank', aliases: ['sacombank', 'stb', 'sacom'] },
  { code: '970432', label: 'VPBank', aliases: ['vpbank', 'vpb'] },
  { code: '970437', label: 'HDBank', aliases: ['hdbank', 'hdb'] },
  { code: '970440', label: 'SeABank', aliases: ['seabank', 'sea'] },
  { code: '970443', label: 'SHB', aliases: ['shb'] },
  { code: '970448', label: 'OCB', aliases: ['ocb'] },
  { code: '970431', label: 'Eximbank', aliases: ['eximbank', 'eib', 'exim'] },
  { code: '970426', label: 'MSB', aliases: ['msb', 'maritimebank', 'maritime'] },
  { code: '970428', label: 'Nam A Bank', aliases: ['namabank', 'nama'] }
]

function normalizeChatQrKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function extractChatQrData(content) {
  const text = String(content || '').trim()
  if (!text) return null
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return null
  const normalizedText = normalizeChatQrKey(text)

  let bankLabel = ''
  let bankCode = ''
  let accountNumber = ''
  let accountName = ''
  let amount = ''
  let addInfo = ''

  for (const line of lines) {
    const parts = line.split(/\s*[:\-]\s*/, 2)
    const rawLabel = parts.length > 1 ? parts[0] : ''
    const rawValue = parts.length > 1 ? parts[1] : line
    const key = normalizeChatQrKey(rawLabel)
    const value = String(rawValue || '').trim()
    if (!value) continue
    if (!bankLabel && /(nganhang|bank)/.test(key)) bankLabel = value
    else if (!accountNumber && /(sotaikhoan|stk|accountnumber|taikhoan)/.test(key)) accountNumber = value.replace(/[^\d]/g, '')
    else if (!accountName && /(chutaikhoan|tentk|accountname|tenchutk)/.test(key)) accountName = value
    else if (!amount && /(sotien|amount)/.test(key)) amount = value.replace(/[^\d]/g, '')
    else if (!addInfo && /(noidung|nd|addinfo|message)/.test(key)) addInfo = value
  }

  const matchedBank = CHAT_QR_BANK_ALIASES.find((bank) =>
    bank.aliases.some((alias) => normalizedText.includes(alias))
  )

  if (!bankLabel && matchedBank) {
    bankLabel = matchedBank.label
  }
  if (matchedBank) bankCode = matchedBank.code

  if (!accountNumber) {
    const matchedAccount = text.match(/(?:stk|sotk|sotaikhoan|taikhoan)?\s*[:\-]?\s*(\d{8,19})/i)
    if (matchedAccount?.[1]) accountNumber = matchedAccount[1]
  }

  if (!bankCode || !accountNumber) return null

  return { bankCode, bankLabel: bankLabel || matchedBank?.label || '', accountNumber, accountName, amount, addInfo }
}

function buildChatQrUrl(qrData) {
  if (!qrData?.bankCode || !qrData?.accountNumber) return ''
  const params = new URLSearchParams()
  if (qrData.amount) params.set('amount', qrData.amount)
  if (qrData.addInfo) params.set('addInfo', qrData.addInfo)
  if (qrData.accountName) params.set('accountName', qrData.accountName)
  const query = params.toString()
  return `https://img.vietqr.io/image/${qrData.bankCode}-${qrData.accountNumber}-compact2.png${query ? `?${query}` : ''}`
}

function isAdminChatNearBottom() {
  const el = adminChatRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 110
}
function handleAdminChatScroll() {
  adminShouldStickToBottom.value = isAdminChatNearBottom()
  if (adminShouldStickToBottom.value) {
    adminHasNewMessageBelow.value = false
  }
}
function scrollAdminChatToBottom() {
  if (!adminChatRef.value) return
  adminChatRef.value.scrollTop = adminChatRef.value.scrollHeight
  adminShouldStickToBottom.value = true
  adminHasNewMessageBelow.value = false
}
function jumpAdminChatToLatest() {
  nextTick(() => {
    scrollAdminChatToBottom()
  })
}
function formatChatSender(msg) {
  if (msg?.senderRole === 'user') {
    return msg?.senderName || selectedChatUser.value?.displayName || selectedChatUser.value?.username || 'Khách hàng'
  }

  if (msg?.senderRole === 'system') {
    return 'CSKH tự động'
  }

  return msg?.senderName || 'Chăm sóc khách hàng'
}
function canAdminManageChatMessage(msg) {
  return Boolean(msg?._id && msg.senderRole === 'admin' && !msg.deletedAt && !msg.isDeleted)
}
function adminChatDeliveryLabel(msg) {
  if (msg?.deletedAt || msg?.isDeleted) return 'Đã thu hồi'
  return msg?.seenByUserAt || msg?.messageStatus === 'seen' ? 'Đã xem' : 'Đã gửi'
}
function mergeAdminChatMessage(message) {
  if (!message?._id) return
  const index = chatMessages.value.findIndex((item) => String(item._id) === String(message._id))
  if (index >= 0) {
    chatMessages.value[index] = { ...chatMessages.value[index], ...message }
  } else if (message.roomId === selectedRoomId.value) {
    chatMessages.value.push(message)
  }
}
function onAdminChatMessageUpdate(msg) {
  mergeAdminChatMessage(msg)
}
function onAdminChatSeenUpdate(payload) {
  const roomId = String(payload?.roomId || '')
  const seenAt = payload?.seenAt || new Date().toISOString()
  if (roomId !== selectedRoomId.value) return
  chatMessages.value = chatMessages.value.map((message) => {
    if (message.senderRole !== 'admin' || message.seenByUserAt || message.deletedAt || message.isDeleted) return message
    return { ...message, seenByUserAt: seenAt, messageStatus: 'seen' }
  })
}
function startEditAdminChatMessage(msg) {
  if (!canAdminManageChatMessage(msg)) return
  editingAdminMessageId.value = String(msg._id)
  editingAdminMessageText.value = String(msg.content || '')
}
function cancelEditAdminChatMessage() {
  editingAdminMessageId.value = ''
  editingAdminMessageText.value = ''
}
function saveEditAdminChatMessage(msg) {
  if (!canAdminManageChatMessage(msg) || savingAdminMessageEdit.value) return
  const content = String(editingAdminMessageText.value || '').trim()
  if (!content) {
    showToast('Nội dung chỉnh sửa không được trống', 'error')
    return
  }

  savingAdminMessageEdit.value = true
  const socket = socketStore.connect()
  socket.emit('edit_chat_message', { messageId: msg._id, content, token: userStore.token }, (response) => {
    savingAdminMessageEdit.value = false
    if (!response?.ok) {
      showToast(response?.message || 'Không thể sửa tin nhắn', 'error')
      return
    }
    if (response.message) mergeAdminChatMessage(response.message)
    cancelEditAdminChatMessage()
    showToast('Đã sửa tin nhắn')
  })
}
function deleteAdminChatMessage(msg) {
  if (!canAdminManageChatMessage(msg) || deletingAdminMessageId.value) return
  const confirmed = typeof window === 'undefined' ? true : window.confirm('Xóa tin nhắn này ở cả hai phía?')
  if (!confirmed) return

  deletingAdminMessageId.value = String(msg._id)
  const socket = socketStore.connect()
  socket.emit('delete_chat_message', { messageId: msg._id, token: userStore.token }, (response) => {
    deletingAdminMessageId.value = ''
    if (!response?.ok) {
      showToast(response?.message || 'Không thể xóa tin nhắn', 'error')
      return
    }
    if (response.message) mergeAdminChatMessage(response.message)
    if (editingAdminMessageId.value === String(msg._id)) cancelEditAdminChatMessage()
    showToast('Đã thu hồi tin nhắn')
  })
}
function appendAdminEmoji(emoji) {
  if (!emoji) return
  adminChatInput.value = `${adminChatInput.value || ''}${emoji}`
}
function selectChatRoom(roomId) {
  stopAdminChatTypingBroadcast()
  clearAdminCustomerTyping()
  selectedRoomId.value = roomId
  showChatCustomerPanel.value = false
  if (roomId) unreadByRoom[roomId] = 0
}
function goToGame() {
  router.push('/')
}

let activeSupportSoundTimeout = null
let activeSupportAudioContext = null

function stopSupportNotifyPreview() {
  if (activeSupportSoundTimeout) {
    clearTimeout(activeSupportSoundTimeout)
    activeSupportSoundTimeout = null
  }
  if (activeSupportAudioContext) {
    activeSupportAudioContext.close().catch(() => {})
    activeSupportAudioContext = null
  }
}

function playSupportNotifyPattern(soundType, volume) {
  if (typeof window === 'undefined') return
  const AudioContextRef = window.AudioContext || window.webkitAudioContext
  if (!AudioContextRef) return

  try {
    stopSupportNotifyPreview()
    const context = new AudioContextRef()
    activeSupportAudioContext = context
    const master = context.createGain()
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 24
    compressor.ratio.value = 10
    compressor.attack.value = 0.003
    compressor.release.value = 0.18
    master.gain.value = 0.48 * volume
    master.connect(compressor)
    compressor.connect(context.destination)

    const playBeep = (freq, startOffset, duration, type = 'triangle', peak = 1.95) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, context.currentTime + startOffset)
      gain.gain.exponentialRampToValueAtTime(peak, context.currentTime + startOffset + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + startOffset + duration)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(context.currentTime + startOffset)
      oscillator.stop(context.currentTime + startOffset + duration)
    }

    const patterns = {
      classic: [
        [988, 0.00, 0.12, 'triangle', 2.0],
        [1046, 0.18, 0.12, 'triangle', 2.0],
        [1174, 0.36, 0.14, 'triangle', 2.05]
      ],
      alarm: [
        [820, 0.00, 0.14, 'square', 2.2],
        [1140, 0.18, 0.14, 'square', 2.25],
        [1520, 0.36, 0.18, 'triangle', 2.3]
      ],
      messenger: [
        [980, 0.00, 0.11, 'triangle', 2.15],
        [1288, 0.13, 0.11, 'triangle', 2.1],
        [1468, 0.28, 0.16, 'triangle', 2.2]
      ],
      telegram: [
        [1046, 0.00, 0.10, 'triangle', 2.05],
        [1568, 0.14, 0.10, 'triangle', 2.05],
        [1760, 0.28, 0.14, 'triangle', 2.1]
      ],
      zalo: [
        [1174, 0.00, 0.10, 'sine', 2.0],
        [1396, 0.12, 0.10, 'sine', 2.0],
        [1760, 0.26, 0.16, 'triangle', 2.1]
      ],
      iphone: [
        [1318, 0.00, 0.12, 'triangle', 2.1],
        [1660, 0.16, 0.12, 'triangle', 2.1],
        [1976, 0.34, 0.16, 'triangle', 2.15]
      ],
      android: [
        [880, 0.00, 0.09, 'triangle', 2.0],
        [1174, 0.12, 0.10, 'triangle', 2.05],
        [1568, 0.26, 0.16, 'triangle', 2.12]
      ],
      discord: [
        [784, 0.00, 0.11, 'square', 2.12],
        [1174, 0.14, 0.11, 'square', 2.12],
        [1568, 0.30, 0.17, 'triangle', 2.18]
      ],
      slack: [
        [932, 0.00, 0.09, 'triangle', 2.08],
        [932, 0.12, 0.09, 'triangle', 2.08],
        [1396, 0.28, 0.15, 'triangle', 2.15]
      ],
      siren: [
        [988, 0.00, 0.14, 'sawtooth', 2.24],
        [1420, 0.17, 0.14, 'sawtooth', 2.3],
        [988, 0.34, 0.18, 'sawtooth', 2.32]
      ],
      emergency: [
        [760, 0.00, 0.14, 'square', 2.28],
        [760, 0.18, 0.14, 'square', 2.28],
        [1520, 0.38, 0.20, 'sawtooth', 2.36]
      ]
    }

    const sequence = patterns[soundType] || patterns.alarm
    const playSequence = (offset = 0) => {
      sequence.forEach(([freq, start, duration, type, peak]) => {
        playBeep(freq, offset + start, duration, type, peak)
      })
    }

    playSequence(0)
    playSequence(0.72)
    playSequence(1.44)

    activeSupportSoundTimeout = setTimeout(() => {
      context.close().catch(() => {})
      if (activeSupportAudioContext === context) activeSupportAudioContext = null
      activeSupportSoundTimeout = null
    }, 2900)
  } catch {
    /* ignore audio errors */
  }
}

function playAdminChatTone() {
  const soundType = String(siteConfig.systemSoundMessage || siteConfig.supportNotifySound || 'messenger')
  const volume = Math.min(Math.max(Number(siteConfig.supportNotifyVolume || 220) / 100, 0.8), 3.2)
  playSupportNotifyPattern(soundType, volume)
}

function previewSupportNotifySound() {
  const soundType = String(chatSettingsForm.supportNotifySound || 'messenger')
  const volume = Math.min(Math.max(Number(chatSettingsForm.supportNotifyVolume || 220) / 100, 0.8), 3.2)
  playSupportNotifyPattern(soundType, volume)
}

function previewConfiguredSystemSound(configKey) {
  const soundType = String(siteConfig[configKey] || 'messenger')
  playSupportNotifyPattern(soundType, 2.6)
}

function speakAdminWelcomeVoice(options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (options.preview) showToast('Trình duyệt không hỗ trợ AI Voice', 'error')
    return
  }

  const text = String(siteConfig.adminWelcomeVoiceText || '').trim()
  if (!text) return
  if (!options.preview && !siteConfig.adminWelcomeVoiceEnabled) return

  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices?.() || []
    const vietnameseVoice = voices.find((voice) => /vi|vietnam/i.test(`${voice.lang} ${voice.name}`))
      || voices.find((voice) => /google/i.test(voice.name))
    if (vietnameseVoice) utterance.voice = vietnameseVoice
    utterance.lang = vietnameseVoice?.lang || 'vi-VN'
    utterance.rate = 0.95
    utterance.pitch = 0.92
    utterance.volume = Math.min(Math.max(Number(siteConfig.adminWelcomeVoiceVolume || 100) / 100, 0.2), 1)
    window.speechSynthesis.speak(utterance)
  } catch {
    if (options.preview) showToast('Không thể phát lời chào admin', 'error')
  }
}

function previewAdminWelcomeVoice() {
  speakAdminWelcomeVoice({ preview: true })
}

function maybePlayAdminWelcomeVoice() {
  if (typeof window === 'undefined' || !siteConfig.adminWelcomeVoiceEnabled) return
  const adminId = String(userStore.user?._id || userStore.user?.username || 'admin')
  const storageKey = `admin_welcome_voice_played_${adminId}`
  try {
    if (window.sessionStorage.getItem(storageKey)) return
    window.sessionStorage.setItem(storageKey, '1')
  } catch {
    /* ignore storage errors */
  }
  window.setTimeout(() => speakAdminWelcomeVoice(), 700)
}

function notifyAdminBrowser(payload) {
  if (typeof window === 'undefined') return
  if (document.visibilityState === 'visible') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const room = chatRooms.value.find((item) => item.roomId === payload?.roomId)
  const title = room?.title || 'CSKH'
  const body = payload?.messageType === 'image'
    ? 'Khách hàng vừa gửi 1 ảnh.'
    : payload?.messageType === 'file'
      ? 'Khách hàng vừa gửi 1 tệp.'
      : String(payload?.content || 'Có tin nhắn mới từ khách hàng.').slice(0, 120)

  try {
    new Notification(title, { body })
  } catch {
    /* ignore notification errors */
  }
}

function updateChatRoomPreview(roomId, message) {
  if (!roomId) return
  const index = chatRooms.value.findIndex((item) => item.roomId === roomId)
  if (index === -1) return

  const current = chatRooms.value[index]
  const preview = message?.messageType === 'image'
    ? '[Ảnh]'
    : message?.messageType === 'file'
      ? `[Tệp] ${String(message?.fileName || message?.content || '').trim()}`
      : String(message?.content || '').trim()
  const senderLabel = message?.senderRole === 'user'
    ? (message?.senderName || 'Khách')
    : 'CSKH'

  const next = {
    ...current,
    lastMessage: `${senderLabel}: ${preview}`.slice(0, 120),
    updatedAt: message?.createdAt || new Date().toISOString(),
    needsReply: message?.senderRole === 'user'
  }

  chatRooms.value.splice(index, 1)
  chatRooms.value.unshift(next)
}

function clearAdminPendingImage() {
  adminPendingImageFile.value = null
  if (adminPendingImagePreview.value && adminPendingImagePreview.value.startsWith('blob:')) {
    URL.revokeObjectURL(adminPendingImagePreview.value)
  }
  adminPendingImagePreview.value = ''
}

function openChatImagePreview(url) {
  chatImagePreviewUrl.value = String(url || '').trim()
}

function closeChatImagePreview() {
  chatImagePreviewUrl.value = ''
}

async function copyChatImage(url) {
  const imageUrl = String(url || '').trim()
  if (!imageUrl) return

  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    if (typeof window !== 'undefined' && window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type || 'image/png']: blob })])
      showToast('Đã sao chép ảnh')
      return
    }
    throw new Error('clipboard-unavailable')
  } catch {
    try {
      await navigator.clipboard.writeText(imageUrl)
      showToast('Đã sao chép liên kết ảnh')
    } catch {
      showToast('Không thể sao chép ảnh', 'error')
    }
  }
}

function syncSelectedChatProfileForm() {
  chatProfileForm.displayName = String(selectedChatUser.value?.displayName || '')
  chatProfileForm.characterName = String(selectedChatUser.value?.characterName || '')
  chatProfileForm.chatTag = String(selectedChatUser.value?.chatTag || '')
}

function syncChatSettingsForm() {
  chatSettingsForm.supportWelcomeMessage = String(siteConfig.supportWelcomeMessage || '')
  chatSettingsForm.supportWelcomeAttachmentType = String(siteConfig.supportWelcomeAttachmentType || 'vip')
  chatSettingsForm.supportWelcomeAttachmentUrl = String(siteConfig.supportWelcomeAttachmentUrl || '')
  chatSettingsForm.supportAutoReplyMessage = String(siteConfig.supportAutoReplyMessage || '')
  chatSettingsForm.supportAutoReplyAttachmentType = String(siteConfig.supportAutoReplyAttachmentType || 'none')
  chatSettingsForm.supportAutoReplyAttachmentUrl = String(siteConfig.supportAutoReplyAttachmentUrl || '')
  chatSettingsForm.supportAwayEnabled = Boolean(siteConfig.supportAwayEnabled)
  chatSettingsForm.supportNotifySound = String(siteConfig.supportNotifySound || 'messenger')
  chatSettingsForm.supportNotifyVolume = Number(siteConfig.supportNotifyVolume || 220)
  chatSettingsForm.supportAwayMessage = String(siteConfig.supportAwayMessage || '')
  chatSettingsForm.supportAwayAttachmentType = String(siteConfig.supportAwayAttachmentType || 'none')
  chatSettingsForm.supportAwayAttachmentUrl = String(siteConfig.supportAwayAttachmentUrl || '')
  chatSettingsForm.supportQuickReplyOneLabel = String(siteConfig.supportQuickReplyOneLabel ?? 'Đã nhận')
  chatSettingsForm.supportQuickReplyOne = String(siteConfig.supportQuickReplyOne ?? '')
  chatSettingsForm.supportQuickReplyOneAttachmentType = String(siteConfig.supportQuickReplyOneAttachmentType || 'none')
  chatSettingsForm.supportQuickReplyOneAttachmentUrl = String(siteConfig.supportQuickReplyOneAttachmentUrl ?? '')
  chatSettingsForm.supportQuickReplyTwoLabel = String(siteConfig.supportQuickReplyTwoLabel ?? 'Chờ kiểm tra')
  chatSettingsForm.supportQuickReplyTwo = String(siteConfig.supportQuickReplyTwo ?? '')
  chatSettingsForm.supportQuickReplyTwoAttachmentType = String(siteConfig.supportQuickReplyTwoAttachmentType || 'none')
  chatSettingsForm.supportQuickReplyTwoAttachmentUrl = String(siteConfig.supportQuickReplyTwoAttachmentUrl ?? '')
  chatSettingsForm.supportQuickReplyThreeLabel = String(siteConfig.supportQuickReplyThreeLabel ?? 'Gửi thông tin')
  chatSettingsForm.supportQuickReplyThree = String(siteConfig.supportQuickReplyThree ?? '')
  chatSettingsForm.supportQuickReplyThreeAttachmentType = String(siteConfig.supportQuickReplyThreeAttachmentType || 'none')
  chatSettingsForm.supportQuickReplyThreeAttachmentUrl = String(siteConfig.supportQuickReplyThreeAttachmentUrl ?? '')
  chatSettingsForm.supportQuickReplyFourLabel = String(siteConfig.supportQuickReplyFourLabel ?? 'Đang xử lý')
  chatSettingsForm.supportQuickReplyFour = String(siteConfig.supportQuickReplyFour ?? '')
  chatSettingsForm.supportQuickReplyFourAttachmentType = String(siteConfig.supportQuickReplyFourAttachmentType || 'none')
  chatSettingsForm.supportQuickReplyFourAttachmentUrl = String(siteConfig.supportQuickReplyFourAttachmentUrl ?? '')
  chatSettingsForm.supportQuickReplyFiveLabel = String(siteConfig.supportQuickReplyFiveLabel ?? 'Gửi thêm')
  chatSettingsForm.supportQuickReplyFive = String(siteConfig.supportQuickReplyFive ?? '')
  chatSettingsForm.supportQuickReplyFiveAttachmentType = String(siteConfig.supportQuickReplyFiveAttachmentType || 'none')
  chatSettingsForm.supportQuickReplyFiveAttachmentUrl = String(siteConfig.supportQuickReplyFiveAttachmentUrl ?? '')
  chatSettingsForm.supportQuickReplyVipLabel = String(siteConfig.supportQuickReplyVipLabel ?? 'Bảng VIP')
  chatSettingsForm.supportQuickReplyVipAttachmentType = String(siteConfig.supportQuickReplyVipAttachmentType || 'vip')
  chatSettingsForm.supportQuickReplyVipAttachmentUrl = String(siteConfig.supportQuickReplyVipAttachmentUrl ?? '')
}

function ensureVipPrivilegeConfig() {
  siteConfig.vipPrivilegeTitle = String(siteConfig.vipPrivilegeTitle || VIP_PRIVILEGE_DEFAULT_TITLE)
  siteConfig.vipPrivilegeSubtitle = String(siteConfig.vipPrivilegeSubtitle || VIP_PRIVILEGE_DEFAULT_SUBTITLE)
  siteConfig.vipPrivilegeRows = normalizeVipPrivilegeRows(siteConfig.vipPrivilegeRows)
}

function addVipPrivilegeRow() {
  siteConfig.vipPrivilegeRows.push({
    tich_luy: '',
    cap: '',
    thuong: '',
    han_muc: ''
  })
}

function removeVipPrivilegeRow(index) {
  if (siteConfig.vipPrivilegeRows.length <= 1) return
  siteConfig.vipPrivilegeRows.splice(index, 1)
}

function moveVipPrivilegeRow(index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= siteConfig.vipPrivilegeRows.length) return
  const rows = [...siteConfig.vipPrivilegeRows]
  ;[rows[index], rows[nextIndex]] = [rows[nextIndex], rows[index]]
  siteConfig.vipPrivilegeRows = rows
}

function resetVipPrivilegeRows() {
  siteConfig.vipPrivilegeTitle = VIP_PRIVILEGE_DEFAULT_TITLE
  siteConfig.vipPrivilegeSubtitle = VIP_PRIVILEGE_DEFAULT_SUBTITLE
  siteConfig.vipPrivilegeRows = cloneVipPrivilegeRows()
}

function updateChatRoomUser(user) {
  const userId = String(user?._id || '')
  if (!userId) return

  chatRooms.value = chatRooms.value.map((room) => {
    if (String(room.roomUserId || '') !== userId) {
      return room
    }

    const label = user.displayName || user.characterName || user.fullName || user.username
    return {
      ...room,
      user,
      title: `${label} (@${user.username})`
    }
  })
}

function syncSelectedUserForms() {
  const user = selectedUser.value
  selectedUserProfileForm.fullName = String(user?.fullName || '')
  selectedUserProfileForm.phone = String(user?.phone || '')
  selectedUserProfileForm.displayName = String(user?.displayName || '')
  selectedUserProfileForm.characterName = String(user?.characterName || '')
  selectedUserProfileForm.referredByCode = String(user?.referredByCode || '')
  selectedUserProfileForm.inviteCode = String(user?.inviteCode || '')

  selectedUserBankForm.bankName = String(user?.linkedBank?.bankName || '')
  selectedUserBankForm.bankAccount = String(user?.linkedBank?.bankAccount || '')
  selectedUserBankForm.accountName = String(user?.linkedBank?.accountName || '')

  selectedUserSecurityForm.password = ''
  selectedUserSecurityForm.withdrawPassword = ''
  resetSelectedUserPasswordVault()
}

function resetSelectedUserPasswordVault() {
  selectedUserPasswordVault.loaded = false
  selectedUserPasswordVault.loading = false
  selectedUserPasswordVault.password = ''
  selectedUserPasswordVault.withdrawPassword = ''
  selectedUserPasswordVault.message = ''
  selectedUserPasswordVisible.password = false
  selectedUserPasswordVisible.withdrawPassword = false
}

function clearSelectedUserHistory() {
  selectedUserHistory.loading = false
  selectedUserHistory.error = ''
  selectedUserHistory.total = 0
  selectedUserHistory.items = []
}

function resetSelectedUserHistoryFilters(options = {}) {
  selectedUserHistoryFilters.mode = 'all'
  selectedUserHistoryFilters.from = ''
  selectedUserHistoryFilters.to = ''
  selectedUserHistoryFilters.limit = 200
  clearSelectedUserHistory()
  if (options.reload !== false && selectedUser.value?._id) {
    void loadSelectedUserHistory()
  }
}

function formatUserChangeAction(action) {
  const labels = {
    profile_update: 'Thông tin',
    bank_update: 'Ngân hàng',
    security_update: 'Mật khẩu',
    status_update: 'Trạng thái',
    vip_update: 'VIP',
    password_view: 'Xem mật khẩu'
  }
  return labels[action] || 'Cập nhật'
}

function describeChangedFields(before = {}, after = {}, fields = []) {
  return fields
    .filter(({ key }) => String(before?.[key] || '') !== String(after?.[key] || ''))
    .map(({ label }) => label)
}

function describeUserChangeLog(log) {
  const before = log?.before || {}
  const after = log?.after || {}
  const note = String(log?.note || '').trim()

  if (log?.action === 'profile_update') {
    const changed = describeChangedFields(before, after, [
      { key: 'fullName', label: 'Họ tên' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'displayName', label: 'Tên gợi nhớ' },
      { key: 'characterName', label: 'Tên nhân vật' },
      { key: 'referredByCode', label: 'Mã giới thiệu' },
      { key: 'inviteCode', label: 'Mã mời' }
    ])
    const base = changed.length ? `Đã cập nhật: ${changed.join(' · ')}` : 'Đã cập nhật hồ sơ cơ bản'
    return note ? `${base} · ${note}` : base
  }

  if (log?.action === 'bank_update') {
    const changed = describeChangedFields(before, after, [
      { key: 'bankName', label: 'Tên ngân hàng' },
      { key: 'bankAccount', label: 'Số tài khoản' },
      { key: 'accountName', label: 'Chủ tài khoản' }
    ])
    const base = changed.length ? `Đã cập nhật: ${changed.join(' · ')}` : 'Đã cập nhật tài khoản ngân hàng'
    return note ? `${base} · ${note}` : base
  }

  if (log?.action === 'security_update') {
    const tasks = []
    if (after.passwordChanged) tasks.push('Đổi mật khẩu đăng nhập')
    if (after.withdrawPasswordChanged) tasks.push('Đổi mật khẩu rút')
    const base = tasks.join(' · ') || 'Đã cập nhật bảo mật'
    return note ? `${base} · ${note}` : base
  }

  if (log?.action === 'status_update') {
    const base = `Trạng thái: ${before.status || '--'} -> ${after.status || '--'}`
    return note ? `${base} · ${note}` : base
  }

  if (log?.action === 'vip_update') {
    const base = `VIP: ${Number(before.vipLevel || 0)} -> ${Number(after.vipLevel || 0)}`
    return note ? `${base} · ${note}` : base
  }

  return note ? `Đã cập nhật thông tin người chơi · ${note}` : 'Đã cập nhật thông tin người chơi'
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
function formatUserHistoryType(item = {}) {
  if (item.source === 'bet') return 'Chơi game'
  return formatTransactionType(item.type)
}
function describeUserHistoryItem(item = {}) {
  if (item.source === 'bet') {
    return `${formatRoomLabel(item.roomId)} · Phiên ${item.roundId || '--'} · ${formatGateLabel(item.gate)}`
  }
  const reason = String(item.reason || '').trim()
  const note = String(item.meta?.note || item.meta?.transferNote || '').trim()
  return note || reason || formatTransactionType(item.type)
}
function formatUserHistoryAmount(item = {}) {
  if (item.source === 'bet') {
    return `${formatMoney(item.amount)} / trả ${formatMoney(item.payout)}`
  }
  const amount = Number(item.amount || 0)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${formatMoney(Math.abs(amount))}`
}
function formatUserHistoryStatus(item = {}) {
  if (item.source === 'bet') return formatBetStatus(item.status, item.payout)
  return formatRequestStatus(item)
}
function formatUserHistoryResult(item = {}) {
  if (item.source === 'bet') {
    const result = item.resultSnapshot?.result
    return Array.isArray(result) && result.length ? result.join(' - ') : '--'
  }
  return `${formatMoney(item.balanceBefore)} -> ${formatMoney(item.balanceAfter)}`
}
function getUserHistoryBadgeClass(item = {}) {
  if (item.source === 'bet') return 'badge--info'
  if (String(item.type || '').includes('deposit')) return 'badge--success'
  if (String(item.type || '').includes('withdraw')) return 'badge--warning'
  return 'badge--info'
}
function getUserHistoryAmountClass(item = {}) {
  if (item.source === 'bet') return Number(item.payout || 0) > 0 ? 'text-success' : ''
  const amount = Number(item.amount || 0)
  if (amount > 0) return 'text-success'
  if (amount < 0) return 'text-danger'
  return ''
}
function formatForcedResult(r) { return Array.isArray(r)&&r.length===3?r.join(' - '):'Ngẫu nhiên' }
function isInviteSaving(id) { return Boolean(inviteSavingState[id]) }
function isAdminActionSaving(id) { return Boolean(adminActionSavingState[id]) }

function applyOddsConfig(c={}) {
  oddsConfig.roomId = c.roomId || 'sicbo-3p'
  oddsConfig.title = c.title || ''
  oddsConfig.roundDuration = Number(c.roundDuration ?? 240)
  oddsConfig.betLockSeconds = Number(c.betLockSeconds ?? 8)
  oddsConfig.minBet = Number(c.minBet ?? 1000)
  oddsConfig.maxBet = Number(c.maxBet ?? 0)
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

function buildAdminQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}
function applyPagingMeta(state, payload = {}) {
  state.page = Number(payload.page || state.page || 1)
  state.limit = Number(payload.limit || state.limit || ADMIN_PAGE_SIZE)
  state.total = Number(payload.total || 0)
  state.pages = Math.max(1, Number(payload.pages || Math.ceil(state.total / state.limit) || 1))
}
function paginationSummary(state) {
  return `Trang ${state.page}/${state.pages} · Tổng ${state.total}`
}
function hasPrevPage(state) {
  return Number(state.page || 1) > 1
}
function hasNextPage(state) {
  return Number(state.page || 1) < Number(state.pages || 1)
}

async function loadOverview() { const d=await apiFetch('/api/admin/overview',{headers:userStore.authHeaders}); overview.stats=d.stats||overview.stats; overview.users=d.users||[]; overview.pendingTransactions=d.pendingTransactions||[] }
async function loadUsers(page = userPaging.page) {
  userPaging.loading = true
  try {
    const keyword = String(userSearchKeyword.value || '').trim()
    const d = await apiFetch(`/api/admin/users${buildAdminQuery({ page, limit: userPaging.limit, keyword })}`, { headers: userStore.authHeaders })
    users.value = d.items || []
    applyPagingMeta(userPaging, d)
  } finally {
    userPaging.loading = false
  }
}
async function loadTransactions(group = 'all', page = transactionPaging[group]?.page || 1) {
  const paging = transactionPaging[group] || transactionPaging.all
  paging.loading = true
  try {
    const d = await apiFetch(`/api/admin/transactions${buildAdminQuery({ group, page, limit: paging.limit })}`, { headers: userStore.authHeaders })
    if (group === 'deposit') depositTransactions.value = d.items || []
    else if (group === 'withdraw') withdrawTransactions.value = d.items || []
    else transactions.value = d.items || []
    applyPagingMeta(paging, d)
  } finally {
    paging.loading = false
  }
}
async function loadTransactionPages() {
  await Promise.all([loadTransactions('all'), loadTransactions('deposit'), loadTransactions('withdraw')])
}
async function loadGameHistory(page = gameHistoryPaging.page) {
  gameHistoryPaging.loading = true
  try {
    const d = await apiFetch(`/api/admin/game-history${buildAdminQuery({ page, limit: gameHistoryPaging.limit })}`, { headers: userStore.authHeaders })
    gameHistory.value = d.items || []
    applyPagingMeta(gameHistoryPaging, d)
  } finally {
    gameHistoryPaging.loading = false
  }
}
async function loadRecentGameHistory() {
  const [threeP, fiveP] = await Promise.all([
    apiFetch('/api/admin/game-history?page=1&limit=60&roomId=sicbo-3p', { headers: userStore.authHeaders }),
    apiFetch('/api/admin/game-history?page=1&limit=60&roomId=sicbo-5p', { headers: userStore.authHeaders })
  ])
  recentGameHistory.value = [...(threeP.items || []), ...(fiveP.items || [])]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}
async function loadRoundHistory(page = roundHistoryPaging.page) {
  roundHistoryPaging.loading = true
  try {
    const d = await apiFetch(`/api/admin/round-history${buildAdminQuery({ page, limit: roundHistoryPaging.limit })}`, { headers: userStore.authHeaders })
    roundHistory.value = d.items || []
    applyPagingMeta(roundHistoryPaging, d)
  } finally {
    roundHistoryPaging.loading = false
  }
}
function changeUserPage(delta) {
  const nextPage = Math.min(userPaging.pages, Math.max(1, Number(userPaging.page || 1) + delta))
  if (nextPage === userPaging.page) return
  void loadUsers(nextPage)
}
function changeTransactionPage(group, delta) {
  const paging = transactionPaging[group] || transactionPaging.all
  const nextPage = Math.min(paging.pages, Math.max(1, Number(paging.page || 1) + delta))
  if (nextPage === paging.page) return
  void loadTransactions(group, nextPage)
}
function changeGameHistoryPage(delta) {
  const nextPage = Math.min(gameHistoryPaging.pages, Math.max(1, Number(gameHistoryPaging.page || 1) + delta))
  if (nextPage === gameHistoryPaging.page) return
  void loadGameHistory(nextPage)
}
function changeRoundHistoryPage(delta) {
  const nextPage = Math.min(roundHistoryPaging.pages, Math.max(1, Number(roundHistoryPaging.page || 1) + delta))
  if (nextPage === roundHistoryPaging.page) return
  void loadRoundHistory(nextPage)
}
async function loadGameSummary() { const d=await apiFetch('/api/admin/game-summary',{headers:userStore.authHeaders}); gameSummary.value=d.items||[] }
async function loadLiveBets(roomId = liveRoomId.value) {
  const d = await apiFetch(`/api/admin/live-bets?roomId=${encodeURIComponent(roomId)}`, { headers: userStore.authHeaders })
  liveRoomId.value = d.roomId || roomId
  liveBetsFeed.roomId = d.roomId || roomId
  liveBetsFeed.rooms = d.rooms || []
  liveBetsFeed.state = d.state || null
  liveBetsFeed.currentBets = d.currentBets || []
  liveBetsFeed.recentBets = d.recentBets || []
  liveBetsFeed.rounds = d.rounds || []
}
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
let oddsSettingsRequestVersion = 0
let sicboControlRequestVersion = 0

function normalizeOddsRoomId(roomId) {
  return String(roomId || '') === 'sicbo-5p' ? 'sicbo-5p' : 'sicbo-3p'
}

async function loadOddsSettings(roomId=selectedOddsRoomId.value) {
  const targetRoomId = normalizeOddsRoomId(roomId)
  const requestVersion = ++oddsSettingsRequestVersion
  const d=await apiFetch(`/api/admin/odds-settings?roomId=${encodeURIComponent(targetRoomId)}`,{headers:userStore.authHeaders})

  // Ignore stale responses when user switches between 3P/5P quickly.
  if (requestVersion !== oddsSettingsRequestVersion) return

  oddsRooms.value=d.rooms||[]
  const config = d.config || {}
  const configRoomId = normalizeOddsRoomId(config.roomId || targetRoomId)
  if (selectedOddsRoomId.value !== targetRoomId || configRoomId !== targetRoomId) return

  applyOddsConfig(config)
}
async function saveOddsSettings() {
  const targetRoomId = normalizeOddsRoomId(selectedOddsRoomId.value)
  savingOdds.value=true
  try{
    loadError.value=''
    const d=await apiFetch(`/api/admin/odds-settings?roomId=${encodeURIComponent(targetRoomId)}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify(buildOddsPayload())})
    if (selectedOddsRoomId.value === targetRoomId) {
      applyOddsConfig(d.config||{})
    }
    showToast(`Đã lưu cấu hình kèo ${formatRoomLabel(targetRoomId)}`)
  }catch(e){
    loadError.value=e.message||'Error'
  }finally{
    savingOdds.value=false
  }
}
async function resetOddsSettings() {
  const targetRoomId = normalizeOddsRoomId(selectedOddsRoomId.value)
  savingOdds.value=true
  try{
    loadError.value=''
    const d=await apiFetch(`/api/admin/odds-settings/reset?roomId=${encodeURIComponent(targetRoomId)}`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})})
    if (selectedOddsRoomId.value === targetRoomId) {
      applyOddsConfig(d.config||{})
    }
    showToast(`Đã reset cấu hình kèo ${formatRoomLabel(targetRoomId)}`)
  }catch(e){
    loadError.value=e.message||'Error'
  }finally{
    savingOdds.value=false
  }
}
async function loadSicboControl(roomId=selectedOddsRoomId.value) {
  const targetRoomId = normalizeOddsRoomId(roomId)
  const requestVersion = ++sicboControlRequestVersion
  const d=await apiFetch(`/api/admin/sicbo-control?roomId=${encodeURIComponent(targetRoomId)}`,{headers:userStore.authHeaders})

  if (requestVersion !== sicboControlRequestVersion) return

  const state = d.state || {}
  const stateRoomId = normalizeOddsRoomId(state.roomId || targetRoomId)
  if (selectedOddsRoomId.value !== targetRoomId || stateRoomId !== targetRoomId) return

  applySicboControl(state)
}
async function saveSicboControl() {
  const targetRoomId = normalizeOddsRoomId(selectedOddsRoomId.value)
  savingControl.value=true
  try{
    loadError.value=''
    const d=await apiFetch(`/api/admin/sicbo-control?roomId=${encodeURIComponent(targetRoomId)}`,{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify({forcedResult:buildForcedResultPayload(),forcedNote:forcedResultForm.forcedNote})})
    if (selectedOddsRoomId.value === targetRoomId) {
      applySicboControl(d.state||{})
    }
    showToast(`Đã lưu kèo ${formatRoomLabel(targetRoomId)}`)
  }catch(e){
    loadError.value=e.message||'Error'
  }finally{
    savingControl.value=false
  }
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
function buildIncidentQuery() {
  const params = new URLSearchParams()
  params.set('page', String(incidentPaging.page || 1))
  params.set('limit', String(incidentPaging.limit || 40))
  if (incidentFilters.status) params.set('status', incidentFilters.status)
  if (incidentFilters.source) params.set('source', incidentFilters.source)
  if (incidentFilters.level) params.set('level', incidentFilters.level)
  if (incidentFilters.keyword) params.set('keyword', incidentFilters.keyword)
  return params.toString()
}

async function loadIncidentStats() {
  const d = await apiFetch('/api/admin/incidents/stats', { headers: userStore.authHeaders })
  Object.assign(incidentStats, {
    total: Number(d?.stats?.total || 0),
    last24h: Number(d?.stats?.last24h || 0),
    open: Number(d?.stats?.open || 0),
    investigating: Number(d?.stats?.investigating || 0),
    resolved: Number(d?.stats?.resolved || 0),
    ignored: Number(d?.stats?.ignored || 0)
  })
}

async function loadIncidentLogs(options = {}) {
  const silent = Boolean(options.silent)
  if (!silent) {
    incidentLoading.value = true
  }
  try {
    const query = buildIncidentQuery()
    const d = await apiFetch(`/api/admin/incidents?${query}`, { headers: userStore.authHeaders })
    incidentLogs.value = d?.items || []
    Object.assign(incidentPaging, {
      page: Number(d?.paging?.page || incidentPaging.page || 1),
      limit: Number(d?.paging?.limit || incidentPaging.limit || 40),
      total: Number(d?.paging?.total || 0),
      pages: Number(d?.paging?.pages || 1)
    })
  } finally {
    if (!silent) {
      incidentLoading.value = false
    }
  }
}

async function refreshIncidentData(options = {}) {
  const silent = Boolean(options.silent)
  if (!silent) {
    incidentLoading.value = true
  }
  try {
    await Promise.all([
      loadIncidentStats(),
      loadIncidentLogs({ silent: true })
    ])
  } finally {
    if (!silent) {
      incidentLoading.value = false
    }
  }
}

async function applyIncidentFilters() {
  incidentPaging.page = 1
  await refreshIncidentData()
}

async function resetIncidentFilters() {
  incidentFilters.status = ''
  incidentFilters.source = ''
  incidentFilters.level = ''
  incidentFilters.keyword = ''
  incidentPaging.page = 1
  await refreshIncidentData()
}

async function setIncidentStatus(item, status) {
  const incidentId = String(item?._id || '')
  if (!incidentId || incidentActionLoading[incidentId]) return
  incidentActionLoading[incidentId] = true
  try {
    const d = await apiFetch(`/api/admin/incidents/${encodeURIComponent(incidentId)}/status`, {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify({ status })
    })
    const updatedItem = d?.item || null
    if (updatedItem?._id) {
      incidentLogs.value = incidentLogs.value.map((entry) =>
        String(entry?._id || '') === String(updatedItem._id) ? updatedItem : entry
      )
    }
    await loadIncidentStats()
    showToast(`Đã cập nhật sự cố sang trạng thái "${incidentStatusLabel(status)}"`)
  } catch (e) {
    showToast(e.message || 'Không thể cập nhật trạng thái sự cố', 'error')
  } finally {
    incidentActionLoading[incidentId] = false
  }
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
  try {
    const d=await apiFetch('/api/admin/site-config',{headers:userStore.authHeaders})
    Object.assign(siteConfig,d.config||{})
    ensureVipPrivilegeConfig()
    syncChatSettingsForm()
  } catch { /* ignore */ }
}
async function saveSiteConfig() {
  savingSiteConfig.value=true
  try {
    const d=await apiFetch('/api/admin/site-config',{method:'PATCH',headers:authJsonHeaders.value,body:JSON.stringify(siteConfig)})
    Object.assign(siteConfig,d.config||{})
    ensureVipPrivilegeConfig()
    showToast('Đã lưu cấu hình website')
  } catch(e){loadError.value=e.message||'Error'}
  finally{savingSiteConfig.value=false}
}

async function saveVipPrivilegeSettings() {
  const title = String(siteConfig.vipPrivilegeTitle || '').trim()
  const subtitle = String(siteConfig.vipPrivilegeSubtitle || '').trim()
  const rows = normalizeVipPrivilegeRows(siteConfig.vipPrivilegeRows)

  if (!title || !subtitle) {
    showToast('Tiêu đề và mô tả bảng VIP không được để trống', 'error')
    return
  }

  const hasInvalidRow = rows.some((row) => !row.tich_luy || !row.cap || !row.thuong || !row.han_muc)
  if (hasInvalidRow) {
    showToast('Tất cả ô trong bảng VIP phải được nhập đầy đủ', 'error')
    return
  }

  savingVipPrivilege.value = true
  try {
    const d = await apiFetch('/api/admin/site-config', {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify({
        vipPrivilegeTitle: title,
        vipPrivilegeSubtitle: subtitle,
        vipPrivilegeRows: rows
      })
    })
    Object.assign(siteConfig, d.config || {})
    ensureVipPrivilegeConfig()
    showToast('Đã lưu bảng đặc quyền VIP')
  } catch (e) {
    showToast(e.message || 'Không thể lưu bảng đặc quyền VIP', 'error')
  } finally {
    savingVipPrivilege.value = false
  }
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
  const text=adminChatInput.value.trim()
  if((!text && !adminPendingImageFile.value) || sendingAdminChat.value || sendingAdminImage.value || !selectedRoomId.value)return
  stopAdminChatTypingBroadcast()
  sendingAdminChat.value=true
  const socket=socketStore.connect()
  if (adminPendingImageFile.value) {
    sendingAdminImage.value = true
    uploadChatImageFile(adminPendingImageFile.value)
      .then((imageUrl) => {
        forceAdminChatScrollOnOwnSend.value = true
        socket.emit('send_chat_message',{roomId:selectedRoomId.value,content:text,token:userStore.token,messageType:'image',imageUrl},(response)=>{
          sendingAdminChat.value=false
          sendingAdminImage.value=false
          if(!response?.ok){
            forceAdminChatScrollOnOwnSend.value = false
            showToast(response?.message||'Không thể gửi tin nhắn','error');return
          }
          if(response?.message){
            onAdminChatMessage(response.message)
          } else {
            forceAdminChatScrollOnOwnSend.value = false
          }
          adminChatInput.value=''
          clearAdminPendingImage()
        })
      })
      .catch((error) => {
        sendingAdminChat.value = false
        sendingAdminImage.value = false
        forceAdminChatScrollOnOwnSend.value = false
        showToast(error?.message || 'Không thể gửi ảnh', 'error')
      })
    return
  }

  forceAdminChatScrollOnOwnSend.value = true
  socket.emit('send_chat_message',{roomId:selectedRoomId.value,content:text,token:userStore.token,messageType:'text'},(response)=>{
    sendingAdminChat.value=false
    if(!response?.ok){
      forceAdminChatScrollOnOwnSend.value = false
      showToast(response?.message||'Không thể gửi tin nhắn','error');return
    }
    if(response?.message){
      onAdminChatMessage(response.message)
    } else {
      forceAdminChatScrollOnOwnSend.value = false
    }
  })
  adminChatInput.value=''
}

function handleAdminChatKeydown(event) {
  if (event.key !== 'Enter') return
  if (event.shiftKey) return
  event.preventDefault()
  sendAdminChat()
}

function normalizeSupportAttachmentType(value, allowVip = false) {
  const normalized = String(value || 'none').trim().toLowerCase()
  if (allowVip && normalized === 'vip') return 'vip'
  if (normalized === 'url' || normalized === 'bank') return normalized
  if (normalized === 'image' || normalized === 'sticker') return normalized
  return 'none'
}

function formatQuickAttachmentLabel(value) {
  const normalized = normalizeSupportAttachmentType(value, true)
  return supportQuickAttachmentOptions.find((item) => item.value === normalized)?.label || 'Không đính kèm'
}

function addQuickReplyButton() {
  const target = editableQuickReplyButtons.value.find((item) => !item.enabled) || editableQuickReplyButtons.value[0]
  if (!target) return
  activeQuickReplyKey.value = target.key
  if (!String(chatSettingsForm[target.labelKey] || '').trim()) {
    chatSettingsForm[target.labelKey] = target.fallbackLabel || 'Nút nhanh'
  }
  if (target.messageKey && !String(chatSettingsForm[target.messageKey] || '').trim()) {
    chatSettingsForm[target.messageKey] = 'Nhập nội dung gửi nhanh tại đây.'
  }
}

function deleteQuickReplyButton(reply) {
  if (!reply) return
  chatSettingsForm[reply.labelKey] = ''
  if (reply.messageKey) chatSettingsForm[reply.messageKey] = ''
  chatSettingsForm[reply.attachmentTypeKey] = 'none'
  chatSettingsForm[reply.attachmentUrlKey] = ''
  const next = editableQuickReplyButtons.value.find((item) => item.key !== reply.key && item.enabled)
  activeQuickReplyKey.value = next?.key || chatQuickReplyConfigs[0]?.key || 'one'
}

function buildQuickReplyText(reply) {
  const attachmentType = normalizeSupportAttachmentType(reply?.attachmentType, true)
  const text = String(reply?.message || '').trim()
  const attachmentUrl = String(reply?.attachmentUrl || '').trim()
  if (attachmentType === 'url' && attachmentUrl) {
    return [text, attachmentUrl].filter(Boolean).join('\n')
  }
  if (attachmentType === 'bank' && attachmentUrl) {
    return [text, attachmentUrl].filter(Boolean).join('\n')
  }
  return text
}

async function uploadChatImageFile(file) {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch(`${String(API_BASE_URL || '').replace(/\/+$/, '')}/api/account/chat/upload-image`, {
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
  return imageUrl
}

async function uploadChatImageBlob(blob, filename = 'chat-image.png') {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  return uploadChatImageFile(file)
}

function buildVipPrivilegeSvgMarkup() {
  const rows = toVipPrivilegeDisplayRows(siteConfig.vipPrivilegeRows)
  const rowHeight = 62
  const width = 1200
  const tableWidth = 1080
  const left = 60
  const top = 240
  const perksTop = top + 74 + Math.max(rows.length, 1) * rowHeight + 42
  const totalHeight = perksTop + 150
  const colWidths = [270, 250, 230, 330]
  const title = String(siteConfig.vipPrivilegeTitle || VIP_PRIVILEGE_DEFAULT_TITLE)
  const subtitle = String(siteConfig.vipPrivilegeSubtitle || VIP_PRIVILEGE_DEFAULT_SUBTITLE)
  const headers = ['💼  TÍCH LŨY', '👑  CẤP VIP', '🎁  THƯỞNG', '🪙  HẠN MỨC']
  const escapeXml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  let x = left
  const headerCells = headers.map((label, index) => {
    const cell = `<rect x="${x}" y="${top}" width="${colWidths[index]}" height="58" rx="0" fill="url(#headerGold)" stroke="#6b4a1b" stroke-width="1.4"/><text x="${x + colWidths[index] / 2}" y="${top + 37}" text-anchor="middle" fill="#ffe26b" font-size="24" font-weight="900" font-family="Arial, sans-serif">${escapeXml(label)}</text>`
    x += colWidths[index]
    return cell
  }).join('')
  const sourceRows = rows.length ? rows : [{ tich_luy: 'Chưa có dữ liệu', cap: '--', thuong: '--', han_muc: '--' }]
  const rowCells = sourceRows.map((row, rowIndex) => {
    const y = top + 58 + rowIndex * rowHeight
    let currentX = left
    const values = [row.tich_luy, row.cap, row.thuong, row.han_muc]
    return values.map((value, colIndex) => {
      const fill = rowIndex % 2 === 0 ? '#07111d' : '#0b1624'
      const color = colIndex === 1 ? '#fff2a8' : '#ffd95d'
      const markup = `<rect x="${currentX}" y="${y}" width="${colWidths[colIndex]}" height="${rowHeight}" fill="${fill}" stroke="#5c421d" stroke-width="1.2"/><text x="${currentX + colWidths[colIndex] / 2}" y="${y + 39}" text-anchor="middle" fill="${color}" font-size="27" font-weight="900" font-family="Arial, sans-serif">${escapeXml(value)}</text>`
      currentX += colWidths[colIndex]
      return markup
    }).join('')
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#101927"/>
        <stop offset="55%" stop-color="#060d17"/>
        <stop offset="100%" stop-color="#0b1420"/>
      </linearGradient>
      <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff4b8"/>
        <stop offset="42%" stop-color="#ffd45f"/>
        <stop offset="100%" stop-color="#a96d13"/>
      </linearGradient>
      <linearGradient id="headerGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7b4f18"/>
        <stop offset="100%" stop-color="#3b250c"/>
      </linearGradient>
      <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#f6c453" flood-opacity="0.55"/>
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <rect width="${width}" height="${totalHeight}" fill="url(#bg)"/>
    <rect x="16" y="16" width="${width - 32}" height="${totalHeight - 32}" rx="34" fill="none" stroke="#c28a2d" stroke-width="4"/>
    <circle cx="1080" cy="94" r="5" fill="#ffd45f" opacity="0.7"/>
    <circle cx="92" cy="118" r="7" fill="#ffd45f" opacity="0.45"/>
    <text x="170" y="112" fill="url(#goldText)" font-size="74" font-weight="950" font-family="Arial, sans-serif" filter="url(#goldGlow)">♛</text>
    <text x="${width / 2 + 40}" y="112" text-anchor="middle" fill="url(#goldText)" font-size="58" font-weight="950" font-family="Arial, sans-serif" filter="url(#goldGlow)">${escapeXml(title.toUpperCase())}</text>
    <line x1="420" y1="144" x2="780" y2="144" stroke="#c28a2d" stroke-width="2" opacity="0.75"/>
    <text x="${width / 2}" y="182" text-anchor="middle" fill="#f8fafc" font-size="31" font-weight="600" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text>
    <g>
      ${headerCells}
      ${rowCells}
    </g>
    <rect x="${left}" y="${top}" width="${tableWidth}" height="${58 + sourceRows.length * rowHeight}" rx="18" fill="none" stroke="#c28a2d" stroke-width="2.4"/>
    <rect x="${left}" y="${perksTop}" width="${tableWidth}" height="108" rx="20" fill="#0a1421" stroke="#9b6b24" stroke-width="2"/>
    <text x="${left + 112}" y="${perksTop + 64}" text-anchor="middle" fill="#ffd95d" font-size="22" font-weight="800" font-family="Arial, sans-serif">↻ Hoàn trả cao hơn</text>
    <text x="${left + 324}" y="${perksTop + 64}" text-anchor="middle" fill="#ffd95d" font-size="22" font-weight="800" font-family="Arial, sans-serif">🎁 Ưu đãi sinh nhật</text>
    <text x="${left + 540}" y="${perksTop + 64}" text-anchor="middle" fill="#ffd95d" font-size="22" font-weight="800" font-family="Arial, sans-serif">♛ Chăm sóc VIP</text>
    <text x="${left + 760}" y="${perksTop + 64}" text-anchor="middle" fill="#ffd95d" font-size="22" font-weight="800" font-family="Arial, sans-serif">✓ Hỗ trợ 24/7</text>
    <text x="${left + 980}" y="${perksTop + 64}" text-anchor="middle" fill="#ffd95d" font-size="22" font-weight="800" font-family="Arial, sans-serif">💰 Nhiều ưu đãi</text>
  </svg>`
}

async function buildVipPrivilegeImageBlob() {
  const svgMarkup = buildVipPrivilegeSvgMarkup()
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(svgBlob)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Không thể dựng ảnh bảng VIP'))
      img.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = Math.max(680, image.height || 680)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Không thể tạo ảnh bảng VIP')
    }
    context.fillStyle = '#07101d'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1))
    if (!blob) {
      throw new Error('Không thể xuất ảnh bảng VIP')
    }
    return blob
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function resolveQuickReplyAttachment(reply) {
  const attachmentType = normalizeSupportAttachmentType(reply?.attachmentType, true)
  const attachmentUrl = String(reply?.attachmentUrl || '').trim()
  if (attachmentType === 'vip') {
    const blob = await buildVipPrivilegeImageBlob()
    return uploadChatImageBlob(blob, 'vip-privilege-chart.png')
  }
  if ((attachmentType === 'image' || attachmentType === 'sticker') && attachmentUrl) {
    return attachmentUrl
  }
  return ''
}

async function sendQuickReply(reply) {
  if (!selectedRoomId.value || sendingAdminChat.value || sendingAdminImage.value) return
  const attachmentType = normalizeSupportAttachmentType(reply?.attachmentType, true)
  const text = buildQuickReplyText(reply)
  if (attachmentType === 'image' || attachmentType === 'sticker' || attachmentType === 'vip') {
    sendingAdminChat.value = true
    sendingAdminImage.value = true
    try {
      const imageUrl = await resolveQuickReplyAttachment(reply)
      if (!imageUrl) {
        throw new Error('Chưa có ảnh hoặc sticker cho nút này')
      }
      const socket = socketStore.connect()
      socket.emit('send_chat_message', {
        roomId: selectedRoomId.value,
        content: text,
        token: userStore.token,
        messageType: 'image',
        imageUrl
      }, (response) => {
        sendingAdminChat.value = false
        sendingAdminImage.value = false
        if (!response?.ok) {
          showToast(response?.message || 'Không thể gửi nội dung nhanh', 'error')
          return
        }
        if (response?.message) {
          onAdminChatMessage(response.message)
        }
      })
    } catch (error) {
      sendingAdminChat.value = false
      sendingAdminImage.value = false
      showToast(error?.message || 'Không thể gửi nội dung nhanh', 'error')
    }
    return
  }

  adminChatInput.value = text
  if (!adminChatInput.value) return
  sendAdminChat()
}

function onAdminChatMessage(msg) {
  if (!msg?.roomId) return
  updateChatRoomPreview(msg.roomId, msg)

  if (msg.roomId === selectedRoomId.value) {
    const existed = chatMessages.value.some(m=>m._id===msg._id)
    const shouldForceOwnScroll = msg.senderRole === 'admin' && forceAdminChatScrollOnOwnSend.value
    const shouldShowNewMessageJump = !existed && msg.senderRole === 'user' && !adminShouldStickToBottom.value
    mergeAdminChatMessage(msg)
    if (shouldForceOwnScroll) {
      forceAdminChatScrollOnOwnSend.value = false
    }
    if (shouldShowNewMessageJump) {
      adminHasNewMessageBelow.value = true
    }
    if (existed && !shouldForceOwnScroll) return
    nextTick(()=>{
      if (shouldForceOwnScroll || adminShouldStickToBottom.value) {
        scrollAdminChatToBottom()
      }
    })
    if (msg.senderRole === 'user') {
      playAdminChatTone()
      notifyAdminBrowser(msg)
    }
    return
  }

  unreadByRoom[msg.roomId] = Number(unreadByRoom[msg.roomId] || 0) + 1
  if (msg.senderRole === 'user') {
    playAdminChatTone()
    notifyAdminBrowser(msg)
  }
}

function onAdminChatNotify(payload) {
  const roomId = payload?.roomId
  if (!roomId) return

  const shouldMarkUnread = activeTab.value !== 'chat' || roomId !== selectedRoomId.value
  if (shouldMarkUnread) {
    unreadByRoom[roomId] = Number(unreadByRoom[roomId] || 0) + 1
  }
  updateChatRoomPreview(roomId, payload)
  playAdminChatTone()
  notifyAdminBrowser(payload)
  showToast('Có tin nhắn mới từ khách')
  void loadChatStats()
  void loadChatRooms()
}

function notifyWalletBrowser(payload) {
  if (typeof window === 'undefined') return
  if (document.visibilityState === 'visible') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const txType = String(payload?.transactionType || '')
  const isDeposit = txType === 'deposit_pending' || String(payload?.event || '') === 'deposit_request_created'

  try {
    new Notification(isDeposit ? 'Có yêu cầu nạp tiền mới' : 'Có yêu cầu rút tiền mới', {
      body: `${payload?.username || 'Người chơi'} yêu cầu ${isDeposit ? 'nạp' : 'rút'} ${formatMoney(payload?.amount || 0)}`
    })
  } catch {
    /* ignore notification errors */
  }
}

function onWalletAdminNotify(payload) {
  const txType = String(payload?.transactionType || '')
  const eventName = String(payload?.event || '')
  const isWithdrawRequest =
    txType === 'withdraw_pending' ||
    eventName === 'withdraw_request_created'
  const isDepositRequest =
    txType === 'deposit_pending' ||
    eventName === 'deposit_request_created'

  if (!isWithdrawRequest && !isDepositRequest) return

  playSupportNotifyPattern(
    isWithdrawRequest ? String(siteConfig.systemSoundWithdraw || 'emergency') : String(siteConfig.systemSoundDeposit || 'zalo'),
    3.2
  )
  notifyWalletBrowser(payload)
  showToast(`Có yêu cầu ${isWithdrawRequest ? 'rút' : 'nạp'} tiền mới: ${payload?.username || 'người chơi'} · ${formatMoney(payload?.amount || 0)}`)

  void Promise.all([
    loadTransactionPages(),
    loadOverview()
  ])
}

function triggerAdminFilePicker(targetRef) {
  if (!targetRef?.value) return
  targetRef.value.value = ''
  targetRef.value.click()
}

function pickAdminCamera() {
  triggerAdminFilePicker(adminChatCameraRef)
}

function pickAdminGallery() {
  triggerAdminFilePicker(adminChatGalleryRef)
}

function pickAdminFile() {
  triggerAdminFilePicker(adminChatFileRef)
}

function toggleAdminAttachMenu() {
  showAdminAttachMenu.value = !showAdminAttachMenu.value
}

function clearAdminCustomerTyping() {
  if (adminCustomerTypingTimer) {
    clearTimeout(adminCustomerTypingTimer)
  }
  adminCustomerTypingTimer = null
  adminCustomerTypingActive.value = false
}

function setAdminCustomerTypingActive(isTyping) {
  if (!isTyping) {
    clearAdminCustomerTyping()
    return
  }
  adminCustomerTypingActive.value = true
  nextTick(() => {
    if (adminShouldStickToBottom.value && adminChatRef.value) {
      adminChatRef.value.scrollTop = adminChatRef.value.scrollHeight
    }
  })
  if (adminCustomerTypingTimer) clearTimeout(adminCustomerTypingTimer)
  adminCustomerTypingTimer = setTimeout(() => {
    adminCustomerTypingActive.value = false
    adminCustomerTypingTimer = null
  }, 2600)
}

function emitAdminChatTypingState(isTyping) {
  if (!selectedRoomId.value || !userStore.token) return
  const socket = socketStore.socket || socketStore.connect()
  if (!socket) return
  socket.emit('chat_typing', {
    roomId: selectedRoomId.value,
    token: userStore.token,
    isTyping: Boolean(isTyping)
  }, () => {})
}

function stopAdminChatTypingBroadcast() {
  if (adminTypingTimer) {
    clearTimeout(adminTypingTimer)
  }
  adminTypingTimer = null
  if (!lastAdminTypingState) return
  lastAdminTypingState = false
  emitAdminChatTypingState(false)
}

function handleAdminChatTyping() {
  if (!adminChatInput.value.trim()) {
    stopAdminChatTypingBroadcast()
    return
  }
  if (!lastAdminTypingState) {
    lastAdminTypingState = true
    emitAdminChatTypingState(true)
  }
  if (adminTypingTimer) clearTimeout(adminTypingTimer)
  adminTypingTimer = setTimeout(() => {
    lastAdminTypingState = false
    emitAdminChatTypingState(false)
    adminTypingTimer = null
  }, 1300)
}

function onAdminChatTyping(payload) {
  if (String(payload?.roomId || '') !== selectedRoomId.value) return
  if (payload?.senderRole !== 'user') return
  setAdminCustomerTypingActive(Boolean(payload?.isTyping))
}

function handleAdminAttachAction(type) {
  showAdminAttachMenu.value = false
  if (type === 'camera') {
    pickAdminCamera()
    return
  }
  if (type === 'gallery') {
    pickAdminGallery()
    return
  }
  pickAdminFile()
}

async function onAdminPickImage(e) {
  const file = e?.target?.files?.[0]
  if (!file || sendingAdminImage.value || !selectedRoomId.value) return
  showAdminAttachMenu.value = false
  clearAdminPendingImage()
  adminPendingImageFile.value = file
  adminPendingImagePreview.value = URL.createObjectURL(file)
}

let chatSocketCleanup=null
let chatAutoSyncTimer = null
let adminAutoSyncTimer = null

function stopChatAutoSync() {
  if (chatAutoSyncTimer) {
    clearInterval(chatAutoSyncTimer)
    chatAutoSyncTimer = null
  }
}

function startChatAutoSync() {
  stopChatAutoSync()
  chatAutoSyncTimer = setInterval(async () => {
    if (!userStore.isAdmin) return
    if (activeTab.value !== 'chat' && activeTab.value !== 'chat-mobile') return

    try {
      if (activeTab.value === 'chat') {
        await Promise.all([
          loadChatStats(),
          loadChatRooms()
        ])
      }

      if (activeTab.value === 'chat-mobile') {
        await Promise.all([
          loadMobileChatRooms(),
          selectedMobileRoomId.value ? loadMobileChatMessages(selectedMobileRoomId.value) : Promise.resolve()
        ])
      }
    } catch {
      /* ignore polling errors */
    }
  }, 4000)
}

function stopAdminAutoSync() {
  if (adminAutoSyncTimer) {
    clearInterval(adminAutoSyncTimer)
    adminAutoSyncTimer = null
  }
}

function startAdminAutoSync() {
  stopAdminAutoSync()
  adminAutoSyncTimer = setInterval(async () => {
    if (!userStore.isAdmin) return

    try {
      if (activeTab.value === 'incidents') {
        await refreshIncidentData({ silent: true })
        return
      }

      if (activeTab.value === 'deposit-requests' || activeTab.value === 'withdraw-requests' || activeTab.value === 'transactions') {
        const group = activeTab.value === 'deposit-requests' ? 'deposit' : activeTab.value === 'withdraw-requests' ? 'withdraw' : 'all'
        await loadTransactions(group)
        return
      }

      if (activeTab.value === 'live-bets') {
        await loadLiveBets(liveRoomId.value)
        return
      }

      if (activeTab.value === 'game-history') {
        await Promise.all([loadGameHistory(), loadRoundHistory()])
      }
    } catch {
      /* ignore sync errors */
    }
  }, 3500)
}

function setupChatSocket() {
  const socket=socketStore.connect()
  if(chatSocketCleanup)chatSocketCleanup()
  const rejoinChat = () => {
    socket.emit('join_chat_admin', { token: userStore.token }, () => {})
    if(selectedRoomId.value)socket.emit('join_chat',{roomId:selectedRoomId.value,token:userStore.token},()=>{})
  }
  rejoinChat()
  socket.on('chat_message',onAdminChatMessage)
  socket.on('chat_message_updated', onAdminChatMessageUpdate)
  socket.on('chat_message_deleted', onAdminChatMessageUpdate)
  socket.on('chat_typing', onAdminChatTyping)
  socket.on('chat_seen_update', onAdminChatSeenUpdate)
  socket.on('chat_notify', onAdminChatNotify)
  socket.on('wallet_admin_notify', onWalletAdminNotify)
  socket.on('connect', rejoinChat)
  chatSocketCleanup=()=>{
    socket.off('chat_message',onAdminChatMessage)
    socket.off('chat_message_updated', onAdminChatMessageUpdate)
    socket.off('chat_message_deleted', onAdminChatMessageUpdate)
    socket.off('chat_typing', onAdminChatTyping)
    socket.off('chat_seen_update', onAdminChatSeenUpdate)
    socket.off('chat_notify', onAdminChatNotify)
    socket.off('wallet_admin_notify', onWalletAdminNotify)
    socket.off('connect', rejoinChat)
    stopAdminChatTypingBroadcast()
    clearAdminCustomerTyping()
    if(selectedRoomId.value)socket.emit('leave_chat',{roomId:selectedRoomId.value})
  }
}
async function loadChatMessages(roomId, options = {}) {
  if(!roomId){
    chatMessages.value=[]
    selectedChatUser.value=null
    showChatCustomerPanel.value = false
    syncSelectedChatProfileForm()
    return
  }
  const forceBottom = Boolean(options.forceBottom)
  const d=await apiFetch(`/api/admin/chat/messages/${roomId}`,{headers:userStore.authHeaders})
  chatMessages.value=d.items||[]
  selectedChatUser.value = d.roomUser || null
  adminHasNewMessageBelow.value = false
  cancelEditAdminChatMessage()
  syncSelectedChatProfileForm()
  unreadByRoom[roomId] = 0
  await nextTick()
  if (forceBottom && adminChatRef.value) {
    adminChatRef.value.scrollTop = adminChatRef.value.scrollHeight
    adminShouldStickToBottom.value = true
  }
}
async function loadMobileChatRooms() { const d=await apiFetch('/api/admin/chat-mobile/rooms',{headers:userStore.authHeaders}); mobileChatRooms.value=d.items||[]; if(!selectedMobileRoomId.value&&mobileChatRooms.value.length)selectedMobileRoomId.value=mobileChatRooms.value[0].roomId }
async function loadMobileChatMessages(roomId) { if(!roomId){mobileChatMessages.value=[];return}; const d=await apiFetch(`/api/admin/chat-mobile/messages/${roomId}`,{headers:userStore.authHeaders}); mobileChatMessages.value=d.items||[] }
async function loadUserDetail(userId) {
  const previousUserId = String(selectedUser.value?._id || '')
  const d=await apiFetch(`/api/admin/users/${userId}`,{headers:userStore.authHeaders})
  selectedUser.value=d.user||null
  selectedUserChangeLogs.value = d.changeLogs || []
  if (previousUserId !== String(userId || '')) {
    resetSelectedUserHistoryFilters({ reload: false })
  }
  syncSelectedUserForms()
  await loadSelectedUserHistory()
}

async function loadSelectedUserHistory() {
  const userId = String(selectedUser.value?._id || '')
  if (!userId || selectedUserHistory.loading) return

  selectedUserHistory.loading = true
  selectedUserHistory.error = ''
  try {
    const params = new URLSearchParams()
    params.set('mode', String(selectedUserHistoryFilters.mode || 'all'))
    params.set('limit', String(selectedUserHistoryFilters.limit || 200))
    if (selectedUserHistoryFilters.from) params.set('from', selectedUserHistoryFilters.from)
    if (selectedUserHistoryFilters.to) params.set('to', selectedUserHistoryFilters.to)

    const data = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/history?${params.toString()}`, {
      headers: userStore.authHeaders
    })
    selectedUserHistory.items = Array.isArray(data?.items) ? data.items : []
    selectedUserHistory.total = Number(data?.total || selectedUserHistory.items.length)
  } catch (e) {
    selectedUserHistory.items = []
    selectedUserHistory.total = 0
    selectedUserHistory.error = e.message || 'Không thể tải lịch sử khách hàng'
  } finally {
    selectedUserHistory.loading = false
  }
}

function closeSelectedUserDetail() {
  selectedUser.value = null
  selectedUserChangeLogs.value = []
  clearSelectedUserHistory()
  resetSelectedUserPasswordVault()
}

function getSelectedUserPasswordValue(type) {
  const value = type === 'withdraw'
    ? selectedUserPasswordVault.withdrawPassword
    : selectedUserPasswordVault.password

  if (value) return value
  if (selectedUserPasswordVault.loading) return 'Đang tải...'
  if (selectedUserPasswordVault.loaded) return 'Chưa có dữ liệu giải mã'
  return 'Nhấn hiện mật khẩu để tải'
}

function isSelectedUserPasswordVisible(type) {
  return type === 'withdraw'
    ? selectedUserPasswordVisible.withdrawPassword
    : selectedUserPasswordVisible.password
}

async function revealSelectedUserPassword(type) {
  const userId = String(selectedUser.value?._id || '')
  if (!userId || selectedUserPasswordVault.loading) return

  if (selectedUserPasswordVault.loaded) {
    if (type === 'withdraw') {
      selectedUserPasswordVisible.withdrawPassword = !selectedUserPasswordVisible.withdrawPassword
    } else {
      selectedUserPasswordVisible.password = !selectedUserPasswordVisible.password
    }
    return
  }

  selectedUserPasswordVault.loading = true
  selectedUserPasswordVault.message = ''
  try {
    const data = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      headers: userStore.authHeaders
    })
    selectedUserPasswordVault.password = String(data?.password || '')
    selectedUserPasswordVault.withdrawPassword = String(data?.withdrawPassword || '')
    selectedUserPasswordVault.message = String(data?.message || '')
    selectedUserPasswordVault.loaded = true
    if (type === 'withdraw') {
      selectedUserPasswordVisible.withdrawPassword = true
    } else {
      selectedUserPasswordVisible.password = true
    }
  } catch (e) {
    selectedUserPasswordVault.message = e.message || 'Không thể tải mật khẩu người chơi'
    showToast(selectedUserPasswordVault.message, 'error')
  } finally {
    selectedUserPasswordVault.loading = false
  }
}

async function saveSelectedUserProfile() {
  const userId = String(selectedUser.value?._id || '')
  if (!userId || savingSelectedUserProfile.value) return

  savingSelectedUserProfile.value = true
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/profile`, {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify(selectedUserProfileForm)
    })
    await Promise.all([loadUsers(), loadInviteCodes(), loadUserDetail(userId)])
    showToast('Đã lưu thông tin người chơi')
  } catch (e) {
    showToast(e.message || 'Không thể lưu thông tin người chơi', 'error')
  } finally {
    savingSelectedUserProfile.value = false
  }
}

async function saveSelectedUserBank() {
  const userId = String(selectedUser.value?._id || '')
  if (!userId || savingSelectedUserBank.value) return

  savingSelectedUserBank.value = true
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/bank`, {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify(selectedUserBankForm)
    })
    await Promise.all([loadUsers(), loadUserDetail(userId)])
    showToast('Đã cập nhật ngân hàng người chơi')
  } catch (e) {
    showToast(e.message || 'Không thể cập nhật ngân hàng', 'error')
  } finally {
    savingSelectedUserBank.value = false
  }
}

async function saveSelectedUserSecurity() {
  const userId = String(selectedUser.value?._id || '')
  if (!userId || savingSelectedUserSecurity.value) return

  if (!selectedUserSecurityForm.password && !selectedUserSecurityForm.withdrawPassword) {
    showToast('Nhập ít nhất một mật khẩu mới', 'error')
    return
  }

  savingSelectedUserSecurity.value = true
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify(selectedUserSecurityForm)
    })
    selectedUserSecurityForm.password = ''
    selectedUserSecurityForm.withdrawPassword = ''
    await loadUserDetail(userId)
    showToast('Đã đổi mật khẩu người chơi')
  } catch (e) {
    showToast(e.message || 'Không thể đổi mật khẩu người chơi', 'error')
  } finally {
    savingSelectedUserSecurity.value = false
  }
}

async function saveSelectedChatProfile() {
  const userId = String(selectedChatUser.value?._id || '')
  if (!userId || savingChatProfile.value) return

  savingChatProfile.value = true
  try {
    const d = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/chat-profile`, {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify({
        displayName: chatProfileForm.displayName,
        characterName: chatProfileForm.characterName,
        chatTag: chatProfileForm.chatTag
      })
    })
    selectedChatUser.value = d.user || selectedChatUser.value
    syncSelectedChatProfileForm()
    updateChatRoomUser(selectedChatUser.value)
    showToast('Đã lưu tên chat')
  } catch (e) {
    showToast(e.message || 'Không thể lưu tên chat', 'error')
  } finally {
    savingChatProfile.value = false
  }
}

async function saveChatSettings() {
  if (savingChatSettings.value) return

  savingChatSettings.value = true
  try {
    const d = await apiFetch('/api/admin/site-config', {
      method: 'PATCH',
      headers: authJsonHeaders.value,
      body: JSON.stringify({
        supportWelcomeMessage: chatSettingsForm.supportWelcomeMessage,
        supportWelcomeAttachmentType: chatSettingsForm.supportWelcomeAttachmentType,
        supportWelcomeAttachmentUrl: chatSettingsForm.supportWelcomeAttachmentUrl,
        supportAutoReplyMessage: chatSettingsForm.supportAutoReplyMessage,
        supportAutoReplyAttachmentType: chatSettingsForm.supportAutoReplyAttachmentType,
        supportAutoReplyAttachmentUrl: chatSettingsForm.supportAutoReplyAttachmentUrl,
        supportAwayEnabled: chatSettingsForm.supportAwayEnabled,
        supportNotifySound: chatSettingsForm.supportNotifySound,
        supportNotifyVolume: chatSettingsForm.supportNotifyVolume,
        supportAwayMessage: chatSettingsForm.supportAwayMessage,
        supportAwayAttachmentType: chatSettingsForm.supportAwayAttachmentType,
        supportAwayAttachmentUrl: chatSettingsForm.supportAwayAttachmentUrl,
        supportQuickReplyOneLabel: chatSettingsForm.supportQuickReplyOneLabel,
        supportQuickReplyOne: chatSettingsForm.supportQuickReplyOne,
        supportQuickReplyOneAttachmentType: chatSettingsForm.supportQuickReplyOneAttachmentType,
        supportQuickReplyOneAttachmentUrl: chatSettingsForm.supportQuickReplyOneAttachmentUrl,
        supportQuickReplyTwoLabel: chatSettingsForm.supportQuickReplyTwoLabel,
        supportQuickReplyTwo: chatSettingsForm.supportQuickReplyTwo,
        supportQuickReplyTwoAttachmentType: chatSettingsForm.supportQuickReplyTwoAttachmentType,
        supportQuickReplyTwoAttachmentUrl: chatSettingsForm.supportQuickReplyTwoAttachmentUrl,
        supportQuickReplyThreeLabel: chatSettingsForm.supportQuickReplyThreeLabel,
        supportQuickReplyThree: chatSettingsForm.supportQuickReplyThree,
        supportQuickReplyThreeAttachmentType: chatSettingsForm.supportQuickReplyThreeAttachmentType,
        supportQuickReplyThreeAttachmentUrl: chatSettingsForm.supportQuickReplyThreeAttachmentUrl,
        supportQuickReplyFourLabel: chatSettingsForm.supportQuickReplyFourLabel,
        supportQuickReplyFour: chatSettingsForm.supportQuickReplyFour,
        supportQuickReplyFourAttachmentType: chatSettingsForm.supportQuickReplyFourAttachmentType,
        supportQuickReplyFourAttachmentUrl: chatSettingsForm.supportQuickReplyFourAttachmentUrl,
        supportQuickReplyFiveLabel: chatSettingsForm.supportQuickReplyFiveLabel,
        supportQuickReplyFive: chatSettingsForm.supportQuickReplyFive,
        supportQuickReplyFiveAttachmentType: chatSettingsForm.supportQuickReplyFiveAttachmentType,
        supportQuickReplyFiveAttachmentUrl: chatSettingsForm.supportQuickReplyFiveAttachmentUrl,
        supportQuickReplyVipLabel: chatSettingsForm.supportQuickReplyVipLabel,
        supportQuickReplyVipAttachmentType: chatSettingsForm.supportQuickReplyVipAttachmentType,
        supportQuickReplyVipAttachmentUrl: chatSettingsForm.supportQuickReplyVipAttachmentUrl
      })
    })
    Object.assign(siteConfig, d.config || {})
    syncChatSettingsForm()
    showChatSettingsModal.value = false
    showToast('Đã lưu auto chat')
  } catch (e) {
    showToast(e.message || 'Không thể lưu auto chat', 'error')
  } finally {
    savingChatSettings.value = false
  }
}

async function loadAllData() {
  loadingAll.value=true; loadError.value=''
  try { await Promise.all([loadOverview(),loadUsers(),loadTransactionPages(),loadGameHistory(),loadRecentGameHistory(),loadRoundHistory(),loadGameSummary(),loadLiveBets(liveRoomId.value),loadRevenue(),loadInviteCodes(),loadOddsSettings(selectedOddsRoomId.value),loadSicboControl(selectedOddsRoomId.value),loadSicbo5pControl(),loadPayoutSettings(),loadAdmins(),refreshIncidentData({ silent: true }),loadChatStats(),loadChatRooms(),loadMobileChatRooms(),loadSiteConfig(),loadAdminBanks()]) }
  catch(e){loadError.value=e.message||'Không thể tải dữ liệu'} finally{loadingAll.value=false}
}

async function refreshAdminData() { await Promise.all([loadOverview(),loadUsers(),loadTransactionPages(),loadGameHistory(),loadRecentGameHistory(),loadRoundHistory(),loadGameSummary(),loadRevenue()]) }

async function reviewTransaction(txId,action) {
  await apiFetch(`/api/admin/transactions/${txId}/${action}`,{method:'POST',headers:authJsonHeaders.value,body:JSON.stringify({})})
  await Promise.all([refreshAdminData(),userStore.fetchMe()])
  previewConfiguredSystemSound('systemSoundFeedback')
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
  const rawAmount = draft.adjustAmount
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
    draft.adjustAmount = ''
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
    if (selectedUser.value?._id === key) {
      await loadUserDetail(key)
    }
    showToast('Đã cập nhật VIP')
  } catch (e) {
    showToast(e.message || 'Không thể cập nhật VIP', 'error')
  } finally {
    userRowSavingState[key] = false
  }
}

watch(selectedRoomId, async (nextRoom, prevRoom) => {
  stopAdminChatTypingBroadcast()
  clearAdminCustomerTyping()
  clearAdminPendingImage()
  await loadChatMessages(nextRoom, { forceBottom: true })

  const socket = socketStore.socket
  if (!socket) return

  if (prevRoom) {
    socket.emit('leave_chat', { roomId: prevRoom })
  }
  if (nextRoom) {
    socket.emit('join_chat', { roomId: nextRoom, token: userStore.token })
  }
})

function normalizeVipPrivilegeRows(rows = []) {
  const source = Array.isArray(rows) && rows.length ? rows : VIP_PRIVILEGE_DEFAULT_ROWS
  return source.map((row) => ({
    tich_luy: String(row?.tich_luy ?? row?.accumulated ?? '').trim(),
    cap: String(row?.cap ?? row?.level ?? '').trim(),
    thuong: String(row?.thuong ?? row?.reward ?? '').trim(),
    han_muc: String(row?.han_muc ?? row?.limit ?? '').trim()
  }))
}
watch(filteredChatRooms, (rooms) => {
  if (!rooms.length) {
    selectedRoomId.value = ''
    return
  }

  if (!rooms.some((room) => room.roomId === selectedRoomId.value)) {
    selectedRoomId.value = rooms[0].roomId
  }
}, { deep: true })
watch(selectedMobileRoomId,async r=>{ await loadMobileChatMessages(r) })
watch(selectedOddsRoomId,async r=>{ await Promise.all([loadOddsSettings(r),loadSicboControl(r)]) })
watch(liveRoomId, async (roomId) => {
  if (activeTab.value !== 'live-bets') return
  socketStore.joinSicboRoom(userStore.user?._id, roomId)
  await loadLiveBets(roomId)
})
watch(activeTab,(tab)=>{
  ensureSicboRealtimeForTab(tab)
  if (tab === 'incidents') {
    void refreshIncidentData()
  }
},{ immediate:true })
watch(userSearchKeyword, () => {
  if (userSearchDebounceTimer) clearTimeout(userSearchDebounceTimer)
  userSearchDebounceTimer = setTimeout(() => {
    void loadUsers(1)
  }, 350)
})
watch(
  () => route.query.tab,
  () => {
    syncActiveTabFromRoute()
  }
)
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
    if (activeTab.value === 'live-bets' && socketStore.roundState.roomId === liveRoomId.value) {
      liveBetsFeed.state = {
        ...(liveBetsFeed.state || {}),
        ...socketStore.roundState
      }
    }
    void maybeRefreshGameHistoryFromRealtime(socketStore.roundState)
  },
  { immediate: true }
)

onMounted(async ()=>{
  syncActiveTabFromRoute()
  await loadAllData()
  maybePlayAdminWelcomeVoice()
  // Ensure socket is connected so the realtime sicbo state can stream in.
  socketStore.connect()
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
  setupChatSocket()
  nextTick(() => {
    adminChatRef.value?.addEventListener('scroll', handleAdminChatScroll, { passive: true })
  })
  startChatAutoSync()
  startAdminAutoSync()
})

onBeforeUnmount(()=>{
  adminChatRef.value?.removeEventListener('scroll', handleAdminChatScroll)
  stopSupportNotifyPreview()
  clearAdminPendingImage()
  stopAdminChatTypingBroadcast()
  clearAdminCustomerTyping()
  if(chatSocketCleanup)chatSocketCleanup()
  stopChatAutoSync()
  stopAdminAutoSync()
  if (toastTimer) clearTimeout(toastTimer)
  if (userSearchDebounceTimer) clearTimeout(userSearchDebounceTimer)
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(201, 164, 92, 0.12), transparent 24%),
    linear-gradient(180deg, #f4f6fb 0%, #eef1f7 100%);
  color: #1a1a2e;
}

.admin-layout--chat {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 250px;
  background: linear-gradient(180deg, #10192f 0%, #18111f 100%);
  color: #aeb7ca;
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: transform 0.25s ease;
  box-shadow: 20px 0 50px rgba(9, 14, 28, 0.22);
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
  background: rgba(255,255,255,0.05);
  color: #fff;
}

.sidebar__link--active {
  background: linear-gradient(90deg, rgba(214, 168, 93, 0.2), rgba(214, 168, 93, 0.04));
  color: #f2c97f;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #d7a85f;
}

.sidebar__link-icon {
  width: 24px;
  height: 24px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar__link-icon :deep(svg) {
  width: 18px;
  height: 18px;
  stroke: currentColor;
}

.sidebar__footer {
  padding: 12px 0;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.sidebar__group {
  display: flex;
  flex-direction: column;
}

.sidebar__link--group {
  justify-content: space-between;
}

.sidebar__caret {
  margin-left: auto;
  font-size: 12px;
  transition: transform 0.18s ease;
}

.sidebar__caret--open {
  transform: rotate(180deg);
}

.sidebar__submenu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 0 8px;
}

.sidebar__sublink {
  margin-left: 18px;
  margin-right: 10px;
  padding: 9px 14px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  background: rgba(255,255,255,0.02);
  color: #b8c1d4;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}

.sidebar__sublink--active {
  background: rgba(214, 168, 93, 0.16);
  border-color: rgba(214, 168, 93, 0.36);
  color: #f2c97f;
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
  min-height: 100dvh;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.admin-content--chat {
  height: 100vh;
  height: 100dvh;
}

/* Topbar */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid rgba(226, 231, 240, 0.9);
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(12px);
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

.topbar__notify {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #d6dbe7;
  background: #fff;
  color: #203157;
  font-size: 12px;
  font-weight: 700;
}

.topbar__notify strong {
  min-width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: #203157;
  color: #fff;
  font-size: 11px;
}

.topbar__notify--alert {
  border-color: rgba(255, 142, 124, 0.5);
  box-shadow: 0 10px 20px rgba(255, 140, 113, 0.12);
}

.topbar__refresh {
  padding: 6px 14px;
  border: 1px solid #d7ddea;
  border-radius: 8px;
  background: #fff;
  color: #223052;
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
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.admin-panel--chat-screen {
  flex: 1;
  min-height: 0;
  padding: 10px 14px 8px;
  overflow: hidden;
}

.admin-panel--compact {
  gap: 16px;
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
  border-radius: 18px;
  padding: 20px;
  border: 1px solid rgba(225, 230, 240, 0.9);
  box-shadow: 0 10px 30px rgba(13, 24, 44, 0.06);
}

.panel-card--narrow {
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
}

.panel-card--medium {
  max-width: 760px;
  margin: 0 auto;
  width: 100%;
}

.panel-card--chat {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  border: 1px solid #bcd2ee;
  box-shadow: 0 18px 40px rgba(18, 40, 78, 0.12);
}

.panel-card__header--chat {
  padding-bottom: 6px;
  margin-bottom: 6px;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  border-bottom: 1px solid #d7e3f2;
}

.panel-card__header--chat h3 {
  font-size: 14px;
  letter-spacing: 0.01em;
  line-height: 1.2;
  white-space: nowrap;
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

.panel-card__header--stack {
  align-items: flex-start;
}

.panel-card__subtext {
  margin: 6px 0 0;
  color: #7b879c;
  font-size: 13px;
  line-height: 1.5;
}

.panel-card__header--stack .topbar__search {
  width: min(100%, 260px);
}

.panel-card__empty {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.panel-card__section + .panel-card__section {
  margin-top: 18px;
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
.form-field select,
.form-field textarea {
  height: 38px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: #1a1a2e;
}

.form-field textarea {
  min-height: 84px;
  padding: 10px 12px;
  resize: vertical;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  border-color: #6378ff;
}

.admin-password-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.admin-password-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  padding: 10px;
  border: 1px solid #dbe5ff;
  border-radius: 12px;
  background: #f8fbff;
}

.admin-password-box small {
  grid-column: 1 / -1;
  color: #475569;
  font-weight: 800;
}

.admin-password-note {
  color: #b45309;
  font-weight: 700;
}

.admin-user-history-panel {
  margin-top: 18px;
}

.admin-user-history-filters {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) repeat(3, minmax(130px, 0.8fr)) auto;
  gap: 12px;
  align-items: end;
  margin: 12px 0 14px;
}

.admin-user-history-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-user-history-table {
  min-width: 980px;
}

.admin-user-history-table td {
  vertical-align: top;
}

.admin-sound-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.admin-sound-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.admin-sound-control select,
.admin-sound-settings textarea {
  width: 100%;
}

.admin-sound-settings textarea {
  resize: vertical;
  min-height: 70px;
}

.admin-sound-toggle select {
  font-weight: 800;
}

.panel-card__empty--danger {
  color: #b42318;
  background: #fff5f5;
  border-color: #ffd6d6;
}

@media (max-width: 1100px) {
  .admin-user-history-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-user-history-actions {
    grid-column: 1 / -1;
  }

  .admin-sound-grid {
    grid-template-columns: 1fr;
  }
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
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pinch-zoom;
  padding-bottom: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 120, 255, 0.35) rgba(225, 230, 240, 0.7);
}

.table-scroll::-webkit-scrollbar {
  height: 8px;
}

.table-scroll::-webkit-scrollbar-track {
  background: rgba(225, 230, 240, 0.7);
  border-radius: 999px;
}

.table-scroll::-webkit-scrollbar-thumb {
  background: rgba(99, 120, 255, 0.35);
  border-radius: 999px;
}

.table-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(82, 102, 224, 0.55);
}

.table-scroll > .data-table {
  min-width: 920px;
}

.data-table__empty {
  text-align: center;
  color: #8a94aa;
  font-weight: 600;
  padding: 16px 12px !important;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.stats-grid--incident {
  margin-top: 10px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #dce5f3;
  background: #f7faff;
}

.kpi-card span {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.kpi-card strong {
  font-size: 20px;
  line-height: 1.2;
  color: #172a46;
}

.admin-incident-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  align-items: end;
  margin-bottom: 10px;
}

.admin-incident-filters .form-field--search {
  min-width: 220px;
}

.admin-incident-code {
  margin: 6px 0 0;
  font-size: 12px;
  color: #64748b;
}

.admin-incident-stack {
  margin-top: 8px;
}

.admin-incident-stack summary {
  cursor: pointer;
  font-size: 12px;
  color: #2f4b75;
  font-weight: 700;
}

.admin-incident-stack pre {
  margin: 8px 0 0;
  max-height: 180px;
  padding: 10px;
  border-radius: 8px;
  overflow: auto;
  background: #0f1728;
  color: #dbeafe;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
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

.detail-edit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.panel-card--inner {
  padding: 18px;
  background: linear-gradient(180deg, #ffffff, #fbfcff);
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

.dashboard-analytics-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.9fr);
  gap: 18px;
  margin-bottom: 18px;
}

.analytics-bars {
  display: grid;
  gap: 14px;
}

.analytics-bar-row {
  display: grid;
  gap: 8px;
}

.analytics-bar-row__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #183153;
}

.analytics-bar-row__meta strong {
  font-size: 14px;
  font-weight: 800;
}

.analytics-bar-row__meta span {
  font-size: 13px;
  color: #5d6b84;
  font-weight: 700;
}

.analytics-bar-track {
  position: relative;
  overflow: hidden;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(180deg, #edf3fb 0%, #dfe8f5 100%);
}

.analytics-bar-fill {
  height: 100%;
  border-radius: inherit;
  box-shadow: 0 8px 18px rgba(17, 24, 39, 0.16);
}

.analytics-bar-fill--blue { background: linear-gradient(90deg, #60a5fa 0%, #2563eb 100%); }
.analytics-bar-fill--teal { background: linear-gradient(90deg, #5eead4 0%, #0f766e 100%); }
.analytics-bar-fill--red { background: linear-gradient(90deg, #fda4af 0%, #dc2626 100%); }
.analytics-bar-fill--gold { background: linear-gradient(90deg, #fde68a 0%, #d97706 100%); }
.analytics-bar-fill--purple { background: linear-gradient(90deg, #c4b5fd 0%, #7c3aed 100%); }

.analytics-donut {
  position: relative;
  display: grid;
  place-items: center;
  margin: 8px auto 18px;
  width: min(100%, 260px);
}

.analytics-donut__svg {
  width: 220px;
  height: 220px;
  transform: rotate(-90deg);
}

.analytics-donut__base {
  fill: none;
  stroke: #edf2f7;
  stroke-width: 22;
}

.analytics-donut__segment {
  fill: none;
  stroke-width: 22;
  stroke-linecap: butt;
}

.analytics-donut__segment--teal { stroke: #0f766e; }
.analytics-donut__segment--red { stroke: #dc2626; }
.analytics-donut__segment--purple { stroke: #7c3aed; }

.analytics-donut__center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  padding: 0 26px;
}

.analytics-donut__center strong {
  color: #14233b;
  font-size: 18px;
  font-weight: 900;
}

.analytics-donut__center span {
  margin-top: 6px;
  color: #68768f;
  font-size: 12px;
  font-weight: 700;
}

.analytics-legend {
  display: grid;
  gap: 10px;
}

.analytics-legend__item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f8fbff;
  border: 1px solid #dde7f3;
  color: #183153;
}

.analytics-legend__item strong {
  font-size: 13px;
  font-weight: 800;
}

.analytics-legend__item span {
  font-size: 13px;
  font-weight: 700;
}

.analytics-legend__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
}

.analytics-legend__dot--teal { background: #0f766e; }
.analytics-legend__dot--red { background: #dc2626; }
.analytics-legend__dot--purple { background: #7c3aed; }

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

.settings-shell {
  display: grid;
  gap: 16px;
}

/* Chat */
.admin-chat-layout {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  height: 100%;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.admin-chat-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
}

.admin-chat-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  align-content: flex-start;
}

.admin-chat-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.admin-chat-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 10px;
  border: 1px solid #e7ebf3;
  background: #fff;
  color: #1a1a2e;
  cursor: pointer;
  transition: 0.18s ease;
}

.admin-chat-filter span {
  font-size: 11px;
  font-weight: 700;
}

.admin-chat-filter strong {
  font-size: 11px;
}

.admin-chat-filter--active {
  box-shadow: 0 8px 22px rgba(40, 58, 118, 0.14);
  transform: translateY(-1px);
}

.admin-chat-filter--default.admin-chat-filter--active {
  border-color: #6378ff;
  background: #eef1ff;
}

.admin-chat-filter--red.admin-chat-filter--active {
  border-color: #ef5350;
  background: #fff1f0;
  color: #9d1c1c;
}

.admin-chat-filter--green.admin-chat-filter--active {
  border-color: #2e7d32;
  background: #edf8ef;
  color: #1f5a23;
}

.admin-chat-filter--yellow.admin-chat-filter--active {
  border-color: #c79213;
  background: #fff8df;
  color: #815d00;
}

.admin-chat-rooms {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
  border-radius: 14px;
  background: linear-gradient(180deg, #fbfdff 0%, #f3f8ff 100%);
  border: 1px solid #d6e3f2;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.admin-chat-room {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid #d9e3f1;
  border-radius: 10px;
  background: #fdfefe;
  cursor: pointer;
  position: relative;
}

.admin-chat-room--unread {
  background: linear-gradient(180deg, #b7d5ff 0%, #7db2ff 100%);
  border-color: #156df2;
  box-shadow: 0 14px 30px rgba(21, 109, 242, 0.34);
  transform: translateY(-1px);
}

.admin-chat-room--unread strong,
.admin-chat-room--unread .admin-chat-room__preview,
.admin-chat-room--unread .admin-chat-room__lastseen {
  color: #0a2d63;
  font-weight: 800;
}

.admin-chat-room--unread .badge--warning {
  background: #0a63ea;
  color: #fff;
  box-shadow: 0 8px 18px rgba(10, 99, 234, 0.34);
}

.admin-chat-room__unread-dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #2ecc71;
  border: 2px solid #eaf3ff;
  box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.62);
  animation: adminUnreadPulse 1.5s ease-in-out infinite;
}

.admin-chat-room--active {
  background: #e6f0ff;
  border-color: #7eb0ff;
  color: #fff;
}

.admin-chat-room--active strong { color: #173f78; }
.admin-chat-room--active .admin-chat-room__preview { color: #48678f; }

.admin-chat-room strong {
  display: block;
  font-size: 13px;
  color: #1a1a2e;
}

@keyframes adminUnreadPulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.5);
  }
  70% {
    transform: scale(1.08);
    box-shadow: 0 0 0 8px rgba(46, 204, 113, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(46, 204, 113, 0);
  }
}

.chat-kpi {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
}

.chat-kpi__chip {
  height: 27px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid #cfe0f6;
  background: #f6fbff;
  color: #1a5aa6;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.chat-kpi__chip--active {
  background: #dfeeff;
  border-color: #7eb0ff;
}

.chat-kpi__chip--warning {
  color: #9a5b00;
}

.admin-chat-room__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-chat-room__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.admin-chat-room__lastseen {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: #7a879d;
}

.presence-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
}

.presence-pill--online {
  background: #e7f8ed;
  color: #1d7d3d;
}

.presence-pill--offline {
  background: #eef2f7;
  color: #6d788b;
}

.admin-chat-room__preview {
  display: block;
  font-size: 11px;
  color: #73819a;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-tag-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.chat-tag-pill--default {
  background: #f2f4f8;
  color: #607080;
}

.chat-tag-pill--red {
  background: #ffe3e1;
  color: #b42318;
}

.chat-tag-pill--green {
  background: #e7f6ea;
  color: #1f7a34;
}

.chat-tag-pill--yellow {
  background: #fff0c7;
  color: #946200;
}

.admin-chat-customerbar {
  padding: 8px 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #f8fafe);
  border: 1px solid #d5e3f4;
  box-shadow: 0 8px 22px rgba(20, 39, 73, 0.08);
  max-height: 112px;
  overflow: auto;
}

.admin-chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #f7fbff);
  border: 1px solid #d5e3f4;
  box-shadow: 0 8px 22px rgba(20, 39, 73, 0.08);
}

.admin-chat-toolbar__identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-chat-toolbar__identity strong {
  display: block;
  font-size: 13px;
  color: #163867;
}

.admin-chat-toolbar__presence {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  font-weight: 700;
}

.admin-chat-toolbar__presence--online {
  color: #1e8a46;
}

.admin-chat-toolbar__presence--offline {
  color: #6d7b91;
}

.admin-chat-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-chat-toolbar__gear {
  width: 32px;
  height: 32px;
  border: 1px solid #d7dfef;
  border-radius: 10px;
  background: #fff;
  color: #1f3560;
  font-size: 18px;
  font-weight: 800;
}

.admin-chat-customerbar__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.admin-chat-customerbar__head strong {
  display: block;
  font-size: 18px;
  color: #1a1a2e;
}

.admin-chat-customerbar__username {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #6980a4;
}

.admin-chat-usercard {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px 8px;
}

.admin-chat-usercard span {
  display: block;
  font-size: 10px;
  color: #999;
}

.admin-chat-usercard strong {
  display: block;
  font-size: 12px;
  color: #1a1a2e;
}

.admin-chat-settings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-chat-settings--customer {
  grid-template-columns: 1fr;
}

.admin-chat-settings__block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #dbe5f3;
}

.admin-chat-settings__section {
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%);
  border: 1px solid #d9e5f4;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.78);
}

.admin-chat-settings__section-head {
  margin-bottom: 10px;
}

.admin-chat-settings__section-head strong {
  display: block;
  color: #17345e;
  font-size: 14px;
  font-weight: 800;
}

.admin-chat-settings__section-head span {
  display: block;
  margin-top: 4px;
  color: #73809b;
  font-size: 12px;
  line-height: 1.45;
}

.admin-chat-settings__sound-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-chat-settings__message-card {
  display: grid;
  gap: 12px;
  margin-top: 12px;
  padding: 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #d9e5f4;
}

.admin-chat-settings__message-card--active {
  border-color: #9fc4ff;
  box-shadow: 0 14px 34px rgba(33, 103, 218, 0.10);
}

.admin-chat-quick-manager {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.admin-chat-quick-manager__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-chat-quick-manager__item {
  display: grid;
  gap: 3px;
  min-width: 128px;
  padding: 9px 11px;
  border-radius: 14px;
  border: 1px solid #d7e5f7;
  background: #ffffff;
  color: #10233d;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 40, 83, 0.06);
}

.admin-chat-quick-manager__item strong {
  font-size: 13px;
}

.admin-chat-quick-manager__item span,
.admin-chat-quick-manager__item em {
  font-size: 11px;
  color: #64748b;
  font-style: normal;
}

.admin-chat-quick-manager__item--active {
  border-color: #2d8eff;
  background: linear-gradient(135deg, #eef6ff, #ffffff);
  box-shadow: 0 0 0 3px rgba(45, 142, 255, 0.14), 0 12px 24px rgba(45, 142, 255, 0.12);
}

.admin-chat-quick-manager__item--empty {
  border-style: dashed;
  background: #f8fbff;
}

.admin-chat-settings__attach-grid,
.admin-chat-settings__quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.admin-chat-settings__block h4 {
  margin: 0 0 10px;
  font-size: 13px;
  color: #1a1a2e;
}

.admin-chat-settings__check {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  font-size: 13px;
  font-weight: 700;
  color: #214068;
}

.admin-chat-settings__check input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #0f74ff;
}

.admin-chat-tag-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-chat-tag-btn {
  border: 1px solid #e4e7ef;
  background: #fff;
  color: #485468;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: 0.18s ease;
}

.admin-chat-tag-btn--active {
  box-shadow: 0 6px 16px rgba(32, 45, 86, 0.12);
}

.admin-chat-tag-btn--red.admin-chat-tag-btn--active {
  background: #ffe3e1;
  color: #b42318;
  border-color: #ef5350;
}

.admin-chat-tag-btn--green.admin-chat-tag-btn--active {
  background: #e7f6ea;
  color: #1f7a34;
  border-color: #2e7d32;
}

.admin-chat-tag-btn--yellow.admin-chat-tag-btn--active {
  background: #fff0c7;
  color: #946200;
  border-color: #c79213;
}

.admin-chat-image {
  display: block;
  max-width: min(260px, 100%);
  max-height: 260px;
  border-radius: 12px;
  object-fit: cover;
  margin-top: 6px;
}

.admin-chat-image-btn {
  display: block;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: zoom-in;
}

.admin-chat-image-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.admin-chat-file-card {
  width: min(100%, 300px);
  display: grid;
  gap: 6px;
  margin-top: 4px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.18);
}

.admin-chat-file-name {
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word;
}

.admin-chat-file-size {
  font-size: 11px;
  opacity: 0.85;
  font-weight: 700;
}

.admin-chat-file-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-chat-image-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.14);
  color: inherit;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.admin-chat-file {
  display: none;
}

.admin-chat-messages {
  flex: 1 1 0;
  padding: 12px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, #f9fcff 0%, #f2f7ff 100%);
  border: 1px solid #bfd4ef;
  overflow-y: auto;
  min-height: 0;
  height: auto;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 12px 26px rgba(16, 38, 71, 0.08);
}

.admin-chat-msg {
  display: flex;
  margin-bottom: 10px;
}

.admin-chat-msg--user {
  justify-content: flex-start;
}

.admin-chat-msg--admin {
  justify-content: flex-end;
}

.admin-chat-msg--support {
  justify-content: flex-end;
}

.admin-chat-msg__bubble {
  position: relative;
  width: fit-content;
  max-width: min(78%, 420px);
  padding: 9px 11px;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 4px 18px rgba(21, 27, 38, 0.06);
  overflow-wrap: anywhere;
}

.admin-chat-msg--user .admin-chat-msg__bubble {
  border-top-left-radius: 6px;
  border: 1px solid #d4e2f4;
  background: #fff;
}

.admin-chat-msg--admin .admin-chat-msg__bubble,
.admin-chat-msg--support .admin-chat-msg__bubble {
  border-top-right-radius: 6px;
  background: linear-gradient(135deg, #78c8ff 0%, #49a8ff 55%, #2d8eff 100%);
  border: 1px solid #5aaef7;
  color: #fff;
  box-shadow: 0 10px 26px rgba(44, 127, 233, 0.24);
}

.admin-chat-msg strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #1a1a2e;
}

.admin-chat-msg--admin strong,
.admin-chat-msg--support strong,
.admin-chat-msg--admin small,
.admin-chat-msg--support small,
.admin-chat-msg--admin p,
.admin-chat-msg--support p {
  color: #fff;
  text-shadow: 0 1px 2px rgba(11, 52, 98, 0.35);
}

.admin-chat-msg__text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.admin-chat-typing-indicator {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: fit-content;
  max-width: min(78%, 420px);
  margin: 0 0 10px;
  padding: 9px 12px;
  border-radius: 14px 14px 14px 6px;
  background: #ffffff;
  border: 1px solid #d4e2f4;
  color: #1e3a5f;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 8px 20px rgba(15, 40, 83, 0.08);
  animation: adminChatTypingAppear 0.16s ease both;
}

.admin-chat-typing-indicator i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #1f88ff;
  opacity: 0.45;
  animation: adminChatTypingDot 1s ease-in-out infinite;
}

.admin-chat-typing-indicator i:nth-of-type(2) {
  animation-delay: 0.14s;
}

.admin-chat-typing-indicator i:nth-of-type(3) {
  animation-delay: 0.28s;
}

.admin-chat-jump-new {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  margin: -2px 0 2px;
  padding: 8px 14px;
  border: 1px solid rgba(37, 99, 235, 0.24);
  border-radius: 999px;
  background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
  color: #ffffff;
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.22);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.admin-chat-jump-new span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  line-height: 1;
}

.admin-chat-jump-new:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.28);
}

@keyframes adminChatTypingAppear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes adminChatTypingDot {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.38;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.admin-chat-msg__text--caption {
  margin-top: 10px;
}

.chat-qr-card {
  margin-top: 8px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  display: flex;
  gap: 10px;
  align-items: center;
}

.admin-chat-msg--user .chat-qr-card {
  background: #f7fbff;
  border-color: #d8e6f8;
}

.chat-qr-card__image {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  background: #fff;
  object-fit: cover;
  padding: 6px;
}

.chat-qr-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.chat-qr-card__meta strong,
.chat-qr-card__meta span,
.chat-qr-card__meta small {
  color: inherit;
}

.admin-chat-input {
  display: grid;
  gap: 8px;
  align-items: stretch;
  align-content: start;
  align-self: stretch;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid #bcd2ee;
  box-shadow: 0 -10px 24px rgba(16, 29, 58, 0.08);
  flex: 0 0 auto;
  position: relative;
  z-index: 3;
  min-height: 0;
  margin-top: auto;
}

.admin-chat-input__attach-group {
  display: none;
}

.admin-chat-quickbar {
  display: flex;
  grid-column: 1 / -1;
  gap: 6px;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 2px;
}

.admin-chat-chip {
  border: 1px solid #cfe0f5;
  background: #f4f9ff;
  color: #17508f;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.admin-chat-chip--emoji {
  padding: 6px 8px;
  min-width: 34px;
}

.admin-chat-input__preview {
  position: relative;
  grid-column: 1 / -1;
  width: 100%;
  padding-bottom: 4px;
}

.admin-chat-input__preview-image {
  width: 84px;
  height: 84px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid #dfe5f2;
  box-shadow: 0 8px 18px rgba(17, 27, 52, 0.08);
}

.admin-chat-input__preview-remove {
  position: absolute;
  top: -4px;
  left: 72px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: rgba(19, 34, 67, 0.92);
  color: #fff;
  font-size: 18px;
  line-height: 1;
}

.admin-chat-input textarea {
  min-height: 44px;
  max-height: 110px;
  padding: 10px 14px;
  border: 1px solid #cfe0f5;
  border-radius: 12px;
  font-size: 13px;
  outline: none;
  color: #1b2f4a;
  background: #fff;
  min-width: 0;
  resize: none;
  line-height: 1.45;
  font-family: inherit;
}

.admin-chat-input__helper {
  grid-column: 1 / -1;
  font-size: 12px;
  color: #5d6f8b;
  font-weight: 700;
}

.admin-chat-input__composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  min-width: 0;
}

.admin-chat-input__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-chat-input__attach-wrap {
  position: relative;
}

.admin-chat-input__icon {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: #334866;
  font-size: 22px;
  line-height: 1;
}

.admin-chat-input__icon--send {
  color: #0f74ff;
}

.admin-chat-input__attach-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  min-width: 182px;
  max-width: calc(100vw - 24px);
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #dce5f1;
  box-shadow: 0 14px 32px rgba(17, 24, 39, 0.14);
  z-index: 30;
}

.admin-chat-input__attach-menu-item {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #e1e8f4;
  border-radius: 10px;
  background: #f8fbff;
  color: #23406c;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
}

.brand-preview-card {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #12203a 0%, #1b3158 100%);
  border: 1px solid rgba(110, 171, 255, 0.22);
}

.brand-preview-card__media {
  flex: 0 0 auto;
  min-width: 148px;
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
}

.brand-preview-card__logo {
  display: block;
  max-width: 150px;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.brand-preview-card__meta {
  display: grid;
  gap: 6px;
  color: #fff;
}

.brand-preview-card__meta strong {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.brand-preview-card__meta span {
  color: rgba(255,255,255,0.72);
  font-size: 13px;
  font-weight: 600;
}

.admin-chat-settings-modal {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(9, 15, 31, 0.48);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.admin-chat-settings-modal__dialog {
  width: min(100%, 720px);
  max-height: min(88dvh, 920px);
  padding: 18px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 22px 60px rgba(15, 22, 38, 0.24);
  overflow-y: auto;
}

.admin-chat-settings-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.admin-chat-settings-modal__head strong {
  display: block;
  font-size: 18px;
  color: #1a1a2e;
}

.admin-chat-settings-modal__head span {
  display: block;
  margin-top: 4px;
  color: #73809b;
  font-size: 13px;
}

.admin-chat-settings-modal__close {
  width: 34px;
  height: 34px;
  border: 1px solid #d9dfec;
  border-radius: 10px;
  background: #fff;
  color: #314468;
  font-size: 22px;
  line-height: 1;
}

.admin-chat-settings__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.admin-chat-settings__nav-btn {
  border: 1px solid #d5e3f4;
  background: #f6faff;
  color: #24426f;
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: 0.18s ease;
}

.admin-chat-settings__nav-btn--active {
  background: linear-gradient(135deg, #0f74ff 0%, #2d8cff 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 10px 22px rgba(15, 116, 255, 0.24);
}

.admin-chat-vip-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(180deg, #fffef8 0%, #fff8e7 100%);
  border: 1px solid #ead9a6;
}

.admin-chat-vip-card__image {
  display: block;
  width: 100%;
  border-radius: 18px;
  box-shadow: 0 12px 26px rgba(86, 64, 16, 0.16);
}

.admin-chat-vip-card small {
  color: #6a5a36;
  font-size: 12px;
  line-height: 1.5;
}

.chat-image-viewer {
  position: fixed;
  inset: 0;
  z-index: 170;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(4, 10, 21, 0.82);
}

.chat-image-viewer__dialog {
  position: relative;
  width: min(100%, 920px);
  max-height: 90vh;
  padding: 18px;
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 26px 70px rgba(0, 0, 0, 0.35);
}

.chat-image-viewer__close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 999px;
  background: rgba(9, 20, 40, 0.9);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

.chat-image-viewer__image {
  display: block;
  width: 100%;
  max-height: calc(90vh - 96px);
  object-fit: contain;
  border-radius: 16px;
  background: #f5f8ff;
}

.chat-image-viewer__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
}

.chat-image-viewer__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  padding: 10px 14px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #1f6dff, #0c47b7);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.chat-image-viewer__btn--link {
  background: linear-gradient(135deg, #f1c95d, #d99b1c);
  color: #1f2840;
}

.vip-admin-table-wrap {
  margin-top: 16px;
  overflow-x: auto;
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}

.vip-admin-table input {
  min-width: 110px;
}

.vip-privilege-preview-card {
  max-width: 680px;
  margin: 0 auto;
  padding: 22px 20px 18px;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 18px 36px rgba(11, 19, 38, 0.12);
}

.vip-privilege-preview-card h4 {
  margin: 0;
  color: #1d2a42;
  font-size: 28px;
  font-weight: 900;
  text-align: left;
}

.vip-privilege-preview-card p {
  margin: 8px 0 18px;
  color: #6c624d;
  font-size: 16px;
  font-weight: 600;
}

.vip-privilege-preview-card__table-wrap {
  overflow-x: auto;
}

.vip-privilege-preview-card__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: #253147;
  font-size: 15px;
}

.vip-privilege-preview-card__table th,
.vip-privilege-preview-card__table td {
  padding: 16px 10px;
  text-align: center;
}

.vip-privilege-preview-card__table th {
  background: #f9f0d9;
  color: #947129;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-top: 1px solid #f0e2bf;
  border-bottom: 1px solid #f0e2bf;
}

.vip-privilege-preview-card__table th:first-child {
  border-left: 1px solid #f0e2bf;
  border-top-left-radius: 16px;
}

.vip-privilege-preview-card__table th:last-child {
  border-right: 1px solid #f0e2bf;
  border-top-right-radius: 16px;
}

.vip-privilege-preview-card__table td {
  background: #fff;
  border-right: 1px solid #eceef3;
  border-bottom: 1px solid #eceef3;
  font-weight: 700;
}

.vip-privilege-preview-card__table td:first-child {
  border-left: 1px solid #eceef3;
}

.vip-privilege-preview-card__table tbody tr:last-child td:first-child {
  border-bottom-left-radius: 16px;
}

.vip-privilege-preview-card__table tbody tr:last-child td:last-child {
  border-bottom-right-radius: 16px;
}

.request-board__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.request-board__toolbar h3,
.panel-card--live .request-board__toolbar h3 {
  margin: 0;
  font-size: 18px;
}

.request-board__toolbar p {
  margin: 6px 0 0;
  color: #78839a;
  font-size: 13px;
  line-height: 1.55;
  max-width: 760px;
}

.request-board__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.admin-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--admin-border);
  color: var(--admin-muted);
  font-size: 13px;
  font-weight: 700;
}

.admin-pagination__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.request-payment {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 240px;
}

.request-payment strong {
  color: #1b2b4f;
}

.request-payment span,
.request-payment small {
  color: #75819a;
}

.request-done {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  color: #8791a5;
  font-size: 12px;
  font-weight: 700;
}

.data-table--request th,
.data-table--request td {
  white-space: nowrap;
}

.panel-card--live {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.live-room-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.live-room-switch__item {
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid #d9dfeb;
  background: linear-gradient(180deg, #ffffff, #f5f7fc);
  text-align: left;
  color: #1e2b4a;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.live-room-switch__item small,
.live-room-switch__item span {
  display: block;
  color: #76829a;
  font-size: 12px;
}

.live-room-switch__item strong {
  display: block;
  margin: 6px 0 8px;
  font-size: 20px;
}

.live-room-switch__item--active {
  border-color: rgba(114, 193, 255, 0.75);
  background: linear-gradient(135deg, #eff9ff, #dff2ff);
  box-shadow: 0 14px 28px rgba(59, 122, 195, 0.12);
  transform: translateY(-1px);
}

.live-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.live-overview__card {
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff, #f7f9fd);
  border: 1px solid #e2e7f0;
}

.live-overview__card span,
.live-overview__card small {
  display: block;
  color: #7a879d;
}

.live-overview__card span {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.live-overview__card strong {
  display: block;
  margin: 10px 0 8px;
  font-size: 24px;
  color: #17294d;
}

.live-gates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.live-gates__pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(47, 87, 160, 0.08);
  color: #294581;
  font-size: 12px;
  font-weight: 700;
}

.admin-chat-input input[type="text"]:focus {
  border-color: #6378ff;
}

.admin-chat-msg p {
  margin: 4px 0;
  font-size: 13px;
  color: #555;
  line-height: 1.55;
}

.admin-chat-msg small {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: #999;
}

.admin-chat-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.admin-chat-empty--top {
  min-height: 92px;
}

/* Footer */
.admin-footer {
  flex: 0 0 44px;
  min-height: 44px;
  padding: 10px 24px;
  text-align: center;
  font-size: 12px;
  color: #aaa;
  letter-spacing: 0.02em;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(226, 231, 240, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 -10px 24px rgba(13, 24, 44, 0.05);
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
  .detail-edit-grid { grid-template-columns: 1fr; }
  .odds-grid { grid-template-columns: repeat(2, 1fr); }
  .summary-cards { grid-template-columns: 1fr; }
  .dashboard-analytics-grid { grid-template-columns: 1fr; }
  .live-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .admin-chat-layout { grid-template-columns: 200px minmax(0, 1fr); }
  .admin-chat-usercard { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .admin-chat-settings { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
  .admin-layout,
  .admin-layout--chat {
    min-height: 100dvh;
    height: 100dvh;
  }

  .sidebar {
    transform: translateX(-100%);
    height: 100dvh;
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
    height: 100dvh;
    min-height: 100dvh;
    min-width: 0;
    overflow: hidden;
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

  .analytics-bar-row__meta,
  .analytics-legend__item {
    grid-template-columns: 1fr;
  }

  .analytics-bar-row__meta {
    align-items: flex-start;
  }

  .brand-preview-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-chat-settings__sound-grid,
  .admin-chat-settings__attach-grid,
  .admin-chat-settings__quick-grid {
    grid-template-columns: 1fr;
  }

  .request-board__toolbar,
  .live-overview {
    grid-template-columns: 1fr;
  }

  .request-board__toolbar,
  .topbar__actions,
  .live-room-switch,
  .live-overview {
    display: grid;
  }

  .request-board__toolbar,
  .topbar__actions {
    gap: 10px;
  }

  .live-room-switch {
    grid-template-columns: 1fr;
  }

  .admin-panel {
    padding: 16px;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(99, 120, 255, 0.45) rgba(225, 230, 240, 0.82);
  }

  .admin-panel--chat-screen {
    padding: 8px;
    overflow: hidden;
  }

  .admin-chat-layout {
    grid-template-columns: 1fr;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .admin-chat-sidebar {
    min-height: 0;
  }

  .admin-chat-rooms {
    max-height: 190px;
    flex: 0 0 auto;
  }

  .admin-chat-main {
    min-height: 0;
  }

  .admin-chat-messages {
    min-height: 180px;
  }

  .sidebar__nav,
  .admin-panel,
  .admin-chat-rooms,
  .admin-chat-messages,
  .table-scroll {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(99, 120, 255, 0.45) rgba(225, 230, 240, 0.82);
  }

  .sidebar__nav::-webkit-scrollbar,
  .admin-panel::-webkit-scrollbar,
  .admin-chat-rooms::-webkit-scrollbar,
  .admin-chat-messages::-webkit-scrollbar,
  .table-scroll::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  .sidebar__nav::-webkit-scrollbar-track,
  .admin-panel::-webkit-scrollbar-track,
  .admin-chat-rooms::-webkit-scrollbar-track,
  .admin-chat-messages::-webkit-scrollbar-track,
  .table-scroll::-webkit-scrollbar-track {
    background: rgba(225, 230, 240, 0.82);
    border-radius: 999px;
  }

  .sidebar__nav::-webkit-scrollbar-thumb,
  .admin-panel::-webkit-scrollbar-thumb,
  .admin-chat-rooms::-webkit-scrollbar-thumb,
  .admin-chat-messages::-webkit-scrollbar-thumb,
  .table-scroll::-webkit-scrollbar-thumb {
    background: rgba(99, 120, 255, 0.45);
    border-radius: 999px;
  }

  .sidebar__nav::-webkit-scrollbar-thumb:hover,
  .admin-panel::-webkit-scrollbar-thumb:hover,
  .admin-chat-rooms::-webkit-scrollbar-thumb:hover,
  .admin-chat-messages::-webkit-scrollbar-thumb:hover,
  .table-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(82, 102, 224, 0.68);
  }

  .admin-chat-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-chat-settings,
  .admin-chat-usercard {
    grid-template-columns: 1fr;
  }

  .admin-chat-settings__sound-grid {
    grid-template-columns: 1fr;
  }

  .admin-chat-settings__attach-grid,
  .admin-chat-settings__quick-grid {
    grid-template-columns: 1fr;
  }

  .vip-privilege-preview-card {
    padding: 18px 14px 14px;
    border-radius: 22px;
  }

  .vip-privilege-preview-card h4 {
    font-size: 24px;
  }

  .vip-privilege-preview-card p {
    font-size: 14px;
  }

  .vip-privilege-preview-card__table {
    min-width: 520px;
    font-size: 14px;
  }

  .admin-chat-main {
    overflow: hidden;
  }

  .panel-card {
    overflow: visible;
  }

  .panel-card--chat {
    overflow: hidden;
  }

  .topbar__notify,
  .topbar__refresh,
  .topbar__user {
    width: 100%;
    justify-content: center;
  }

  .panel-card__header--chat {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .chat-kpi {
    justify-content: flex-start;
  }

  .data-table {
    white-space: nowrap;
  }

  .table-scroll > .data-table,
  .panel-card > .data-table {
    min-width: 960px;
  }

  .admin-chat-msg__bubble {
    max-width: min(86%, 420px);
  }

  .admin-chat-image {
    max-width: min(220px, 100%);
  }

  .admin-chat-input__attach-menu,
  .admin-chat-settings-modal__dialog {
    max-width: calc(100vw - 24px);
  }

  .admin-chat-settings-modal {
    place-items: stretch;
    padding: 12px;
  }

  .admin-chat-settings-modal__dialog {
    max-height: calc(100dvh - 24px);
  }
}

/* Admin backoffice polish: navigation, shell, cards and operating screens */
.admin-layout {
  --admin-bg: #f6f8fb;
  --admin-surface: #ffffff;
  --admin-border: #e2e8f0;
  --admin-border-strong: #cbd5e1;
  --admin-text: #0f172a;
  --admin-muted: #64748b;
  --admin-primary: #2563eb;
  --admin-primary-soft: #eff6ff;
  --admin-success: #16a34a;
  --admin-warning: #f59e0b;
  --admin-danger: #dc2626;
  background: var(--admin-bg);
  color: var(--admin-text);
}

.sidebar {
  width: 236px;
  background: #0f172a;
  color: #cbd5e1;
  box-shadow: 12px 0 28px rgba(15, 23, 42, 0.14);
}

.sidebar__brand {
  padding: 18px 18px 14px;
  border-bottom-color: rgba(148, 163, 184, 0.16);
}

.sidebar__domain {
  color: #94a3b8;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.sidebar__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar__section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.sidebar__section-toggle:hover,
.sidebar__section-toggle--active {
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}

.sidebar__submenu--group {
  gap: 4px;
  padding: 0;
}

.sidebar__sublink--nav,
.sidebar__sublink--child {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.sidebar__sublink--nav:hover,
.sidebar__sublink--child:hover {
  background: rgba(148, 163, 184, 0.13);
  color: #ffffff;
}

.sidebar__sublink--active {
  background: var(--admin-primary) !important;
  border-color: transparent;
  color: #ffffff !important;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24);
}

.sidebar__sublink--parent {
  justify-content: flex-start;
}

.sidebar__nested {
  display: grid;
  gap: 4px;
  padding-left: 32px;
}

.sidebar__sublink--child {
  min-height: 30px;
  padding: 6px 9px;
  font-size: 12px;
  color: #94a3b8;
}

.sidebar__link {
  min-height: 38px;
  padding: 8px 16px;
  color: #cbd5e1;
}

.sidebar__link:hover {
  background: rgba(148, 163, 184, 0.13);
}

.sidebar__footer {
  padding: 12px;
  border-top-color: rgba(148, 163, 184, 0.16);
}

.admin-content {
  margin-left: 236px;
  background: var(--admin-bg);
}

.topbar {
  min-height: 58px;
  padding: 12px 24px;
  background: var(--admin-surface);
  border-bottom: 1px solid var(--admin-border);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
  backdrop-filter: none;
}

.topbar__breadcrumb {
  color: var(--admin-muted);
}

.topbar__breadcrumb strong,
.topbar__user {
  color: var(--admin-text);
}

.topbar__notify,
.topbar__refresh {
  height: 34px;
  border-color: var(--admin-border);
  border-radius: 10px;
  background: #ffffff;
  color: var(--admin-text);
}

.topbar__notify--alert {
  border-color: #bfdbfe;
  background: var(--admin-primary-soft);
  color: #1d4ed8;
  box-shadow: none;
}

.topbar__notify strong {
  background: var(--admin-primary);
}

.topbar__refresh:hover {
  border-color: #bfdbfe;
  background: var(--admin-primary-soft);
}

.admin-panel {
  padding: 24px;
  gap: 18px;
}

.admin-panel--chat-screen {
  padding: 16px;
}

.panel-card,
.summary-card,
.live-stat-card,
.request-board,
.vip-admin-section,
.admin-chat-usercard {
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  background: var(--admin-surface);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.panel-card {
  padding: 20px;
}

.panel-card--inner {
  background: #ffffff;
  padding: 18px;
}

.panel-card__header {
  margin-bottom: 14px;
  color: var(--admin-text);
}

.panel-card__header h3 {
  color: var(--admin-text);
}

.panel-card__subtext,
.request-board__toolbar p {
  color: var(--admin-muted);
}

.panel-card__empty {
  min-height: 96px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--admin-border);
  border-radius: 12px;
  background: #f8fafc;
  color: var(--admin-muted);
}

.stats-row {
  gap: 16px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  min-height: 112px;
  padding: 18px;
  border: 1px solid var(--admin-border);
  border-left: 4px solid var(--admin-primary);
  border-radius: 12px;
  background: #ffffff !important;
  color: var(--admin-text) !important;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
}

.stat-card--green { border-left-color: var(--admin-success); }
.stat-card--orange { border-left-color: var(--admin-warning); }
.stat-card--purple { border-left-color: #7c3aed; }
.stat-card--teal { border-left-color: #0f766e; }
.stat-card--red { border-left-color: var(--admin-danger); }

.stat-card__label {
  color: var(--admin-muted);
  opacity: 1;
}

.stat-card__value {
  color: var(--admin-text);
  font-size: clamp(20px, 2vw, 26px);
}

.badge {
  border-radius: 999px;
  font-weight: 750;
}

.badge--success { background: #dcfce7; color: #166534; }
.badge--danger { background: #fee2e2; color: #991b1b; }
.badge--warning { background: #fef3c7; color: #92400e; }
.badge--info { background: #dbeafe; color: #1d4ed8; }

.table-scroll {
  border: 1px solid var(--admin-border);
  border-radius: 12px;
  background: #ffffff;
}

.data-table {
  color: var(--admin-text);
  font-size: 13px;
}

.data-table th {
  padding: 11px 12px;
  background: #f8fafc;
  color: #475569;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.data-table td {
  padding: 11px 12px;
  border-bottom-color: var(--admin-border);
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.btn,
.inline-input,
.form-field input,
.form-field select,
.form-field textarea {
  border-radius: 10px;
  border-color: var(--admin-border);
}

.btn {
  min-height: 36px;
  font-weight: 750;
}

.btn--primary {
  background: var(--admin-primary);
  border-color: var(--admin-primary);
}

.btn--primary:hover {
  background: #1d4ed8;
}

.btn--success {
  background: var(--admin-success);
  border-color: var(--admin-success);
  color: #ffffff;
}

.btn--danger {
  background: var(--admin-danger);
  border-color: var(--admin-danger);
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus,
.inline-input:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.admin-footer {
  display: none !important;
}

.panel-card--chat {
  border-color: var(--admin-border);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
}

.admin-chat-layout {
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
}

.admin-chat-sidebar,
.admin-chat-main,
.admin-chat-input,
.admin-chat-room,
.admin-chat-filters button,
.chat-kpi__item {
  border-color: var(--admin-border);
}

.admin-chat-main,
.admin-chat-messages {
  background: #f8fbff;
}

.admin-chat-input {
  background: #ffffff;
  box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.04);
}

.admin-chat-room {
  border-radius: 12px;
  background: #ffffff;
}

.admin-chat-room--active {
  border-color: #93c5fd;
  background: #eff6ff;
}

.admin-chat-room--unread {
  border-color: #1d4ed8;
  background: #dbeafe;
  box-shadow: inset 4px 0 0 #1d4ed8, 0 8px 18px rgba(37, 99, 235, 0.14);
}

.admin-chat-msg__bubble {
  border-radius: 14px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.admin-chat-msg--admin .admin-chat-msg__bubble,
.admin-chat-msg--system .admin-chat-msg__bubble {
  background: #2563eb;
  color: #ffffff;
}

.admin-chat-msg--user .admin-chat-msg__bubble {
  background: #ffffff;
  color: var(--admin-text);
  border: 1px solid var(--admin-border);
}

@media (max-width: 1100px) {
  .sidebar {
    width: 236px;
  }

  .admin-content {
    margin-left: 236px;
  }

  .admin-chat-layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .admin-content {
    margin-left: 0;
  }

  .topbar {
    padding: 10px 16px;
  }

  .topbar__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .topbar__notify,
  .topbar__refresh,
  .topbar__user {
    width: auto;
  }

  .admin-panel {
    padding: 16px;
  }

  .stats-row,
  .stats-row--secondary,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .admin-chat-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .admin-chat-sidebar {
    max-height: 260px;
  }

  .admin-chat-rooms {
    max-height: 180px;
  }
}

/* Production-safe CSKH skin overrides: CSS only, no chat logic touched. */
.admin-panel--chat-screen {
  background:
    radial-gradient(circle at 18% 0%, rgba(59, 130, 246, 0.18), transparent 32%),
    radial-gradient(circle at 100% 12%, rgba(14, 165, 233, 0.12), transparent 28%),
    #eef4fb;
}

.panel-card--chat {
  border: 1px solid rgba(29, 78, 216, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.94));
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.14);
}

.panel-card__header--chat {
  padding: 14px 16px;
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(11, 31, 68, 0.98), rgba(16, 58, 126, 0.95));
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 32px rgba(15, 23, 42, 0.16);
}

.panel-card__header--chat h3 {
  color: #ffffff;
  font-weight: 900;
  letter-spacing: 0.03em;
}

.chat-kpi__chip,
.admin-chat-toolbar__gear {
  border: 1px solid rgba(147, 197, 253, 0.32);
  background: rgba(255, 255, 255, 0.1);
  color: #eaf4ff;
  box-shadow: none;
}

.chat-kpi__chip--active,
.chat-kpi__chip--warning,
.admin-chat-toolbar__gear:hover {
  border-color: rgba(56, 189, 248, 0.7);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(14, 165, 233, 0.82));
  color: #ffffff;
}

.admin-chat-layout {
  gap: 14px;
}

.admin-chat-sidebar,
.admin-chat-main {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.96), rgba(239, 246, 255, 0.92));
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.admin-chat-sidebar {
  padding: 10px;
}

.admin-chat-main {
  overflow: hidden;
}

.admin-chat-filter {
  min-height: 42px;
  border-radius: 14px;
  border-color: rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.82);
  color: #1e293b;
}

.admin-chat-filter--active {
  border-color: rgba(37, 99, 235, 0.55);
  background: linear-gradient(135deg, #2563eb, #0ea5e9) !important;
  color: #ffffff !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}

.admin-chat-rooms {
  padding-right: 2px;
}

.admin-chat-room {
  position: relative;
  border-radius: 16px;
  border-color: rgba(148, 163, 184, 0.22);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.94), rgba(248,250,252,0.9));
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.admin-chat-room:hover {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.35);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.09);
}

.admin-chat-room--active {
  border-color: rgba(37, 99, 235, 0.72);
  background:
    linear-gradient(135deg, rgba(219, 234, 254, 1), rgba(239, 246, 255, 0.98));
  box-shadow: inset 4px 0 0 #2563eb, 0 14px 30px rgba(37, 99, 235, 0.16);
}

.admin-chat-room--unread {
  border-color: rgba(14, 165, 233, 0.9);
  background:
    linear-gradient(135deg, #dbeafe 0%, #bfdbfe 48%, #e0f2fe 100%);
  box-shadow: inset 4px 0 0 #0ea5e9, 0 16px 34px rgba(14, 165, 233, 0.24);
}

.admin-chat-room--unread::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12), 0 0 14px rgba(34, 197, 94, 0.5);
}

.admin-chat-room__top strong {
  color: #0f172a;
  font-weight: 900;
}

.admin-chat-room__preview,
.admin-chat-room__lastseen {
  color: #64748b;
}

.presence-pill {
  border-radius: 999px;
  font-weight: 900;
}

.presence-pill--online {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.presence-pill--offline {
  background: rgba(148, 163, 184, 0.18);
  color: #64748b;
}

.admin-chat-toolbar,
.admin-chat-customerbar {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(12px);
}

.admin-chat-toolbar {
  border-radius: 16px;
  padding: 12px 14px;
}

.admin-chat-toolbar__identity strong {
  color: #0f172a;
  font-weight: 950;
}

.admin-chat-toolbar__presence--online {
  color: #16a34a;
}

.admin-chat-toolbar__presence--offline {
  color: #64748b;
}

.admin-chat-messages {
  padding: 18px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 20% 0%, rgba(37, 99, 235, 0.12), transparent 34%),
    linear-gradient(180deg, #0b1734 0%, #111c3c 100%);
  border: 1px solid rgba(59, 130, 246, 0.18);
}

.admin-chat-msg {
  animation: adminChatBubbleIn 0.18s ease both;
}

.admin-chat-msg__bubble {
  border-radius: 18px;
  box-shadow: 0 12px 28px rgba(2, 6, 23, 0.16);
}

.admin-chat-msg--user .admin-chat-msg__bubble {
  background: rgba(255, 255, 255, 0.94);
  color: #0f172a;
  border: 1px solid rgba(226, 232, 240, 0.72);
}

.admin-chat-msg--support .admin-chat-msg__bubble,
.admin-chat-msg--admin .admin-chat-msg__bubble,
.admin-chat-msg--system .admin-chat-msg__bubble {
  background: linear-gradient(135deg, #2563eb, #0284c7);
  color: #ffffff;
  border: 1px solid rgba(125, 211, 252, 0.28);
}

.admin-chat-msg__text {
  color: inherit;
  font-size: 14px;
  line-height: 1.6;
}

.admin-chat-msg__bubble small {
  color: rgba(255, 255, 255, 0.66);
}

.admin-chat-msg--user .admin-chat-msg__bubble small {
  color: #64748b;
}

.admin-chat-input {
  margin-top: 2px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 -10px 28px rgba(15, 23, 42, 0.08);
}

.admin-chat-quickbar {
  gap: 8px;
}

.admin-chat-chip {
  border-radius: 999px;
  border-color: rgba(37, 99, 235, 0.22);
  background: linear-gradient(180deg, #eff6ff, #dbeafe);
  color: #1d4ed8;
  font-weight: 900;
}

.admin-chat-input__composer {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: #ffffff;
  box-shadow: inset 0 1px 0 rgba(15, 23, 42, 0.03);
}

.admin-chat-input__composer textarea {
  color: #0f172a;
}

.admin-chat-input__icon {
  border-radius: 14px;
  background: #eff6ff;
  color: #1d4ed8;
}

.admin-chat-input__icon--send {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.24);
}

@media (min-width: 769px) {
  .admin-layout--chat .sidebar {
    width: 78px;
    overflow: visible;
    transition: width 0.18s ease, box-shadow 0.18s ease;
  }

  .admin-layout--chat .sidebar:hover,
  .admin-layout--chat .sidebar:focus-within {
    width: 236px;
    box-shadow: 18px 0 42px rgba(15, 23, 42, 0.2);
  }

  .admin-layout--chat .admin-content {
    margin-left: 78px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__brand {
    justify-content: center;
    padding: 14px 8px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__brand-info {
    align-items: center;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__logo {
    width: 42px;
    max-height: 28px;
    object-fit: contain;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__domain,
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__section-toggle span:first-child,
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__section-toggle .sidebar__caret,
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__sublink span:not(.sidebar__link-icon),
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__sublink .sidebar__caret,
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__footer span:not(.sidebar__link-icon),
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__nested {
    display: none;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__nav {
    padding: 8px 7px;
    gap: 4px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__section {
    gap: 3px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__section-toggle {
    min-height: 8px;
    height: 8px;
    padding: 0;
    pointer-events: none;
    background: transparent;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__submenu--group {
    gap: 5px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__sublink--nav,
  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__link {
    justify-content: center;
    min-height: 42px;
    padding: 9px;
    margin: 0;
    border-radius: 13px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__link-icon {
    width: 24px;
    height: 24px;
  }

  .admin-layout--chat .sidebar:not(:hover):not(:focus-within) .sidebar__footer {
    padding: 8px 7px;
  }

  .admin-layout--chat .topbar {
    min-height: 50px;
    padding: 8px 16px;
  }

  .admin-layout--chat .admin-panel--chat-screen {
    padding: 8px 10px;
  }

  .admin-layout--chat .panel-card--chat {
    padding: 12px;
  }

  .admin-layout--chat .panel-card__header--chat {
    padding: 10px 12px;
    margin-bottom: 8px;
    border-radius: 14px;
  }

  .admin-layout--chat .admin-chat-layout {
    grid-template-columns: clamp(214px, 17.5vw, 248px) minmax(0, 1fr);
    gap: 10px;
  }

  .admin-layout--chat .admin-chat-sidebar {
    padding: 8px;
    border-radius: 14px;
  }

  .admin-layout--chat .admin-chat-filter {
    min-height: 36px;
    padding: 6px 8px;
    border-radius: 11px;
    font-size: 12px;
  }

  .admin-layout--chat .admin-chat-room {
    padding: 7px 8px;
    border-radius: 12px;
  }

  .admin-layout--chat .admin-chat-toolbar {
    padding: 9px 12px;
    border-radius: 13px;
  }

  .admin-layout--chat .admin-chat-messages {
    padding: 14px;
    border-radius: 14px;
  }

  .admin-layout--chat .admin-chat-input {
    padding: 10px;
    border-radius: 14px;
  }
}

.admin-chat-empty {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
}

@keyframes adminChatBubbleIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Admin CSKH contrast pass: CSS-only visibility improvements. */
.admin-chat-msg--support .admin-chat-msg__bubble,
.admin-chat-msg--admin .admin-chat-msg__bubble {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.98), rgba(2, 132, 199, 0.98)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(186, 230, 253, 0.46) !important;
  box-shadow:
    0 14px 32px rgba(2, 132, 199, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
}

.admin-chat-msg--system .admin-chat-msg__bubble {
  background:
    linear-gradient(135deg, rgba(180, 83, 9, 0.96), rgba(217, 119, 6, 0.94)) !important;
  color: #fff7ed !important;
  border: 1px solid rgba(253, 186, 116, 0.48) !important;
}

.admin-chat-msg--support .admin-chat-msg__bubble *,
.admin-chat-msg--admin .admin-chat-msg__bubble *,
.admin-chat-msg--system .admin-chat-msg__bubble * {
  color: inherit !important;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.24);
}

.admin-chat-msg--support .admin-chat-msg__name,
.admin-chat-msg--admin .admin-chat-msg__name,
.admin-chat-msg--system .admin-chat-msg__name {
  color: #ffffff !important;
  font-weight: 950;
}

.admin-chat-msg--support .admin-chat-msg__time,
.admin-chat-msg--admin .admin-chat-msg__time,
.admin-chat-msg--system .admin-chat-msg__time,
.admin-chat-msg--support .admin-chat-msg__bubble small,
.admin-chat-msg--admin .admin-chat-msg__bubble small,
.admin-chat-msg--system .admin-chat-msg__bubble small {
  color: rgba(255, 255, 255, 0.86) !important;
}

.admin-chat-room--unread {
  border-color: rgba(239, 68, 68, 0.9) !important;
  background:
    linear-gradient(135deg, #dbeafe 0%, #bfdbfe 44%, #fee2e2 100%) !important;
  box-shadow:
    inset 5px 0 0 #ef4444,
    0 16px 34px rgba(37, 99, 235, 0.18),
    0 0 0 1px rgba(239, 68, 68, 0.14) !important;
}

.admin-chat-room--unread .admin-chat-room__top strong {
  color: #0f172a !important;
  font-weight: 950;
}

.admin-chat-room--unread .admin-chat-room__preview {
  color: #1e3a8a !important;
  font-weight: 850;
}

.admin-chat-room--unread .badge,
.admin-chat-room--unread .badge--warning {
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ef4444, #dc2626) !important;
  color: #ffffff !important;
  border: 2px solid #ffffff;
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.32);
}

.admin-chat-room__unread-dot,
.admin-chat-room--unread::after {
  background: #ef4444 !important;
  box-shadow:
    0 0 0 5px rgba(239, 68, 68, 0.14),
    0 0 16px rgba(239, 68, 68, 0.7) !important;
}

.admin-chat-room__unread-dot {
  animation: adminUnreadPulse 1.35s ease-in-out infinite;
}

.chat-kpi__chip--warning {
  border-color: rgba(249, 115, 22, 0.72) !important;
  background: linear-gradient(135deg, #f97316, #ef4444) !important;
  color: #ffffff !important;
  box-shadow: 0 12px 24px rgba(239, 68, 68, 0.22);
}

.chat-kpi__chip--active:not(.chat-kpi__chip--warning) {
  background: linear-gradient(135deg, #2563eb, #06b6d4) !important;
  color: #ffffff !important;
}

.admin-chat-filter--blue.admin-chat-filter--active {
  background: linear-gradient(135deg, #2563eb, #06b6d4) !important;
}

.admin-chat-filter--orange.admin-chat-filter--active,
.admin-chat-filter--yellow.admin-chat-filter--active {
  background: linear-gradient(135deg, #f97316, #f59e0b) !important;
}

.admin-chat-filter--green.admin-chat-filter--active {
  background: linear-gradient(135deg, #16a34a, #22c55e) !important;
}

.admin-chat-filter--purple.admin-chat-filter--active {
  background: linear-gradient(135deg, #7c3aed, #db2777) !important;
}

.admin-chat-msg__sender {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 5px;
  font-size: 12px;
  line-height: 1.25;
}

.admin-chat-msg__sender span {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: inherit;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.admin-chat-msg__sender--status-only {
  justify-content: flex-end;
  padding-right: 28px;
}

.admin-chat-msg__edit {
  display: grid;
  gap: 8px;
  min-width: min(320px, 72vw);
}

.admin-chat-msg__edit textarea {
  width: 100%;
  min-height: 86px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid rgba(96, 165, 250, 0.42);
  background: #ffffff !important;
  color: #0f172a !important;
  padding: 10px 12px;
  font: inherit;
  line-height: 1.45;
  outline: none;
  text-shadow: none !important;
}

.admin-chat-msg--support .admin-chat-msg__edit textarea,
.admin-chat-msg--admin .admin-chat-msg__edit textarea,
.admin-chat-msg--system .admin-chat-msg__edit textarea {
  background: #ffffff !important;
  color: #0f172a !important;
  -webkit-text-fill-color: #0f172a !important;
  text-shadow: none !important;
}

.admin-chat-msg__edit-actions,
.admin-chat-msg__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-chat-msg__edit-actions {
  justify-content: flex-end;
}

.admin-chat-msg__tools {
  position: absolute;
  top: 7px;
  right: 8px;
  z-index: 5;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease, transform 0.16s ease;
  transform: translateY(-2px);
}

.admin-chat-msg__bubble:hover .admin-chat-msg__tools,
.admin-chat-msg__bubble:focus-within .admin-chat-msg__tools {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.admin-chat-msg__more {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.18);
  color: inherit;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
  font-size: 18px;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.admin-chat-msg__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  display: none;
  min-width: 126px;
  padding: 6px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.94);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.26);
  backdrop-filter: blur(12px);
}

.admin-chat-msg__tools:hover .admin-chat-msg__menu,
.admin-chat-msg__tools:focus-within .admin-chat-msg__menu {
  display: grid;
  gap: 4px;
}

.admin-chat-msg__menu button {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.10);
  color: #ffffff;
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 850;
  text-align: left;
  cursor: pointer;
}

.admin-chat-msg__menu button:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.36);
}

.admin-chat-msg__menu button:disabled {
  opacity: 0.55;
  cursor: wait;
}

@media (hover: none) {
  .admin-chat-msg__tools {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}

.admin-chat-msg__text--deleted {
  color: inherit;
  font-style: italic;
  opacity: 0.82;
}

@keyframes adminUnreadPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.22);
    opacity: 0.72;
  }
}
</style>
