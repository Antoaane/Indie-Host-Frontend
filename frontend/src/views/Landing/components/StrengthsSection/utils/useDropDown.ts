// File: src/views/Landing/components/StrengthsSection/utils/useDropDown.ts

export function useDropDown() {
  const strengths = ['#strength_pillar1', '#strength_pillar2', '#strength_pillar3']

  strengths.forEach((el) => {
    const sel = document.querySelector(el)
    if (!(sel instanceof HTMLElement)) return

    sel.addEventListener('click', () => {
      sel.classList.toggle('active')
    })
  })
}