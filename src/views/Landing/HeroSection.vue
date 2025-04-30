<script setup lang="ts">
import HeroImage from '@/assets/media/images/HeroImage.vue';
</script>

<template>
  <div id="hero-section">
    <div class="container">
      <div class="text">
        <div>
          <h1>
            Une plateforme de location avec 
            <span class="gradient-text">0%</span> 
            de commissions
          </h1>
          <p>
            IndieHost <u>élimine les commissions</u>. Des réservations plus accessibles pour vos voyageurs, et jusqu’à <b>20 % de revenus en plus</b> pour vous grâce à un abonnement fixe. Créez une page à votre image et de proposez des tarifs plus justes sans vous séparer de vos outils habituels.
          </p>
        </div>
        <div class="cta">
          <a href="#">Essayez en premier !</a>
        </div>
      </div>
      <div class="illustration">
        <div>
          <HeroImage class="hero-image" />
          <span></span>
        </div>
      </div>
    </div>
  </div>
</template>
