<!-- File: src/components/svgs/icons/BurgerMenu.vue -->

<template>
    <svg class="burger-icon" :class="{ active: isActive }" width="36" height="29" viewBox="0 0 36 29" fill="none"
        xmlns="http://www.w3.org/2000/svg" role="button" :aria-pressed="isActive" aria-label="Menu" tabindex="0"
        @click="toggle" @keydown.enter.space.prevent="toggle">
        <g clip-path="url(#clip0)">
            <rect ref="top" class="line" x="8" y="0.5" width="28" height="3" rx="1.5" />
            <rect ref="middle" class="line" y="13" width="36" height="3" rx="1.5" />
            <rect ref="bottom" class="line" y="25.5" width="36" height="3" rx="1.5" />
        </g>
        <defs>
            <clipPath id="clip0">
                <rect width="36" height="28" fill="white" transform="translate(0 0.5)" />
            </clipPath>
        </defs>
    </svg>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import gsap from 'gsap'

// Props
const props = defineProps<{
    modelValue?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'toggle'])

const isActive = ref(props.modelValue ?? false)
const top = ref<SVGRectElement>()
const middle = ref<SVGRectElement>()
const bottom = ref<SVGRectElement>()

const toggle = () => {
    isActive.value = !isActive.value
    animate(isActive.value)
    emit('update:modelValue', isActive.value)
    emit('toggle', isActive.value)
}

// external modelValue changes
watch(() => props.modelValue, (val) => {
    if (val !== isActive.value) {
        isActive.value = val ?? false
        animate(isActive.value)
    }
})

const animate = (active: boolean) => {
    if (!top.value || !middle.value || !bottom.value) return

    if (active) {
        gsap.to(top.value, {
            duration: 0.3,
            y: 12.5,
            rotation: 45,
            transformOrigin: 'center center'
        })
        gsap.to(middle.value, {
            duration: 0.3,
            opacity: 0
        })
        gsap.to(bottom.value, {
            duration: 0.3,
            y: -12.5,
            rotation: -45,
            transformOrigin: 'center center'
        })
    } else {
        gsap.to(top.value, {
            duration: 0.3,
            y: 0,
            rotation: 0
        })
        gsap.to(middle.value, {
            duration: 0.3,
            opacity: 1
        })
        gsap.to(bottom.value, {
            duration: 0.3,
            y: 0,
            rotation: 0
        })
    }
}

onMounted(() => {
    animate(isActive.value)
})
</script>

<style scoped>
.burger-icon {
    cursor: pointer;
}

.line {
    fill: #111117;
}
</style>