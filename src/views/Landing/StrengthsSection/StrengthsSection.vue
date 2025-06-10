<!-- File: src/views/Landing/StrengthsSection/StrengthsSection.vue -->

<script setup lang="ts">
// ASSETS
import { Wallet, ShieldCheck, Users } from 'lucide-vue-next'
// CONTENT
import type { ItemSection } from '@/content/types'
import rawContent from '@/content/fr/Landing/strengths-section.json'

const section = rawContent as ItemSection
</script>

<template>
  <section id="strengths-section">
    <div class="container">
      <div class="title">
        <h2 v-html="section.items['title-1'].content" />
        <p v-html="section.items['subtitle-1'].content" />
      </div>
      <div class="strengths">
        <div>
          <div>
            <Wallet
              :size="32"
              class="icon"
            />
            <h3 v-html="section.items['card-1-title'].content" />
            <p v-html="section.items['card-1-text'].content" />
          </div>
        </div>
        <div>
          <div>
            <ShieldCheck
              :size="32"
              class="icon"
            />
            <h3 v-html="section.items['card-2-title'].content" />
            <p v-html="section.items['card-2-text'].content" />
          </div>
        </div>
        <div>
          <div>
            <Users
              :size="32"
              class="icon"
            />
            <h3 v-html="section.items['card-3-title'].content" />
            <p v-html="section.items['card-3-text'].content" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
@use '@/views/Landing/StrengthsSection/strengths-section.scss';
</style>
