// File: src/views/Landing/BenefitsSection/utils/useBenefitsAnim.ts

// DEPS
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
const BASE_DURATION = 2

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
    .to('#indiehost', {
      width: `${longer + shorter}%`,
      duration: BASE_DURATION
    }, 'enter')

  tl.addLabel('pre-reveal', `enter+=${BASE_DURATION * 0.5}`)
    .to('.unfocus', {
      opacity: 0.5,
      duration: BASE_DURATION / 3
    }, 'pre-reveal')

    .to(
      '.line', {
      transform: 'translate(-50%, -35%) scaleX(1)',
      duration: BASE_DURATION / 3
    }, 'pre-reveal')

  /* ------------------------------------------------------------------------ */
  /* REVEAL                                                                  */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('reveal', `enter+=${BASE_DURATION * 0.7}`)
    .to('.animation-desktop .gains .advantages', {
      '--rgd-start': 'rgba(0, 255, 166, 0.6)',
      duration: BASE_DURATION / 3,
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
      duration: BASE_DURATION / 3
    }, 'reveal')

    .to('.total-gains', {
      width: '7.5rem',
      opacity: 1,
      duration: BASE_DURATION / 2
    }, 'reveal')

  /* ------------------------------------------------------------------------ */
  /* REVEAL END                                                             */
  /* ------------------------------------------------------------------------ */

  // const endVal = totalOta.value;

  const obj = { val: displayTotalOta.value }

  tl.addLabel('reveal-end', `reveal+=${BASE_DURATION * 0.15}`)
  const revealTween = tl.to(obj, {
    // target dynamique : GSAP évaluera la fonction à chaque invalidation/replay
    val: () => totalOta.value,
    duration: BASE_DURATION / 2,
    ease: 'power2.out',
    onUpdate() {
      displayTotalOta.value = Math.round(obj.val)   // ici obj.val est déjà un number
    }
  }, 'reveal-end')

    .to('.advantages .block p', {
      transform: 'translateY(0)',
      duration: BASE_DURATION / 3,
    }, 'reveal-end')

    .to('#plusvalue', {
      transform: 'translateX(0%)',
      opacity: 1,
      duration: BASE_DURATION / 3
    }, 'reveal-end')

  /* ------------------------------------------------------------------------ */
  /* EXIT                                                                    */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('exit', `reveal+=${BASE_DURATION * 0.5}`)

    .to('.animation-desktop .gains', {
      x: '41vw',
      opacity: 0,
      duration: BASE_DURATION
    }, 'exit')

    .to('#ota', {
      flexGrow: 0,
      flexBasis: 0,
      minWidth: 0,
      duration: BASE_DURATION
    }, 'exit')

    .to('#indiehost', {
      width: '100%',
      duration: BASE_DURATION
    }, 'exit')

    .to('.total-gains', {
      width: 0,
      opacity: 0,
      duration: BASE_DURATION / 1.333
    }, 'exit')

    .to('.ih-total > .total > .result', {
      '--title-bg-direction': '87deg',
      '--title-bg-color-1': 'rgb(223, 153, 255)',
      '--title-bg-color-2': 'rgb(255, 196, 197)',
      '--title-bg-clr1-pos': '0%',
      '--title-bg-clr2-pos': '100%',
      duration: BASE_DURATION / 1.333
    }, 'exit')

  /* ------------------------------------------------------------------------ */
  /* POST-EXIT                                                               */
  /* ------------------------------------------------------------------------ */

  tl.addLabel('post-exit', `exit+=${BASE_DURATION * 0.75}`)
    .to('.ih-total > .total', {
      height: '0%',
      opacity: 0,
      duration: BASE_DURATION / 4,
    }, 'post-exit')
    .to('.ih-total > .conclusion', {
      height: '100%',
      opacity: 1,
      duration: BASE_DURATION / 4,
    }, 'post-exit')

  watch([totalOta, commissionsAnim], () => {
    obj.val = totalOta.value - commissionsAnim.value
    revealTween.vars.val = totalOta.value

    const p = tl.progress()      // on mémorise la position actuelle
    tl.invalidate()              // on nettoie les caches du timeline
    tl.progress(p)               // …mais on garde le même progrès

    ScrollTrigger.refresh()      // ← LA ligne qui manquait
  })

  return tl
}


function buildMobileTimeline() {
  const { longer, shorter } = getSides(false)
  const tl = gsap.timeline({ paused: true, defaults: { ease: EASE } })

  /* ---------------------------------------------------------------------- */
  /* ENTRÉE                                                                 */
  /* ---------------------------------------------------------------------- */
  tl.addLabel('enter')
    .to('#indiehost', {
      height: `${longer + shorter}%`,
      duration: BASE_DURATION,               // même ratio que desktop mais vertical
    }, 'enter')

  /* ---------------------------------------------------------------------- */
  /* PRE-REVEAL : petite mise en bouche                                      */
  /* ---------------------------------------------------------------------- */
  tl.addLabel('pre-reveal', `enter+=${BASE_DURATION * 0.5}`)
    .to('.unfocus', {
      opacity: 0.5,
      duration: BASE_DURATION / 3
    }, 'pre-reveal')
    .to('.line', {
      transform: 'translate(-50%, -35%) scaleX(1)',
      duration: BASE_DURATION / 3
    }, 'pre-reveal')

  /* ---------------------------------------------------------------------- */
  /* REVEAL                                                                 */
  /* ---------------------------------------------------------------------- */
  tl.addLabel('reveal', `enter+=${BASE_DURATION * 0.6}`)
    .to('.animation-mobile .gains .advantages', {
      '--rgm-start': 'rgba(0, 255, 166, 0.6)',
      duration: BASE_DURATION,
    }, 'reveal')
    .to('.gains', {
      bottom: `${longer}%`,
      opacity: 1,
      ease: 'power1.out',
      duration: BASE_DURATION / 3
    }, 'reveal')
    .to('#badvalue', {
      maxHeight: '0',
      opacity: 0,
      duration: BASE_DURATION / 3
    }, 'reveal')
    .to('#plusvalue', {
      maxHeight: '2rem',
      opacity: 1,
      duration: BASE_DURATION / 3
    }, 'reveal')
    .to('.total-gains', {
      height: '1.5rem', opacity: 1,
      duration: BASE_DURATION * 1.2
    }, 'reveal')

  /* ---------------------------------------------------------------------- */
  /* REVEAL-END : incrément du chiffre live                                 */
  /* ---------------------------------------------------------------------- */
  const obj = { val: displayTotalOta.value }

  tl.addLabel('reveal-end', `reveal+=${BASE_DURATION * 0.2}`)
  const revealTween = tl.to(obj, {
    val: () => totalOta.value,
    duration: BASE_DURATION * 1.2,
    onUpdate() {
      displayTotalOta.value = Math.round(obj.val)
    },
  }, 'reveal-end')
    .to('.advantages .block p', {
      transform: 'translateY(0)',
      duration: BASE_DURATION,
    }, 'reveal-end')

  /* ---------------------------------------------------------------------- */
  /* EXIT : on laisse place à la conclusion                                 */
  /* ---------------------------------------------------------------------- */
  tl.addLabel('exit', `reveal+=${BASE_DURATION * 2}`)
    .to('.animation-mobile .gains', {
      y: '-26vh',
      opacity: 0,
      duration: BASE_DURATION * 1.5,
    }, 'exit')
    .to('#ota', {
      flexGrow: 0,
      flexBasis: 0,
      minHeight: 0,
      duration: BASE_DURATION * 1.5
    }, 'exit')
    .to('#indiehost', {
      height: '100%',
      duration: BASE_DURATION * 1.5
    }, 'exit')
    .to('.total-gains', {
      height: 0,
      opacity: 0,
      duration: BASE_DURATION
    }, 'exit')
    .to('.ih-total > .total > .result', {
      '--title-bg-direction': '87deg',
      '--title-bg-color-1': 'rgb(223, 153, 255)',
      '--title-bg-color-2': 'rgb(255, 196, 197)',
      '--title-bg-clr1-pos': '0%',
      '--title-bg-clr2-pos': '100%',
      duration: BASE_DURATION,
    }, 'exit')

  /* ---------------------------------------------------------------------- */
  /* POST-EXIT : switch “total” → “conclusion”                              */
  /* ---------------------------------------------------------------------- */
  // tl.addLabel('post-exit', `exit+=${BASE_DURATION}`)
  // .to('.ih-total > .total', {
  //   height: '0%', opacity: 0,
  //   duration: BASE_DURATION / 2
  // }, 'post-exit')
  // .to('.ih-total > .conclusion', {
  //   height: '100%', opacity: 1,
  //   duration: BASE_DURATION / 2
  // }, 'post-exit')

  /* ---------------------------------------------------------------------- */
  /* WATCHERS : valeurs dynamiques                                          */
  /* ---------------------------------------------------------------------- */
  watch([totalOta, commissionsAnim], () => {
    obj.val = totalOta.value - commissionsAnim.value
    revealTween.vars.val = totalOta.value

    const p = tl.progress()
    tl.invalidate().progress(p)
    ScrollTrigger.refresh()
  })

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
    invalidateOnRefresh: true,
  })
}
