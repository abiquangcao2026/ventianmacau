<template>
  <section class="page-shell">
    <div class="page-card">
      <h1 class="page-title">Rút tiền</h1>

      <div class="panel">
        <label class="label">Số tiền</label>
        <input v-model.number="amount" type="number" class="input" placeholder="Nhập số tiền rút" />

        <label class="label">Tên ngân hàng</label>
        <input v-model="bankName" class="input" placeholder="VD: Vietcombank" />

        <label class="label">Số tài khoản</label>
        <input v-model="bankAccount" class="input" placeholder="Nhập số tài khoản" />

        <label class="label">Chủ tài khoản</label>
        <input v-model="accountName" class="input" placeholder="Nhập tên chủ tài khoản" />

        <button class="submit-btn" @click="submitWithdraw">Gửi yêu cầu rút tiền</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const amount = ref(100000)
const bankName = ref('')
const bankAccount = ref('')
const accountName = ref('')

function submitWithdraw() {
  const payload = {
    amount: Number(amount.value || 0),
    bankName: bankName.value.trim(),
    bankAccount: bankAccount.value.trim(),
    accountName: accountName.value.trim()
  }

  if (!payload.amount || !payload.bankName || !payload.bankAccount || !payload.accountName) {
    alert('Vui lòng nhập đầy đủ thông tin')
    return
  }

  userStore.createWithdrawRequest(payload)
}
</script>

<style scoped>
.page-shell { width:100%; display:flex; justify-content:center; background:#120924; min-height:calc(100vh - 110px); }
.page-card { width:100%; max-width:414px; padding:14px 12px 24px; color:#fff; }
.page-title {
  font-size:20px; font-weight:800; margin-bottom:14px;
  background:linear-gradient(90deg,#c084fc,#e9d5ff);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
.panel {
  background:#1a1031;
  border:1px solid rgba(192,132,252,.25);
  border-radius:16px;
  padding:14px;
}
.label { display:block; font-size:13px; margin-bottom:6px; color:rgba(255,255,255,.8); }
.input {
  width:100%; height:44px; margin-bottom:12px;
  border-radius:12px; border:1px solid rgba(192,132,252,.24);
  background:#130b27; color:#fff; padding:0 12px; box-sizing:border-box;
}
.submit-btn {
  width:100%; height:46px; border:none; cursor:pointer;
  border-radius:14px; font-weight:800; color:#fff;
  background:linear-gradient(180deg,#7c3aed,#5b21b6);
}
</style>
