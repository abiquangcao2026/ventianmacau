<template>
  <section class="home-page">
    <HomeGames @open-game="goToGame" />
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router'
import HomeGames from '@/components/HomeView.vue'

const router = useRouter()

function goToGame(gameId) {
  const room = gameId === 'sicbo5p' ? 'sicbo-5p' : 'sicbo-3p'
  router.push({ name: 'sicbo', query: { room } })
}
</script>

<style scoped>
.home-page {
  min-height: 100%;
  background: #170b34;
}
</style>
