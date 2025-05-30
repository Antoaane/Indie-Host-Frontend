// File: src/views/Landing/BenefitsSection/utils/useBenefitsAnim.ts

import { onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import CSSRulePlugin from 'gsap/CSSRulePlugin'

export function useBenefitsAnim() {
  gsap.registerPlugin(ScrollTrigger, CSSRulePlugin)
  let tl: gsap.core.Timeline | null = null

  // Animation & Size variables
  const longerSide = (100 * 80) / 180 // in percent
  const shorterSide = (100 * 20) / 180 // in percent
  const baseDuration = 0.75

  onMounted(() => {
    tl = gsap.timeline({ paused: true })

    tl
      .addLabel('start')
      .to(
        '#indiehost',
        {
          width: `${longerSide + shorterSide}%`,
          ease: 'power2.inOut',
          duration: baseDuration * 3,
        },
        'start',
      )
      .to(
        '.gains',
        {
          '--gains-color': '0, 255, 166',
          ease: 'power2.out',
          delay: baseDuration * 3 * 0.64,
          duration: baseDuration * 1,
        },
        'start',
      )
      .to(
        '.gains>.losses',
        {
          width: '100%',
          opacity: '1',
          ease: 'power2.out',
          delay: baseDuration * 3 * 0.64,
          duration: baseDuration * 1,
        },
        'start',
      )
      .to(
        '.line',
        {
          transform: 'translateX(-50%) scaleX(1)',
          ease: 'power2.out',
          delay: baseDuration * 3 * 0.64,
          duration: baseDuration * 1,
        },
        'start',
      )
      .to(
        '#plusvalue',
        {
          transform: 'translateX(0%)',
          opacity: '1',
          ease: 'power2.out',
          delay: baseDuration * 3 * 0.64,
          duration: baseDuration * 1,
        },
        'start',
      )

    ScrollTrigger.create({
      trigger: '#benefits-section',
      start: 'top top',
      end: '+=150%',
      scrub: 0.5,
      pin: true,
      animation: tl,
      anticipatePin: 1,
    })
  })

  onUnmounted(() => {
    tl?.kill()
    ScrollTrigger.getAll().forEach(t => t.kill())
  })
}
