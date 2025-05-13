<!-- File: src/views/Landing/WhySection/CustomizationSection.vue -->

<script setup lang="ts">
import CustomDomain from '@/components/svgs/images/CustomDomain.vue'
</script>

<template>
  <section id="customization-section">
    <div class="container">
      <div class="illustration">
        <img
          class="customization-image"
          src="@/assets/media/images/customization-image.png"
          alt="Customization"
        />
      </div>
      <div class="content">
        <div>
          <h2>
            Votre page, votre nom, votre image
            <span class="gradient-text">image</span>
          </h2>
          <CustomDomain
            class="custom-domain"
            title="Domaine personnalisé"
            desc="Personnalisez votre domaine avec votre nom de marque"
          />
          <p>
            IndieHost crée <b>une adresse rien qu’à vous</b>, avec un thème qui reflète l’esprit de votre lieu, votre ton, votre univers. <br /><br />
            Pas besoin d’un site compliqué pour avoir une page qui vous ressemble.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
