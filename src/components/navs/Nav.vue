<!-- File: src/components/navs/Nav.vue -->

<script setup lang="ts">
// DEPS

// ASSETS
import { icons } from '@/components/svgs'

</script>

<template>
    <div class="container__xl">
        <nav class="navbar">
            <div class="navbar__logo">
                <component :is="icons.logoFull.adapt"/>
            </div>
            <ul class="navbar__links">
                <li>
                    <RouterLink to="#home">Tenez moi au courant !</RouterLink>
                </li>
                <li>
                    <RouterLink to="#about">Comment ça marche ?</RouterLink>
                </li>
                <li>
                    <RouterLink to="#services">Pour qui ?</RouterLink>
                </li>
                <li>
                    <RouterLink to="#contact">Contact</RouterLink>
                </li>
            </ul>
        </nav>
    </div>
</template>
