<!-- File: src/views/Admin/dev/DevAdminRoute.vue -->

<!-- Administration sur de fausses données, sans compte ni API (développement seulement).
     `?etat=panne` : panne de la base ; `?acces=refuse` : compte sans droits ; `?onglet=…` : onglet. -->

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'

import AdminPage from '@/views/Admin/_AdminPage.vue'
import { ADMIN_DATA_SOURCE } from '@/views/Admin/adminDataSource'
import { createDevAdminDataSource } from '@/views/Admin/dev/devAdminData'

const route = useRoute()

provide(ADMIN_DATA_SOURCE, createDevAdminDataSource({ outage: route.query.etat === 'panne' }))

const access = computed(() => (route.query.acces === 'refuse' ? 'denied' : 'allowed'))
</script>

<template>
  <AdminPage
    :access="access"
    account-email="dev@indiehost.fr"
    current-clerk-user-id="user_devadmin01"
  />
</template>
