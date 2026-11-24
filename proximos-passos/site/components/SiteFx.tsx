"use client";

import { useEffect } from "react";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function SiteFx() {
  useEffect(() => {
    const $$ = (s: string) => Array.from(document.querySelectorAll(s)) as HTMLElement[];
    const q = (s: string) => document.querySelector(s) as HTMLElement | null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const ease = "cubic-bezier(.2,.7,.2,1)";

    const offs: (() => void)[] = [];
    const on = (el: EventTarget, ev: string, fn: EventListenerOrEventListenerObject) => {
      el.addEventListener(ev, fn);
      offs.push(() => el.removeEventListener(ev, fn));
    };
    const done = new WeakSet<HTMLElement>();
    const fresh = (el: HTMLElement) => { if (done.has(el)) return false; done.add(el); return true; };
    const pending = new Set<HTMLElement>();

    // ---- one-time effects ----
    $$("[data-grain]").forEach((el) => { if (fresh(el)) el.style.backgroundImage = GRAIN; });

    $$("[data-intro]").forEach((el) => {
      if (!fresh(el) || reduced) return;
      el.animate(
        [{ opacity: 0, transform: "translateY(36px)", filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0px)" }],
        { duration: 1100, delay: +(el.dataset.delay || 0), easing: ease, fill: "backwards" }
      );
    });

    $$("[data-wipe]").forEach((el) => {
      if (!fresh(el) || reduced) return;
      el.animate(
        [{ backgroundSize: "0% 100%", color: "#FFFFFF" }, { backgroundSize: "100% 100%", color: "#0A0A0A" }],
        { duration: 750, delay: +(el.dataset.delay || 0), easing: "cubic-bezier(.7,0,.2,1)", fill: "backwards" }
      );
    });

    const vh0 = innerHeight;
    ["data-reveal", "data-stagger", "data-clip"].forEach((k) =>
      $$("[" + k + "]").forEach((el) => {
        if (!fresh(el) || reduced) return;
        if (el.getBoundingClientRect().top < vh0 * 0.9) return;
        (el as HTMLElement & { _rk?: string })._rk = k;
        pending.add(el);
      })
    );

    $$("[data-pattern]").forEach((el) => { if (fresh(el) && !reduced) el.animate([{ backgroundPosition: "0px 0px" }, { backgroundPosition: "240px 0px" }], { duration: 9000, iterations: Infinity }); });
    $$("[data-hint-dot]").forEach((el) => { if (fresh(el) && !reduced) el.animate([{ transform: "translateY(-10px)", opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "translateY(44px)", opacity: 0 }], { duration: 1800, iterations: Infinity, easing: "ease-in-out" }); });
    $$("[data-pulse]").forEach((el) => { if (fresh(el) && !reduced) el.animate([{ boxShadow: "0 0 0 0 rgba(251,192,9,.65)" }, { boxShadow: "0 0 0 10px rgba(251,192,9,0)" }], { duration: 1600, iterations: Infinity }); });
    $$("[data-float]").forEach((el) => { if (fresh(el) && !reduced) el.animate([{ transform: "translateY(0px)" }, { transform: "translateY(-12px)" }, { transform: "translateY(0px)" }], { duration: 5200, delay: +(el.dataset.delay || 0), iterations: Infinity, easing: "ease-in-out" }); });

    $$("[data-tilt-zone]").forEach((z) => {
      if (!fresh(z)) return;
      const t = z.querySelector("[data-tilt]") as HTMLElement | null;
      const g = z.querySelector("[data-glare]") as HTMLElement | null;
      if (!t) return;
      on(z, "pointermove", (e) => {
        const ev = e as PointerEvent;
        const r = t.getBoundingClientRect();
        const x = Math.max(-0.6, Math.min(0.6, (ev.clientX - r.left) / r.width - 0.5));
        const y = Math.max(-0.6, Math.min(0.6, (ev.clientY - r.top) / r.height - 0.5));
        t.style.transform = "rotateX(" + (-y * 22).toFixed(2) + "deg) rotateY(" + (x * 26).toFixed(2) + "deg)";
        if (g) g.style.background = "radial-gradient(circle at " + ((x + 0.5) * 100).toFixed(1) + "% " + ((y + 0.5) * 100).toFixed(1) + "%, rgba(255,255,255,.26), rgba(255,255,255,0) 55%)";
      });
      on(z, "pointerleave", () => { t.style.transform = ""; if (g) g.style.background = ""; });
    });

    $$("[data-mag]").forEach((el) => {
      if (!fresh(el) || coarse) return;
      on(el, "pointermove", (e) => {
        const ev = e as PointerEvent;
        const r = el.getBoundingClientRect();
        el.style.transform = "translate(" + ((ev.clientX - r.left - r.width / 2) * 0.2).toFixed(1) + "px," + ((ev.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px)";
      });
      on(el, "pointerleave", () => { el.style.transform = ""; });
    });

    $$("[data-hero]").forEach((hero) => {
      if (!fresh(hero)) return;
      const s = hero.querySelector("[data-spot]") as HTMLElement | null;
      if (!s) return;
      const paint = (x: number, y: number) => { s.style.background = "radial-gradient(560px circle at " + x + "px " + y + "px, rgba(251,192,9,.14), rgba(251,192,9,0) 62%)"; };
      paint(hero.clientWidth / 2, hero.clientHeight * 0.42);
      on(hero, "pointermove", (e) => { const ev = e as PointerEvent; const r = hero.getBoundingClientRect(); paint(ev.clientX - r.left, ev.clientY - r.top); });
    });

    $$("[data-neon]").forEach((n) => {
      if (!fresh(n)) return;
      on(n, "pointerenter", () => {
        if (reduced) return;
        n.querySelectorAll("[data-neon-lit],[data-neon-glow]").forEach((l) =>
          (l as HTMLElement).animate([{ opacity: 1 }, { opacity: 0.12, offset: 0.2 }, { opacity: 1, offset: 0.3 }, { opacity: 0.35, offset: 0.5 }, { opacity: 1, offset: 0.6 }, { opacity: 1 }], { duration: 650 })
        );
      });
    });

    $$("[data-w]").forEach((w) => { if (fresh(w)) w.style.transition = "color .35s ease, background-size .6s cubic-bezier(.7,0,.2,1)"; });

    // ---- element cache ----
    const E = {
      bar: q("[data-progress]"),
      heroInner: q("[data-hero-inner]"),
      man: q("[data-manifesto]"),
      words: $$("[data-w]"),
      pin: q("[data-pin]"),
      liquid: q("[data-liquid]"),
      wave: q("[data-wave]"),
      strawDark: q("[data-strawdark]"),
      steps: $$("[data-step]"),
      count: q("[data-count]"),
      marq: $$("[data-marq]"),
      spin: $$("[data-spin-scroll]"),
      par: $$("[data-par]"),
    };
    let step = -1;

    // ---- neon intro + idle flicker ----
    const neonAnims: Animation[] = [];
    const lit = $$("[data-neon-lit],[data-neon-glow]");
    if (lit.length && !reduced) {
      const intro = [{ opacity: 0 }, { opacity: 0, offset: 0.22 }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.3 }, { opacity: 0.9, offset: 0.34 }, { opacity: 0.1, offset: 0.46 }, { opacity: 1, offset: 0.5 }, { opacity: 0.3, offset: 0.62 }, { opacity: 1, offset: 0.66 }, { opacity: 1 }];
      const loop = [{ opacity: 1 }, { opacity: 1, offset: 0.86 }, { opacity: 0.2, offset: 0.87 }, { opacity: 1, offset: 0.885 }, { opacity: 0.45, offset: 0.9 }, { opacity: 1, offset: 0.915 }, { opacity: 1 }];
      lit.forEach((el) => {
        const a = el.animate(intro, { duration: 2000, delay: 250, fill: "backwards" });
        neonAnims.push(a);
        a.onfinish = () => { neonAnims.push(el.animate(loop, { duration: 7000, iterations: Infinity })); };
      });
    }

    // ---- reveal helpers ----
    const playReveal = (el: HTMLElement & { _rk?: string }) => {
      pending.delete(el);
      const dl = +(el.dataset.delay || 0);
      if (el._rk === "data-stagger") {
        Array.from(el.children).forEach((c, i) => (c as HTMLElement).animate([{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: i * 70, easing: ease, fill: "backwards" }));
      } else if (el._rk === "data-clip") {
        el.animate([{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)" }], { duration: 1100, delay: dl, easing: "cubic-bezier(.7,0,.2,1)", fill: "backwards" });
      } else {
        el.animate([{ opacity: 0, transform: "translateY(56px)" }, { opacity: 1, transform: "none" }], { duration: 1000, delay: dl, easing: ease, fill: "backwards" });
      }
    };
    const flushReveals = () => {
      if (!pending.size) return;
      const vh = innerHeight;
      Array.from(pending).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0) pending.delete(el);
        else if (r.top < vh * 0.94) playReveal(el);
      });
    };

    const setStep = (s: number) => {
      E.steps.forEach((el, i) => {
        const isOn = i === s;
        const t = el.querySelector("[data-step-title]") as HTMLElement | null;
        const d = el.querySelector("[data-step-desc]") as HTMLElement | null;
        if (t) t.style.color = isOn ? "#FFFFFF" : "#8C8C8C";
        if (d) { d.style.maxHeight = isOn ? "140px" : "0px"; d.style.opacity = isOn ? "1" : "0"; d.style.marginTop = isOn ? "12px" : "0px"; }
        el.style.borderTopColor = isOn ? "#FBC009" : "#262626";
      });
      if (E.count) E.count.textContent = String(s + 1).padStart(2, "0");
    };

    // ---- main rAF loop ----
    let lastY = scrollY, vel = 0, dir = 1, pS = 0, lastRate = 1;
    let fillT0: number | null = null;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const y = scrollY, vh = innerHeight;
      flushReveals();

      if (!reduced) {
        E.par.forEach((el) => {
          const parent = el.parentNode as HTMLElement;
          const r = parent.getBoundingClientRect();
          if (r.bottom < -50 || r.top > vh + 50) return;
          const p = (r.top + r.height / 2 - vh / 2) / vh;
          el.style.transform = "translateY(" + (p * -9).toFixed(2) + "%)";
        });
      }

      const d = y - lastY; lastY = y;
      vel += (d - vel) * 0.12;
      if (Math.abs(d) > 1.5) dir = d > 0 ? 1 : -1;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      if (E.bar) E.bar.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";

      if (!reduced) {
        if (E.heroInner && y < vh * 1.3) {
          E.heroInner.style.transform = "translateY(" + (y * 0.28).toFixed(1) + "px)";
          E.heroInner.style.opacity = Math.max(0, 1 - y / (vh * 0.85)).toFixed(3);
        }
        const rate = dir * (1 + Math.min(Math.abs(vel) * 0.09, 5));
        if (Math.abs(rate - lastRate) > 0.04) {
          lastRate = rate;
          E.marq.forEach((m) => m.getAnimations().forEach((a) => { a.playbackRate = rate; }));
        }
        E.spin.forEach((el) => { el.style.transform = "rotate(" + (y * 0.06).toFixed(1) + "deg)"; });
      }

      if (E.man && E.words.length) {
        const r = E.man.getBoundingClientRect();
        const p = (vh * 0.82 - r.top) / (vh * 0.35 + r.height);
        const litN = p * E.words.length;
        E.words.forEach((w, i) => {
          const o = i < litN;
          const ww = w as HTMLElement & { _on?: boolean };
          if (ww._on === o) return;
          ww._on = o;
          w.style.color = o ? "#0A0A0A" : "#C8C1B4";
          if (w.hasAttribute("data-hl")) w.style.backgroundSize = o ? "100% 100%" : "0% 100%";
        });
      }

      if (E.pin) {
        if (!E.liquid || !E.liquid.isConnected) {
          E.liquid = q("[data-liquid]");
          E.wave = q("[data-wave]");
          E.strawDark = q("[data-strawdark]");
          E.steps = $$("[data-step]");
          E.count = q("[data-count]");
          step = -1;
        }
        const r = E.pin.getBoundingClientRect();
        const now = performance.now();
        if (r.top < vh * 0.55 && r.bottom > vh * 0.3) { if (fillT0 == null) fillT0 = now; }
        else if (r.top > vh || r.bottom < 0) fillT0 = null;
        const FILL = 6000, HOLD = 3200;
        const el = fillT0 == null ? 0 : now - fillT0;
        const p = reduced ? 1 : Math.min(1, el / FILL);
        pS += (p - pS) * 0.08;
        const lvl = 6 + pS * 69;
        if (E.liquid) E.liquid.style.height = lvl.toFixed(2) + "%";
        if (E.wave) E.wave.style.bottom = lvl.toFixed(2) + "%";
        if (E.strawDark) E.strawDark.style.clipPath = "inset(" + (100 - lvl).toFixed(2) + "% 0 0 0)";
        const n = E.steps.length || 1;
        const s = el < FILL ? Math.min(n - 1, Math.floor(p * n * 0.999)) : Math.floor((el - FILL) / HOLD) % n;
        if (s !== step && E.steps.length) { step = s; setStep(s); }
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      neonAnims.forEach((a) => a.cancel());
    };
  }, []);

  return null;
}
