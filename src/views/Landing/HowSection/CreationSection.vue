<!-- File: src/views/Landing/HowSection/CreationSection.vue -->

<script setup lang="ts">
import AutoImport from '@/components/svgs/images/AutoImport.vue';

</script>

<template>
    <section class="usage-section">
        <div class="container">

            <!-- TITRE + SOUS-TITRE -->
            <div class="content">
                <span class="step">
                    1
                </span>
                <h2>
                    Vous importez votre annonce existante
                </h2>
                <p>
                    Depuis Airbnb ou Booking : en 1 clic, on récupère votre titre, vos photos, votre description, votre
                    note… puis éditez votre annonce au besoin.
                </p>
            </div>

            <!-- ILLUSTRATION -->
            <div class="illustration">
                <img class="halo-png" src="@/assets/media/images/halo1.png" alt="IndieHost">
                <AutoImport class="image" />
            </div>
        </div>
    </section>
</template>