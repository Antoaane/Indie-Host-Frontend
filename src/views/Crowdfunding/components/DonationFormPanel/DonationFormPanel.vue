<!-- File: src/views/Crowdfunding/components/DonationFormPanel/DonationFormPanel.vue -->

<script setup lang="ts">
import { computed } from 'vue'
import type { ItemSection, ContentBlock } from '@/content/types'

interface SectionEntry {
  key: string
  block: ContentBlock
  index: number
}

const props = defineProps<{
  donationLink: string
  section: ItemSection
}>()

const items = computed(() => props.section.items ?? {})

const entries = computed<SectionEntry[]>(() =>
  Object.entries(items.value).map(
    (
      [
        key,
        block,
      ],
      index,
    ) => ({ key, block, index }),
  ),
)

const normalizeOrder = (block: ContentBlock) => {
  const order = block.meta?.order
  return typeof order === 'number' ? order : Number.POSITIVE_INFINITY
}

const sortEntries = (list: SectionEntry[]) =>
  [
    ...list,
  ].sort((a, b) => {
    const diff = normalizeOrder(a.block) - normalizeOrder(b.block)

    if (diff !== 0) {
      return diff
    }

    return a.index - b.index
  })

const entriesByRole = computed<Record<string, SectionEntry[]>>(() =>
  entries.value.reduce(
    (acc, entry) => {
      const role = typeof entry.block.meta?.role === 'string' && entry.block.meta.role.length > 0 ? entry.block.meta.role : 'content'

      if (!acc[role]) {
        acc[role] = []
      }

      acc[role].push(entry)

      return acc
    },
    {} as Record<string, SectionEntry[]>,
  ),
)

const resolveEntries = (role: string, ...fallbackRoles: string[]) => {
  const groups = entriesByRole.value
  const aggregated: SectionEntry[] = []
  const roles = [
    role,
    ...fallbackRoles,
  ]

  roles.forEach((currentRole) => {
    const list = groups[currentRole]

    if (list) {
      aggregated.push(...list)
    }
  })

  return sortEntries(aggregated)
}

const titleEntry = computed(() => resolveEntries('title')[0] ?? null)

const introEntries = computed(() => resolveEntries('intro'))

const fallbackIntroEntries = computed(() => resolveEntries('content'))

const combinedIntroEntries = computed(() => {
  if (introEntries.value.length > 0) {
    return introEntries.value
  }

  return fallbackIntroEntries.value
})

const stepsEntry = computed(() => resolveEntries('steps')[0] ?? null)

const ctaEntries = computed(() => resolveEntries('cta'))

const noteEntries = computed(() => resolveEntries('note'))

const warningEntries = computed(() => resolveEntries('warning'))

const resolveTag = (block: ContentBlock, fallback: string) => {
  const tag = block.tag

  if (typeof tag === 'string' && tag.trim().length > 0) {
    return tag
  }

  return fallback
}

const hasHref = (entry: SectionEntry) => {
  const href = entry.block.meta?.href
  return typeof href === 'string' && href.length > 0
}

const requiresLink = (entry: SectionEntry) => {
  const metaValue = entry.block.meta?.requiresLink

  if (typeof metaValue === 'boolean') {
    return metaValue
  }

  return !hasHref(entry)
}

const isLinkAvailable = computed(() => props.donationLink.trim().length > 0)

const isCtaDisabled = (entry: SectionEntry) => requiresLink(entry) && !isLinkAvailable.value

const primaryCta = computed(() => {
  const preferred = ctaEntries.value.find((entry) => entry.block.meta?.variant === 'primary')
  return preferred ?? ctaEntries.value[0] ?? null
})

const secondaryCtas = computed(() => {
  if (!primaryCta.value) {
    return []
  }

  return ctaEntries.value.filter((entry) => entry.key !== primaryCta.value?.key)
})

const stepsTitle = computed(() => {
  const title = stepsEntry.value?.block.meta?.title
  return typeof title === 'string' ? title : ''
})

const stepsItems = computed(() => {
  const list = stepsEntry.value?.block.meta?.items
  return Array.isArray(list) ? list : []
})

const stepsOrdered = computed(() => Boolean(stepsEntry.value?.block.meta?.ordered))

const activeWarnings = computed(() =>
  warningEntries.value.filter((entry) => {
    const condition = entry.block.meta?.condition

    if (!condition) {
      return true
    }

    if (condition === 'missing-link') {
      return !isLinkAvailable.value
    }

    if (condition === 'requires-link') {
      return isLinkAvailable.value
    }

    return true
  }),
)

const getRel = (entry: SectionEntry) => {
  const rel = entry.block.meta?.rel

  if (typeof rel === 'string' && rel.length > 0) {
    return rel
  }

  if (entry.block.meta?.target === '_blank') {
    return 'noopener noreferrer'
  }

  return undefined
}

const labelForCta = (entry: SectionEntry, fallback: string) => {
  const content = entry.block.content

  if (typeof content === 'string' && content.trim().length > 0) {
    return content
  }

  return fallback
}

const handleCtaClick = (entry: SectionEntry) => {
  if (isCtaDisabled(entry)) {
    console.warn('[Donation] CTA disabled because donation link is missing.')
    return
  }

  const href = entry.block.meta?.href

  if (typeof href === 'string' && href.length > 0) {
    if (typeof window !== 'undefined') {
      window.open(href, entry.block.meta?.target ?? '_self')
    }

    return
  }

  if (typeof window !== 'undefined') {
    if (!isLinkAvailable.value) {
      console.warn('[Donation] VITE_DONATION_LINK is not defined.')
      return
    }

    window.location.href = props.donationLink
  }
}
</script>

<template>
  <aside
    class="donation-form"
    aria-labelledby="donation-form-title"
  >
    <component
      v-if="titleEntry?.block.content"
      :is="resolveTag(titleEntry.block, 'h2')"
      id="donation-form-title"
      class="donation-form__title"
      v-html="titleEntry.block.content"
    />
    <h2
      v-else
      id="donation-form-title"
      class="donation-form__title"
    >
      Contribuer maintenant
    </h2>

    <template
      v-for="intro in combinedIntroEntries"
      :key="intro.key"
    >
      <component
        v-if="intro.block.content"
        :is="resolveTag(intro.block, 'p')"
        class="donation-form__intro"
        v-html="intro.block.content"
      />
    </template>

    <section
      v-if="stepsItems.length"
      class="donation-form__steps-wrapper"
    >
      <p
        v-if="stepsTitle"
        class="donation-form__steps-title"
        v-html="stepsTitle"
      />
      <component
        :is="stepsOrdered ? 'ol' : 'ul'"
        class="donation-form__steps"
      >
        <li
          v-for="(step, index) in stepsItems"
          :key="`step-${index}`"
          v-html="step"
        />
      </component>
    </section>

    <div
      v-if="primaryCta || secondaryCtas.length"
      class="donation-form__actions"
      :data-has-secondary="secondaryCtas.length > 0"
    >
      <button
        v-if="primaryCta && !hasHref(primaryCta)"
        type="button"
        :disabled="isCtaDisabled(primaryCta)"
        @click="handleCtaClick(primaryCta)"
      >
        {{ labelForCta(primaryCta, 'Soutenir IndieHost') }}
      </button>
      <a
        v-else-if="primaryCta"
        :href="primaryCta.block.meta?.href"
        :target="primaryCta.block.meta?.target"
        :rel="getRel(primaryCta)"
        class="donation-form__action-link"
      >
        {{ labelForCta(primaryCta, 'Soutenir IndieHost') }}
      </a>
    </div>

    <template
      v-for="note in noteEntries"
      :key="`note-${note.key}`"
    >
      <component
        v-if="note.block.content"
        :is="resolveTag(note.block, 'p')"
        class="donation-form__security"
        v-html="note.block.content"
      />
    </template>

    <template
      v-for="warning in activeWarnings"
      :key="`warning-${warning.key}`"
    >
      <component
        v-if="warning.block.content"
        :is="resolveTag(warning.block, 'p')"
        class="donation-form__env-warn"
        v-html="warning.block.content"
      />
    </template>
  </aside>
</template>

<style lang="scss" scoped src="@/views/Crowdfunding/components/DonationFormPanel/DonationFormPanel.scss"></style>
