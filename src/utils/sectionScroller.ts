// File: src/utils/sectionScroller.ts

export interface SectionScrollerOptions {
    container?: string | HTMLElement; // par défaut : <main>
    sectionSelector?: string;         // par défaut : 'section'
    filter?: (el: HTMLElement) => boolean;
    duration?: number;                // ms
    threshold?: number;               // deltaY min
}

export function initSectionScroller(opts: SectionScrollerOptions = {}) {
    const {
        container = document.querySelector('main') as HTMLElement,
        sectionSelector = 'section',
        filter = (el: Element): el is HTMLElement =>
            el instanceof HTMLElement && !el.classList.contains('no-snap'),
        duration = 500,
        threshold = 40,
    } = opts;

    const scrollEl: HTMLElement =
        typeof container === 'string'
            ? (document.querySelector(container) as HTMLElement)
            : container;

    if (!scrollEl) {
        console.warn('[sectionScroller] Scroll container not found');
        return { stop() { }, refresh() { } };
    }

    /* ---------------- State ---------------- */
    let sections: HTMLElement[] = [];
    let positions: number[] = [];
    let current = 0;
    let isAnimating = false;

    /* ---------------- Utilities ---------------- */
    const easeInOut = (t: number) =>
        t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const touchBlock = (e: TouchEvent) => e.preventDefault();

    const offsetWithinContainer = (el: HTMLElement) => {
        const elRect = el.getBoundingClientRect();
        const cRect = scrollEl.getBoundingClientRect();
        return elRect.top - cRect.top + scrollEl.scrollTop;
    };

    const lockScroll = () => {
        isAnimating = true;
        scrollEl.style.pointerEvents = 'none';
        scrollEl.style.scrollbarGutter = 'stable';
        scrollEl.addEventListener('touchmove', touchBlock, { passive: false });
    };

    const unlockScroll = () => {
        isAnimating = false;
        scrollEl.style.pointerEvents = 'auto';
        scrollEl.removeEventListener('touchmove', touchBlock);
    };

    /* ---------------- Refresh Sections ---------------- */
    const refresh = () => {
        sections = Array.from(scrollEl.querySelectorAll(sectionSelector)) as HTMLElement[];
        sections = sections.filter(filter)
        positions = sections.map(
            (s) => offsetWithinContainer(s) - (scrollEl.clientHeight - s.offsetHeight) / 2
        );
        console.log('[sectionScroller] Sections:', sections);
    };

    /* ---------------- Animation Core ---------------- */
    const animate = (start: number, end: number, startTime: number, index: number) => {
        const now = performance.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = easeInOut(progress);
        scrollEl.scrollTop = start + (end - start) * eased;

        if (progress < 1) {
            requestAnimationFrame(() => animate(start, end, startTime, index));
        } else {
            unlockScroll();
            current = index;
        }
    };

    /* ---------------- Public scrollTo ---------------- */
    const scrollToIndex = (i: number) => {
        if (isAnimating || i === current || i < 0 || i >= sections.length) return;
        const start = scrollEl.scrollTop;
        const end = positions[i];

        lockScroll();
        requestAnimationFrame(() => animate(start, end, performance.now(), i));
    };

    /* ---------------- Wheel Handler ---------------- */
    const onWheel = (e: WheelEvent) => {
        if (isAnimating || Math.abs(e.deltaY) < threshold) return;
        e.preventDefault();
        scrollToIndex(current + (e.deltaY > 0 ? 1 : -1));
    };

    /* ---------------- Init ---------------- */
    refresh();
    scrollEl.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', refresh);

    const stop = () => {
        scrollEl.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', refresh);
    };

    return { stop, refresh };
}
