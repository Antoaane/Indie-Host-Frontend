// File: src/views/Landing/BenefitsSection/utils/useBenefitsAnim.ts

// DEPS
import { onMounted, onUnmounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import CSSRulePlugin from 'gsap/CSSRulePlugin'
// UTILS
import { vp } from '@/utils/viewport'
import { set } from '@vueuse/core'

gsap.registerPlugin(ScrollTrigger, CSSRulePlugin)

// ────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────
const EASE = 'power2.inOut'
const BASE_PC = 2
const BASE_MOB = 0.6

export const totalOta = ref(0)
export const commissionsAnim = ref(0)
export const displayTotalOta = ref(0)

// Calcule les dimensions selon le breakpoint actuel. On RE‑évaluera plus bas via
// matchMedia, donc aucune fuite d’état.
const getSides = (isDesktop: boolean) => ({
  longer: isDesktop ? (100 * 70) / 170 : (100 * 70) / 170,
  shorter: isDesktop ? (100 * 30) / 170 : (100 * 30) / 170,
})

// ────────────────────────────────────────────────────────────────────────────────
// TIMELINE BUILDERS
// ────────────────────────────────────────────────────────────────────────────────
function buildDesktopTimeline() {
  const { longer, shorter } = getSides(true)
  const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } })


  /* ------------------------------------------------------------------------ */
  /* ENTRÉE                                                                   */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('enter')
    .to('#indiehost', { width: `${longer + shorter}%`, duration: BASE_PC }, 'enter')

  tl.addLabel('pre-reveal', `enter+=${BASE_PC * (1 / 2)}`)
    .to('.unfocus', {
      opacity: 0.5,
      duration: BASE_PC / 3
    }, 'pre-reveal')

    .to(
      '.line', {
      transform: 'translate(-50%, -35%) scaleX(1)',
      duration: BASE_PC / 3
    }, 'pre-reveal')

  /* ------------------------------------------------------------------------ */
  /* REVEAL                                                                  */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('reveal', `enter+=${BASE_PC * 0.7}`)
    .to('.animation-desktop .gains .advantages', {
      '--rgd-start': 'rgba(0, 255, 166, 0.6)',
      duration: BASE_PC / 3,
    }, 'reveal')

    .to('.gains .losses', {
      opacity: 1,
      duration: BASE_PC / 3,
    }, 'reveal')

    .to('.gains', {
      right: () => {
        const ctr = document.querySelector<HTMLElement>('#benefits-section')!
        const w = ctr.clientWidth
        const shortPx = w * (shorter / 100)
        return w * 0.5 - shortPx / 2
      },
      opacity: 1,
      ease: 'power2.out',
      duration: BASE_PC / 3
    }, 'reveal')

    .to('.total-gains', {
      width: '7.5rem',
      opacity: 1,
      duration: BASE_PC / 2
    }, 'reveal')

  /* ------------------------------------------------------------------------ */
  /* REVEAL END                                                             */
  /* ------------------------------------------------------------------------ */

  const startVal = totalOta.value - commissionsAnim.value;
  const endVal = totalOta.value;

  // objet factice qu’on va tweener
  const obj = { val: startVal };

  tl.addLabel('reveal-end', `reveal+=${BASE_PC * 0.15}`)
    .to(obj, {
      val: endVal,               // pure JS number → Animated !
      duration: BASE_PC / 2,
      ease: 'power2.out',
      onUpdate() {
        displayTotalOta.value = Math.round(obj.val);
      }
    }, 'reveal-end')

    .to('.advantages .block p', {
      transform: 'translateY(0)',
      duration: BASE_PC / 3,
    }, 'reveal-end')

    .to('#plusvalue', {
      transform: 'translateX(0%)',
      opacity: 1,
      duration: BASE_PC / 3
    }, 'reveal-end')

  /* ------------------------------------------------------------------------ */
  /* EXIT                                                                    */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('exit', `reveal+=${BASE_PC * 0.5}`)

    .to('.animation-desktop .gains', {
      x: '41vw',
      opacity: 0,
      duration: BASE_PC
    }, 'exit')

    .to('#ota', {
      flexGrow: 0,
      flexBasis: 0,
      minWidth: 0,
      duration: BASE_PC
    }, 'exit')

    .to('#indiehost', {
      width: '100%',
      duration: BASE_PC
    }, 'exit')

    .to('.total-gains', {
      width: 0,
      opacity: 0,
      duration: BASE_PC / 1.333
    }, 'exit')

    .to('.ih-total > .total > .result', {
      '--title-bg-direction': '87deg',
      '--title-bg-color-1': 'rgb(223, 153, 255)',
      '--title-bg-color-2': 'rgb(255, 196, 197)',
      '--title-bg-clr1-pos': '0%',
      '--title-bg-clr2-pos': '100%',
      duration: BASE_PC / 1.333
    }, 'exit')

  /* ------------------------------------------------------------------------ */
  /* POST-EXIT                                                               */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('post-exit', `exit+=${BASE_PC * 0.75}`)
    .to('.ih-total > .total', {
      height: '0%',
      opacity: 0,
      duration: BASE_PC / 4,
    }, 'post-exit')
    .to('.ih-total > .conclusion', {
      height: '100%',
      opacity: 1,
      duration: BASE_PC / 4,
    }, 'post-exit')

  return tl
}

function buildMobileTimeline() {
  const { longer, shorter } = getSides(false)
  const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } })

  /* ------------------------------------------------------------------------ */
  /* ENTRÉE                                                                   */
  /* ------------------------------------------------------------------------ */
  tl.addLabel('enter')
    .to('#indiehost', {
      height: `${longer + shorter}%`,
      duration: BASE_MOB * 3
    }, 'enter')

  /* ------------------------------------------------------------------------ */
  /* RING + LOSSES                                                            */
  /* ------------------------------------------------------------------------ */
  tl.addLabel('reveal', 'enter+=1.92')    // 3 * 0.64

  const revealTweens: [gsap.DOMTarget, gsap.TweenVars][] = [
    ['.animation-mobile .gains .advantages',
      {
        '--rgm-size': '133.33% 160%',
        '--rgm-pos-x': '50%',
        '--rgm-pos-y': '0%',
        '--rgm-start': 'rgba(0, 255, 166, 0.6)',
        '--rgm-end': 'rgba(0, 255, 166, 0)',
        duration: BASE_MOB,
      }
    ],
    ['.gains>.losses',
      {
        height: '100%',
        opacity: 1,
        duration: BASE_MOB
      }
    ],
    ['#plusvalue',
      {
        transform: 'translateY(0%)',
        opacity: 1,
        duration: BASE_MOB
      }
    ],
  ]
  revealTweens.forEach(([target, vars]) => tl.to(target, vars, 'reveal'))

  return tl
}

// ────────────────────────────────────────────────────────────────────────────────
// HOOK (sélection de la version via matchMedia)
// ────────────────────────────────────────────────────────────────────────────────
export function useBenefitsAnim() {
  let ctx: gsap.Context | null = null

  onMounted(() => {
    ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      // Desktop ≥ 1024 px -----------------------------------------------------
      mm.add('(min-width:1024px)', () => {
        const tl = buildDesktopTimeline()
        attachScrollTrigger(tl)
        return () => tl.kill()
      })

      // Mobile < 1024 px ------------------------------------------------------
      mm.add('(max-width:1023px)', () => {
        const tl = buildMobileTimeline()
        attachScrollTrigger(tl)
        return () => tl.kill()
      })
    })
  })

  onUnmounted(() => ctx?.revert())
}

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────────
function attachScrollTrigger(tl: gsap.core.Timeline) {
  ScrollTrigger.create({
    trigger: '#benefits-section',
    start: 'top top',
    end: '+=300%',
    scrub: 0.5,
    pin: true,
    anticipatePin: 1,
    animation: tl,
  })
}
