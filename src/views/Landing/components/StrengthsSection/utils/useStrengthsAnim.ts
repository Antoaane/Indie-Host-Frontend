// File: src/views/Landing/StrengthsSection/utils/useStrengthsAnim.ts

import { onMounted } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function useStrengthsAnim() {
  gsap.registerPlugin(ScrollTrigger)

  onMounted(() => {
    const strengths = ['#strength_1', '#strength_2', '#strength_3']
    const stagger = 0.1
    const duration = 0.5
    const bgStart = 'rgba(252, 250, 250, 0)'
    const bgEnd = 'rgba(252, 250, 250, 0.15)'

    const tl = gsap.timeline({ paused: true })
      .addLabel('start')

    // --- phase "start" : on dévoile les div puis les span, en cascade
    strengths.forEach((el, i) => {
      const offset = `start+=${i * stagger}`
      tl.to(`${el} > div`, { background: bgStart, ease: 'power2.inOut', duration }, offset)
        .to(`${el} > span`, { opacity: 1, ease: 'power2.inOut', duration }, offset)
    })

    // calcul automatique de quand démarrer la phase "end"
    const totalStartDur = (strengths.length - 1) * stagger + duration
    tl.addLabel('end', `start+=${totalStartDur - (totalStartDur / 2)}`)

    // --- phase "end" : on remet tout en place, même cadence
    strengths.forEach((el, i) => {
      const offset = `end+=${i * stagger}`
      tl.to(`${el} > div`, { background: bgEnd, ease: 'power2.inOut', duration }, offset)
        .to(`${el} > span`, { opacity: 0, ease: 'power2.inOut', duration }, offset)
    })

    // scroll trigger
    ScrollTrigger.create({
      trigger: '#strengths-section',
      start: 'center 60%',
      onEnter: () => tl.play(),
      onLeaveBack: () => tl.reverse(),
    })
  })
}
