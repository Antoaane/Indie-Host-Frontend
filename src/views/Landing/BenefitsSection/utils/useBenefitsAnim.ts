// File: src/views/Landing/BenefitsSection/utils/useBenefitsAnim.ts

// DEPS
import { onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import CSSRulePlugin from 'gsap/CSSRulePlugin'

// UTILS
import { vp } from '@/utils/viewport'

export function useBenefitsAnim() {
  gsap.registerPlugin(ScrollTrigger, CSSRulePlugin)
  let tl_desktop: gsap.core.Timeline | null = null
  let tl_mobile: gsap.core.Timeline | null = null

  // Animation & Size variables
  const longerSide = vp.lg.value ? (100 * 80) / 180 : (100 * 70) / 170
  const shorterSide = vp.lg.value ? (100 * 20) / 180 : (100 * 30) / 170
  const baseDuration = 0.75

  onMounted(() => {
    tl_desktop = gsap.timeline({ paused: true })

    console.log('vp.lg.value', vp.lg.value)

    if (vp.lg.value) {
      tl_desktop
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
          '.animation-desktop .gains .advantages',
          {
            '--rgd-size': '100% 133.33%',
            '--rgd-pos-x': '100%',
            '--rgd-pos-y': '50%',
            '--rgd-start': 'rgba(0, 255, 166, 0.6)',
            '--rgd-end': 'rgba(0, 255, 166, 0)',
            ease: 'power2.out',
            delay: baseDuration * 3 * 0.85,
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
          '.unfocus',
          {
            opacity: 0.5,
            ease: 'power2.out',
            delay: baseDuration * 3 * 0.64,
            duration: baseDuration * 1,
          },
          'start',
        )
        .to(
          '.line',
          {
            transform: 'translate(-50%, -35%) scaleX(1)',
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
        .to(
          '.animation-desktop .gains',
          {
            transform: 'translateX(45vw)',
            opacity: 0,
            ease: 'power2.out',
            delay: baseDuration * 4,
            duration: baseDuration * 2.5,
          },
          'start',
        )
        .to(
          '#ota',
          {
            flexGrow: 0,
            flexBasis: 0,
            minWidth: '0%',
            ease: 'power2.out',
            delay: baseDuration * 4,
            duration: baseDuration * 2.5,
          },
          'start',
        )
        .to(
          '#indiehost',
          {
            width: '100%',
            ease: 'power2.out',
            delay: baseDuration * 4,
            duration: baseDuration * 2.5,
          },
          'start',
        )
    }

    tl_mobile = gsap.timeline({ paused: true })

    tl_mobile
      .addLabel('start')
      .to(
        '#indiehost',
        {
          height: `${longerSide + shorterSide}%`,
          ease: 'power2.inOut',
          duration: baseDuration * 3,
        },
        'start',
      )
      .to(
        '.animation-mobile .gains .advantages',
        {
          '--rgm-size': '133.33% 160%',             // grossir le cercle
          '--rgm-pos-x': '50%',                  // déplacer le centre
          '--rgm-pos-y': '0%',                  // déplacer le centre
          '--rgm-start': 'rgba(0, 255, 166, 0.6)',
          '--rgm-end': 'rgba(0, 255, 166, 0)',
          ease: 'power2.out',
          delay: baseDuration * 3.5 * 0.64,
          duration: baseDuration * 1,
        },
        'start',
      )
      .to(
        '.gains>.losses',
        {
          height: '100%',
          opacity: '1',
          ease: 'power2.out',
          delay: baseDuration * 3 * 0.64,
          duration: baseDuration * 1,
        },
        'start',
      )
      .to(
        '#plusvalue',
        {
          transform: 'translateY(0%)',
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
      end: '+=200%',
      scrub: 0.5,
      pin: true,
      animation: vp.lg.value ? tl_desktop : tl_mobile,
      anticipatePin: 1,
    })
  })

  onUnmounted(() => {
    tl_desktop?.kill()
    tl_mobile?.kill()
    ScrollTrigger.getAll().forEach(t => t.kill())
  })
}
