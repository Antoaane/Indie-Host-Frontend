<!-- File: src/views/Landing/HeroSection.vue -->

<script setup lang="ts">
// DEPS

// ASSETS
import HeroImage from '@/components/svgs/images/HeroImage.vue'
import ShapesBgCroped from '@/components/svgs/images/ShapesBgCroped.vue'
</script>

<template>
  <section id="hero-section">
    <ShapesBgCroped
      class="shapes-bg"
      title="Décoration du fond"
      desc="Formes géométriques décoratives"
    />
    <div class="container">
      <div class="content">
        <div>
          <h1>
            Une plateforme de location avec
            <span class="gradient-text">0%</span>
            de commissions
          </h1>
          <p> IndieHost <u>élimine les commissions</u>. Des réservations plus accessibles pour vos voyageurs, et jusqu’à <b>20 % de revenus en plus</b> pour vous grâce à un abonnement fixe. Créez une page à votre image et de proposez des tarifs plus justes sans vous séparer de vos outils habituels. </p>
          <div class="cta">
            <a href="#">Essayez en premier !</a>
          </div>
        </div>
      </div>
      <div class="illustration">
        <div>
          <!-- <HeroImage
            class="hero-image"
            title="Plateforme IndieHost"
            desc="Illustration d'une annonce IndieHost en version mobile pour réserver un logement en ligne, ainsi que la page de gestion de l'hôte en version bureau"
          /> -->
          <img
            src="@/assets/media/images/hero-image.png"
            alt="Illustration d'une annonce IndieHost en version mobile pour réserver un logement en ligne, ainsi que la page de gestion de l'hôte en version bureau"
            class="hero-image"
          />
          <span></span>
        </div>
      </div>
    </div>
  </section>
</template>
