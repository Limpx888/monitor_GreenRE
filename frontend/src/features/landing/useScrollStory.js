import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling (Lenis) + scroll-driven story (GSAP ScrollTrigger):
 * - writes overall page progress (0..1) into progressRef for the 3D camera
 * - reveals [data-reveal] elements as they enter
 * - moves [data-speed] layers at different rates (parallax)
 * - plays the hero headline word reveal ([data-hero-word])
 * All motion is skipped under prefers-reduced-motion (native scroll, no animation).
 */
export function useScrollStory(rootRef, progressRef, reducedMotion) {
  const lenisRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let tick;
    if (!reducedMotion) {
      const lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.9 });
      lenisRef.current = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      tick = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => { progressRef.current = self.progress; },
      });

      if (reducedMotion) return;

      gsap.from('[data-hero-word]', { yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.055, delay: 0.5 });
      gsap.from('[data-hero-fade]', { y: 18, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 1.1 });

      gsap.utils.toArray('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 48,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          delay: Number(el.dataset.revealDelay || 0),
          scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
        });
      });

      gsap.utils.toArray('[data-speed]').forEach((el) => {
        const speed = Number(el.dataset.speed);
        gsap.to(el, {
          yPercent: -100 * speed,
          ease: 'none',
          scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    }, root);

    return () => {
      ctx.revert();
      if (tick) gsap.ticker.remove(tick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [rootRef, progressRef, reducedMotion]);

  /** Smooth-scroll to an element (falls back to native scrolling). */
  const scrollTo = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 1.6 });
    else el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return { scrollTo };
}
