<!-- File: src/views/Landing/HabitsSection/components/Carousel.vue -->

<script setup lang="ts">
import { ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/autoplay'

import { useHabitsAnim } from '../utils/useHabitsAnim'

const swiperInstance = ref(null)
const carouselRef = ref(null)

useHabitsAnim({ swiperInstance, carouselRef })
</script>

<template>
  <div
    class="illustration"
    ref="carouselRef"
  >
    <Swiper
      :modules="[Autoplay]"
      :slides-per-view="3"
      :space-between="32"
      :loop="true"
      :centered-slides="true"
      autoplay="{ delay: 2000, disableOnInteraction: true }"
      ref="swiperInstance"
    >
      <SwiperSlide
        ><img
          src="@/assets/media/images/dashboard-vue-ensemble.png"
          alt="Page réservations"
        />
      </SwiperSlide>
      <SwiperSlide
        ><img
          src="@/assets/media/images/dashboard-detail-logement.png"
          alt="Page détails logement"
        />
      </SwiperSlide>
      <SwiperSlide
        ><img
          src="@/assets/media/images/annonce-reservation.png"
          alt="Page paiement"
        />
      </SwiperSlide>
      <SwiperSlide
        ><img
          src="@/assets/media/images/messagerie.png"
          alt="Page messagerie"
        />
      </SwiperSlide>
    </Swiper>

    <!-- Effets lumières etc à déplacer ici aussi -->
  </div>
</template>
