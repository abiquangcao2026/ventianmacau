<template>
  <div class="lobby-page">
    <transition name="maintenance-toast">
      <div v-if="maintenanceToastVisible" class="maintenance-toast" role="status" aria-live="polite">
        <div class="maintenance-toast__icon">
          <span>✕</span>
        </div>
        <div class="maintenance-toast__content">
          <strong>Game đang bảo trì,</strong>
          <p>vui lòng quay lại sau!</p>
        </div>
      </div>
    </transition>

    <section class="hero-strip">
      <div class="hero-slider" ref="sliderRef">
        <article v-for="slide in heroSlides" :key="slide.title" class="hero-slide">
          <img :src="slide.image" :alt="slide.title" class="hero-slide__image" />
          <div class="hero-slide__overlay">
            <span class="hero-slide__kicker">{{ slide.kicker }}</span>
            <h2 class="hero-slide__title">{{ slide.title }}</h2>
            <p class="hero-slide__copy">{{ slide.copy }}</p>
          </div>
        </article>
      </div>

      <div class="hero-dots" aria-hidden="true">
        <span
          v-for="(slide, index) in heroSlides"
          :key="slide.title"
          class="hero-dot"
          :class="{ active: currentSlide === index }"
        ></span>
      </div>
    </section>

    <div class="marquee-box">
      <span class="marquee-box__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 22a2 2 0 002-2H10a2 2 0 002 2z" fill="rgba(255,255,255,0.9)"/>
          <path d="M18 16H6l1.3-2.1c.5-.8.7-1.7.7-2.6V9a4 4 0 018 0v2.3c0 .9.2 1.8.7 2.6L18 16z" fill="rgba(255,255,255,0.32)"/>
          <path d="M18 16H6" stroke="rgba(255,255,255,0.65)" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </span>
      <div class="marquee-box__track">
        <p>Chào mừng bạn đến với Coronacasino macau. Chúc bạn thắng lớn và giao dịch an toàn.</p>
      </div>
    </div>

    <section class="quick-room">
      <button class="quick-room__card ui-reset-button" type="button" @click="$emit('open-game', 'sicbo3p')">
        <span class="quick-room__kicker">Bàn nóng</span>
        <strong class="quick-room__title">Xúc sắc 3P</strong>
        <p class="quick-room__copy">Chu kỳ 4 phút · cược nhanh</p>
      </button>

      <button class="quick-room__card quick-room__card--alt ui-reset-button" type="button" @click="$emit('open-game', 'sicbo5p')">
        <span class="quick-room__kicker">Phòng ổn định</span>
        <strong class="quick-room__title">Xúc sắc 5P</strong>
        <p class="quick-room__copy">Chu kỳ 5 phút · room lớn</p>
      </button>
    </section>

    <section v-for="section in sections" :key="section.title" class="game-section">
      <div class="game-section__head">
        <div class="game-section__heading">
          <span class="game-section__kicker">{{ section.kicker }}</span>
          <h2 class="game-section__title">
            <span class="game-section__title-icon" aria-hidden="true">
              <svg v-if="section.title === 'Hot Nhất'" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M13 3s-1 2-1 4 2 3 2 6-2 5-5 5-5-2-5-6c0-5 6-9 9-9z" fill="url(#hotGrad)"/>
                <path d="M14 10c2 2 3 4 3 6 0 3-2 5-5 5 2-2 2-4 1-6s-2-3 1-5z" fill="url(#hotGlow)" opacity="0.9"/>
                <defs>
                  <linearGradient id="hotGrad" x1="4" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#FFD58B"/>
                    <stop offset="0.5" stop-color="#FF965F"/>
                    <stop offset="1" stop-color="#E87040"/>
                  </linearGradient>
                  <linearGradient id="hotGlow" x1="10" y1="10" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#FFF1C7"/>
                    <stop offset="1" stop-color="#FF6A3D"/>
                  </linearGradient>
                </defs>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M7 7h10l-1 12H8L7 7z" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 7V5a3 3 0 016 0v2" stroke="rgba(255,255,255,0.9)" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M10 11h4M10 15h4" stroke="rgba(255,255,255,0.65)" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            {{ section.title }}
          </h2>
        </div>

        <button class="game-section__more ui-reset-button" type="button" @click="alertBaoTri">
          Xem thêm
        </button>
      </div>

      <div class="game-grid">
        <button
          v-for="game in section.games"
          :key="game.name"
          class="game-tile ui-reset-button"
          type="button"
          @click="game.action ? $emit('open-game', game.action) : alertBaoTri()"
        >
          <div class="game-tile__media">
            <img :src="game.image" :alt="game.name" class="game-tile__image" />
            <span v-if="game.badge" class="game-tile__badge">{{ game.badge }}</span>
          </div>

          <div class="game-tile__content">
            <strong class="game-tile__title">{{ game.name }}</strong>
            <span class="game-tile__provider">{{ game.provider }}</span>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineEmits(['open-game'])

const sliderRef = ref(null)
const currentSlide = ref(0)
const maintenanceToastVisible = ref(false)
let intervalId = null
let maintenanceToastTimer = null

const heroSlides = [
  {
    kicker: 'Live Floor',
    title: 'Bàn trực tiếp đang mở',
    copy: 'Vào nhanh các bàn phổ biến và theo dõi room Sicbo 3P hoặc 5P.',
    image: '/img/slide6.73e796c.jpg'
  },
  {
    kicker: 'Casino Lobby',
    title: 'Thưởng nóng theo phiên',
    copy: 'Khung giao dịch, lịch sử và điều hướng được tối ưu cho mobile.',
    image: '/img/slide7.d3fd97b.jpg'
  },
  {
    kicker: 'VIP Entry',
    title: 'Danh mục game vận hành liên tục',
    copy: 'Ưu tiên room nóng, giữ lối vào nhanh tới nạp tiền, rút tiền và CSKH.',
    image: '/img/slide10.39cad4f.jpg'
  }
]

const sections = [
  {
    kicker: 'Ưu tiên',
    title: 'Hot Nhất',
    games: [
      { name: 'Xúc sắc 3P', provider: 'OG', image: '/img/xucxac3p.82275b4.png', badge: '3P', action: 'sicbo3p' },
      { name: 'Xúc sắc 5P', provider: 'OG', image: '/img/xucxac3p.82275b4.png', badge: '5P', action: 'sicbo5p' },
      { name: 'Cua Tôm Cá Thái', provider: 'SEXY', image: '/img/SEX009-X7BPc8lv.6a51b00.png' },
      { name: 'Fortune Gems', provider: 'JL', image: '/img/JL0033-vLKTDaCo.7e4bff4.png' },
      { name: 'Keno 1P', provider: 'OG', image: '/img/k1-aC7jKYof.1febb7a.png', badge: '1P' },
      { name: 'Keno 3P', provider: 'OG', image: '/img/k3-We1wcg_g.7cdc583.png', badge: '3P' },
      { name: 'Keno 5P', provider: 'OG', image: '/img/k5-f-qJahMP.bca7cf7.png', badge: '5P' },
      { name: 'Đá quý Aztec', provider: 'PP', image: '/img/PP0009-qBBM4cGb.ae8f78d.png' }
    ]
  },
  {
    kicker: 'Slot',
    title: 'Nổ Hũ PG',
    games: [
      { name: 'Kho báu của ngư dân', provider: 'PG', image: '/img/PG0066-4mL_GSnp.34d9eef.png' },
      { name: 'Cơn sốt bữa tiệc', provider: 'PG', image: '/img/PG0121-TRH28EQJ.749aeb7.png' },
      { name: 'Lucky Clover Lady', provider: 'PG', image: '/img/PG0127-yslYg6Px.35ea75c.png' },
      { name: 'Fortune Ox', provider: 'PG', image: '/img/JL0033-vLKTDaCo.7e4bff4.png' },
      { name: 'Linh hồn huyền thoại', provider: 'PG', image: '/img/PG0047-0iUU-dqZ.52b5e70.png' },
      { name: 'Long Sinh', provider: 'PG', image: '/img/PG0125-vMMRmWaX.beac8fe.png' },
      { name: 'Cua Tôm Cá Thái', provider: 'PG', image: '/img/SEX009-X7BPc8lv.6a51b00.png' },
      { name: 'Đá quý Aztec', provider: 'PG', image: '/img/PP0009-qBBM4cGb.ae8f78d.png' }
    ]
  },
  {
    kicker: 'Slot',
    title: 'Nổ Hũ JILI',
    games: [
      { name: 'Siêu át', provider: 'JILI', image: '/img/JL0045-slakq497.f2a55cf.png' },
      { name: 'Thợ săn', provider: 'JILI', image: '/img/JL0084-p_E7EgfD.ceb9c15.png' },
      { name: 'Aladin', provider: 'JILI', image: '/img/JL0085-LSF5kGDi.c70c556.png' },
      { name: 'Fortune Gems', provider: 'JILI', image: '/img/JL0033-vLKTDaCo.7e4bff4.png' },
      { name: 'Giành chiến thắng', provider: 'JILI', image: '/img/JL0086-Ne2zA3nz.0bd623c.png' },
      { name: 'Mỏ vàng', provider: 'JILI', image: '/img/JL0099-J09x9x9H.56dcabd.png' },
      { name: 'Bingo may mắn', provider: 'JILI', image: '/img/JL0119-g9ufjxiN.68dc612.png' },
      { name: 'Đá quý Aztec', provider: 'JILI', image: '/img/PP0009-qBBM4cGb.ae8f78d.png' }
    ]
  }
]

function alertBaoTri() {
  maintenanceToastVisible.value = true
  if (maintenanceToastTimer) {
    window.clearTimeout(maintenanceToastTimer)
  }

  maintenanceToastTimer = window.setTimeout(() => {
    maintenanceToastVisible.value = false
    maintenanceToastTimer = null
  }, 2200)
}

function scrollToSlide(index) {
  if (!sliderRef.value) return
  currentSlide.value = index
  sliderRef.value.scrollTo({
    left: sliderRef.value.clientWidth * index,
    behavior: 'smooth'
  })
}

function syncCurrentSlide() {
  if (!sliderRef.value) return
  const next = Math.round(sliderRef.value.scrollLeft / sliderRef.value.clientWidth)
  currentSlide.value = Math.max(0, Math.min(heroSlides.length - 1, next))
}

onMounted(() => {
  sliderRef.value?.addEventListener('scroll', syncCurrentSlide, { passive: true })

  intervalId = window.setInterval(() => {
    const nextIndex = currentSlide.value >= heroSlides.length - 1 ? 0 : currentSlide.value + 1
    scrollToSlide(nextIndex)
  }, 4200)
})

onBeforeUnmount(() => {
  sliderRef.value?.removeEventListener('scroll', syncCurrentSlide)
  if (intervalId) {
    window.clearInterval(intervalId)
  }
  if (maintenanceToastTimer) {
    window.clearTimeout(maintenanceToastTimer)
    maintenanceToastTimer = null
  }
})
</script>

<style scoped>
.lobby-page {
  position: relative;
  padding: 14px 14px 10px;
  color: #fff;
}

.maintenance-toast {
  position: fixed;
  left: 50%;
  top: 48%;
  z-index: 90;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 270px;
  max-width: 348px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(245, 245, 249, 0.98);
  color: #2a2f3b;
  box-shadow: 0 16px 36px rgba(2, 8, 24, 0.34);
}

.maintenance-toast__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ffe4e8;
  color: #ff5777;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 900;
  flex: none;
}

.maintenance-toast__content {
  display: grid;
  gap: 2px;
}

.maintenance-toast__content strong {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 700;
}

.maintenance-toast__content p {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.maintenance-toast-enter-active,
.maintenance-toast-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.maintenance-toast-enter-from,
.maintenance-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -54%);
}

.ui-reset-button {
  appearance: none;
  -webkit-appearance: none;
  display: block;
  width: 100%;
  margin: 0;
  border: none;
  box-shadow: none;
  font: inherit;
  cursor: pointer;
}

.hero-strip {
  position: relative;
}

.hero-slider {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
}

.hero-slider::-webkit-scrollbar {
  display: none;
}

.hero-slide {
  position: relative;
  flex: 0 0 100%;
  min-height: 168px;
  border-radius: 18px;
  overflow: hidden;
  scroll-snap-align: start;
  background: #0b1120;
}

.hero-slide__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.hero-slide__overlay {
  position: absolute;
  inset: auto 0 0 0;
  padding: 44px 14px 14px;
  background: linear-gradient(180deg, transparent, rgba(6, 12, 24, 0.88) 42%, rgba(6, 12, 24, 0.96));
}

.hero-slide__kicker,
.game-section__kicker {
  display: block;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 230, 160, 0.8);
}

.hero-slide__title {
  display: block;
  margin: 6px 0 0;
  font-size: 18px;
  line-height: 1.05;
}

.hero-slide__copy {
  margin: 8px 0 0;
  max-width: 250px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
  line-height: 1.45;
}

.hero-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}

.hero-dot {
  width: 22px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}

.hero-dot.active {
  background: #f7cf71;
}

.marquee-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(70, 41, 120, 0.72);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.marquee-box__icon {
  flex: none;
}

.marquee-box__track {
  flex: 1;
  overflow: hidden;
}

.marquee-box__track p {
  margin: 0;
  display: inline-block;
  white-space: nowrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  animation: marquee 12s linear infinite;
}

@keyframes marquee {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(-100%);
  }
}

.quick-room {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.quick-room__card {
  padding: 14px 14px 16px;
  border-radius: 18px;
  text-align: left;
  background: linear-gradient(135deg, #294a87, #182f63);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.quick-room__card--alt {
  background: linear-gradient(135deg, #5d49ad, #2c1f6c);
}

.quick-room__kicker {
  display: block;
  color: rgba(255, 255, 255, 0.66);
  font-size: 12px;
}

.quick-room__title {
  display: block;
  margin-top: 8px;
  font-size: 20px;
}

.quick-room__copy {
  display: block;
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 1.45;
}

.game-section {
  margin-top: 18px;
}

.game-section__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.game-section__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0 0;
  font-size: 20px;
  line-height: 1;
}

.game-section__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.game-section__more {
  width: auto;
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  font-size: 12px;
  font-weight: 700;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 10px;
}

.game-tile {
  text-align: left;
  background: transparent;
  color: inherit;
}

.game-tile__media {
  position: relative;
  overflow: hidden;
  border-radius: 13px;
}

.game-tile__image {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  object-fit: cover;
}

.game-tile__badge {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 7px 10px;
  border-top-left-radius: 14px;
  background: linear-gradient(135deg, #ff1a4c, #ff4b2c);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
}

.game-tile__content {
  display: block;
  margin-top: 7px;
}

.game-tile__title {
  display: block;
  color: #fff;
  font-size: 12px;
  line-height: 1.3;
}

.game-tile__provider {
  display: block;
  margin-top: 2px;
  color: rgba(182, 191, 214, 0.78);
  font-size: 10px;
  text-transform: uppercase;
}

@media (max-width: 390px) {
  .game-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .quick-room {
    grid-template-columns: 1fr;
  }
}
</style>
