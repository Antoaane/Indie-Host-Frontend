// File: src/views/Landing/components/StrengthsSection/utils/useStrengthsAnim.ts

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function useStrengthsAnim() {
  gsap.registerPlugin(ScrollTrigger)
  if (typeof document === 'undefined') return

  const section = document.querySelector<HTMLElement>('#strengths-section')
  if (!section) return

  // Les ids suivent `pillar.id` (`strength_pillar1`…) : on cible les cartes par classe.
  const strengths = Array.from(section.querySelectorAll<HTMLElement>('.strength'))
  if (!strengths.length) return

  const stagger = 0.1
  const duration = 0.5
  const bgStart = 'rgba(252, 250, 250, 0)'
  const bgEnd = 'rgba(252, 250, 250, 0.15)'

  const tl = gsap.timeline({ paused: true })
    .addLabel('start')

  // --- phase "start" : on dévoile les div puis les span, en cascade
  strengths.forEach((el, i) => {
    const offset = `start+=${i * stagger}`
    const backgroundTarget = el.querySelector(':scope > div')
    const labelTarget = el.querySelector(':scope > span')
    if (backgroundTarget) {
      tl.to(backgroundTarget, { background: bgStart, ease: 'power3.out', duration }, offset)
    }
    if (labelTarget) {
      tl.to(labelTarget, { opacity: 1, ease: 'power3.out', duration }, offset)
    }
  })

  // calcul automatique de quand démarrer la phase "end"
  const totalStartDur = (strengths.length - 1) * stagger + duration
  tl.addLabel('end', `start+=${totalStartDur - (totalStartDur / 2)}`)

  // --- phase "end" : on remet tout en place, même cadence
  strengths.forEach((el, i) => {
    const offset = `end+=${i * stagger}`
    const backgroundTarget = el.querySelector(':scope > div')
    const labelTarget = el.querySelector(':scope > span')
    if (backgroundTarget) {
      tl.to(backgroundTarget, { background: bgEnd, ease: 'power2.out', duration }, offset)
    }
    if (labelTarget) {
      tl.to(labelTarget, { opacity: 0, ease: 'power2.out', duration }, offset)
    }
  })

  ScrollTrigger.create({
    trigger: section,
    start: 'center 60%',
    onEnter: () => tl.play(),
    onLeaveBack: () => tl.reverse(),
  })
}
