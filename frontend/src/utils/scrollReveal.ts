// File: src/utils/scrollReveal.ts

// sr.ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export interface ScrollRevealOptions {
  x?: number;
  y?: number;
  opacity?: number;
  duration?: number;
  delay?: number;            // 🆕 délai avant le début de l’anim
  stagger?: number;
  ease?: string;
  start?: string;
  end?: string;
  once?: boolean;
  toggle?: string;
  resetOnLeave?: boolean;
}

// Cibles acceptées par GSAP
export type DOMTarget = string | Element | Element[] | NodeListOf<Element>;

export function sr(
  targets: DOMTarget,
  {
    x = 0,
    y = 0,
    opacity = 0,
    duration = 0.75,
    delay = 0.2,               // 🆕 valeur par défaut
    stagger = 0,
    ease = "power2.inOut",
    start = "top 100%",
    end = "bottom 0%",
    once = false,
    toggle,
    resetOnLeave = false,
  }: ScrollRevealOptions = {}
): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.documentElement.classList.contains('is-ios') && window.matchMedia('(max-width: 1024px)').matches) return;
  if (document.documentElement.classList.contains('ios-landing-lite')) return;

  const elements = gsap.utils.toArray<HTMLElement>(targets);

  elements.forEach((el) => {
    const dataset = el.dataset;

    const finalOnce = dataset.srOnce ? dataset.srOnce !== "false" : once;

    const finalToggle =
      dataset.srToggle ||
      toggle ||
      (resetOnLeave && !finalOnce
        ? "play reset play reset"
        : "play none none reverse");

    gsap.from(el, {
      x: Number(dataset.srX ?? x),
      y: Number(dataset.srY ?? y),
      opacity: Number(dataset.srOpacity ?? opacity),
      duration: Number(dataset.srDur ?? duration),
      delay: Number(dataset.srDelay ?? delay),     // 🆕 Delay pris en compte
      ease: dataset.srEase || ease,
      stagger: Number(dataset.srStagger ?? stagger),
      overwrite: "auto",
      scrollTrigger: {
        trigger: el,
        start: dataset.srStart || start,
        end: dataset.srEnd || end,
        once: finalOnce,
        toggleActions: finalToggle,
      },
    });
  });
}
