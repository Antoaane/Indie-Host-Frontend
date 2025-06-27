// File: src/views/Landing/StrengthsSection/utils/useDropDown.ts

import { onMounted } from 'vue'
import gsap from 'gsap'

export function useDropDown() {
  console.log('[useDropDown] : started');

  console.log('[useDropDown] : mounted');

  const strengths = ['#strength_1', '#strength_2', '#strength_3']

  strengths.forEach(el => {
    // const el = '#strength_1';
    const sel = document.querySelector(el)

    sel?.addEventListener('click', () => {
      console.log('[useDropDown] : clicked');

      const tlForward = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })
      const tlBackward = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })

      tlForward.addLabel('playForward')
        .to(`${el} > div > p`, {
          maxHeight: '150vh',
          duration: 1,
          ease: 'power2.inOut',
        }, 'playForward')
        .to(`${el} > div span`, {
          opacity: '1',
          delay: 0.5,
          duration: 0.25,
          ease: 'power2.inOut',
        }, 'playForward')
        .to(`${el} > div span`, {
          height: '1px',
          duration: 0.25,
          ease: 'power2.inOut',
        }, 'playForward')
        .to(`${el} > div`, {
          gap: '1.5rem',
          duration: 1,
          ease: 'power2.inOut',
        }, 'playForward')
        .to(`${el} > div > .trigger > .chevron-down`, {
          rotate: '180deg',
          duration: 0.5,
          ease: 'power2.inOut',
        }, 'playForward')
        .to(`${el} > div > .trigger > p`, {
          maxHeight: '0',
          paddingTop: '0',
          marginBottom: '0',
          duration: 0.5,
          ease: 'power2.inOut',
        }, 'playForward')

      tlBackward.addLabel('playBackward')
        .to(`${el} > div > p`, {
          maxHeight: '0',
          duration: 0.75,
          ease: 'power2.inOut',
        }, 'playBackward')
        .to(`${el} > div span`, {
          opacity: '0',
          duration: 0.15,
          ease: 'power2.inOut',
        }, 'playForward')
        .to(`${el} > div span`, {
          height: '0px',
          duration: 0.15,
          ease: 'power2.inOut',
        }, 'playBackward')
        .to(`${el} > div`, {
          gap: '0rem',
          delay: 0.25,
          duration: 0.75,
          ease: 'power2.inOut',
        }, 'playBackward')
        .to(`${el} > div > .trigger > .chevron-down`, {
          rotate: '0deg',
          duration: 0.5,
          ease: 'power2.inOut',
        }, 'playBackward')
        .to(`${el} > div > .trigger > p`, {
          maxHeight: '1.5rem',
          paddingTop: '0.25rem',
          marginBottom: '0.25rem',
          delay: 0.5,
          duration: 0.5,
          ease: 'power2.inOut',
        }, 'playBackward')

      if (sel?.classList.contains('active')) {
        console.log('[useDropDown] : removing active');
        sel?.classList.remove('active')

        tlBackward.play()
      } else {
        console.log('[useDropDown] : adding active');
        sel?.classList.add('active')

        tlForward.play()
      }

    })
  });
}