<!-- File: src/views/Landing/WhySection/CustomizationSection.vue -->

<script setup lang="ts">
import CustomizationImage from '@/components/svgs/images/CustomizationImage.vue';
</script>

<template>
    <section id="customization-section">
        <div class="container">
            <h1>
                Personnalisez votre page
                <span class="gradient-text">comme vous le souhaitez</span>
            </h1>
            <p>
                Créez une page à votre image et de proposez des tarifs plus justes sans vous séparer de vos outils
                habituels.
            </p>
        </div>

        <div class="illustration">
            <CustomizationImage class="customization-image" />
        </div>
    </section>
</template>