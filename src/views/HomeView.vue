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
  if (gameId === 'keno1p' || gameId === 'keno3p' || gameId === 'keno5p') {
    const room =
      gameId === 'keno5p' ? 'keno-5p' : gameId === 'keno3p' ? 'keno-3p' : 'keno-1p'
    router.push({ name: 'keno', query: { room } })
    return
  }

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
