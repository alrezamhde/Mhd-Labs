// MHD — scroll-driven motion portfolio
// Libraries are vendored in ./vendor so the site runs on GitHub Pages with no build step.
import * as THREE from "./vendor/three.module.min.js";
import { initBooking } from "./booking.js?v=book-20261012";

const root = document.documentElement;
const reduced = root.classList.contains("rm");
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const hasGsap = !!(gsap && ScrollTrigger);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const sections = [$(".hero"), $(".manifesto"), ...$$(".project"), $(".contact")];
const projects = $$(".project");
const narrow = () => innerWidth <= 900;

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

/* =========================================================
   1. WebGL dot-field — one shape per chapter, morphing on scroll
   ========================================================= */
const gl = (() => {
  const canvas = $("#gl");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  } catch (e) { canvas.remove(); return null; }
  const isSmall = innerWidth < 700;
  const N = isSmall ? 4200 : 7600;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(0, 0, 8);
  const group = new THREE.Group();
  scene.add(group);

  const rand = new Float32Array(N);
  for (let i = 0; i < N; i++) rand[i] = Math.random();
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  // Each builder returns N xyz points.
  const build = (fn) => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = fn(i, i / N); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; } return a; };
  const rotX = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
  const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  const GA = Math.PI * (3 - Math.sqrt(5));
  const s = isSmall ? 0.62 : 1;

  const shapes = [
    // 0 hero — fibonacci sphere with a soft inner core
    build((i, t) => {
      const y = 1 - 2 * t, r = Math.sqrt(1 - y * y), th = GA * i;
      const R = (i % 7 === 0 ? 1.2 + Math.random() * 0.7 : 2.05) * s;
      return [Math.cos(th) * r * R, y * R + (isSmall ? 0.35 : 0), Math.sin(th) * r * R];
    }),
    // 1 manifesto — loose nebula filling the screen
    build(() => {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2.6 + Math.pow(Math.random(), 0.7) * 4.5;
      const q = Math.sqrt(1 - u * u);
      return [Math.cos(th) * q * r * 1.5, u * r * 0.8, Math.sin(th) * q * r - 1.5];
    }),
    // 2 ring orbiting the frame
    build((i, t) => {
      const a = t * Math.PI * 2 * 1, R = 4.3 * s, tube = 0.28 * gauss();
      let p = [Math.cos(a) * (R + tube), gauss() * 0.12, Math.sin(a) * (R + tube)];
      return rotX(p, 1.18);
    }),
    // 3 double helix running across the screen
    build((i, t) => {
      const strand = i % 3, x = (t - 0.5) * 15, a = x * 0.9;
      if (strand === 2) { const k = Math.random(); return [Math.round(x * 2) / 2, Math.cos(a) * 1.25 * (2 * k - 1), Math.sin(a) * 1.25 * (2 * k - 1)]; }
      const off = strand ? Math.PI : 0;
      return [x, Math.cos(a + off) * 1.25 + gauss() * 0.06, Math.sin(a + off) * 1.25 + gauss() * 0.06];
    }),
    // 4 wave floor in perspective
    build(() => {
      const x = (Math.random() - 0.5) * 16, z = Math.random() * -9 + 2.5;
      return [x, -2.1 + Math.sin(x * 0.7) * Math.cos(z * 0.8) * 0.45, z];
    }),
    // 5 cube lattice
    build(() => {
      const h = 1.75 * s, face = Math.floor(Math.random() * 6), u = (Math.random() * 2 - 1) * h, v = (Math.random() * 2 - 1) * h;
      const sn = face % 2 ? h : -h;
      let p = face < 2 ? [sn, u, v] : face < 4 ? [u, sn, v] : [u, v, sn];
      p = p.map((c) => Math.round(c * 3) / 3 + gauss() * 0.01);
      return rotY(rotX(p, 0.62), 0.78);
    }),
    // 6 spiral galaxy
    build((i) => {
      const arm = i % 3, r = Math.pow(Math.random(), 0.55) * 5.2, a = r * 1.05 + (arm * Math.PI * 2) / 3 + gauss() * 0.35;
      return rotX([Math.cos(a) * r, gauss() * 0.18 * (1.4 - r / 5.2), Math.sin(a) * r], 1.05);
    }),
    // 7 torus knot
    build((i, t) => {
      const a = t * Math.PI * 2, p = 2, q = 3, r = Math.cos(q * a) + 2.2;
      const k = 1.05 * s;
      return [r * Math.cos(p * a) * k + gauss() * 0.12, r * Math.sin(p * a) * k + gauss() * 0.12, -Math.sin(q * a) * k * 1.2 + gauss() * 0.12];
    }),
    // 8 contact — a portal ring around the call-to-action
    build((i, t) => {
      const wide = innerWidth > 900;
      const cx = wide ? 2.75 : 0, cy = wide ? -0.15 : -1.1;
      if (i % 4 === 0) { const r = 2 + Math.random() * 4; const a = Math.random() * 6.283; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, (Math.random() - 0.5) * 3]; }
      const a = t * Math.PI * 2 * 4, R = (wide ? 1.75 : 1.45) + gauss() * 0.06;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, gauss() * 0.1];
    }),
    // 9 (alias for the last project if more chapters are added)
  ];
  // map chapter → shape: hero, manifesto, 6 projects, contact
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  while (order.length < sections.length) order.splice(order.length - 1, 0, 2 + ((order.length - 2) % 6));

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(shapes[0]);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: isSmall ? 34 : 42 }, uPixel: { value: renderer.getPixelRatio() },
      uColor: { value: new THREE.Color("#4bd200") }, uOpacity: { value: 1 }, uVel: { value: 0 },
    },
    vertexShader: `
      attribute float aRand;
      uniform float uTime, uSize, uPixel, uVel;
      varying float vAlpha; varying float vRand;
      void main(){
        vec3 p = position;
        float t = uTime * .7 + aRand * 6.2831;
        float amp = .035 + uVel * .25;
        p += vec3(sin(t + p.y * 1.3), cos(t * .9 + p.x * 1.1), sin(t * .8 + p.z)) * amp;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float depth = -mv.z;
        gl_PointSize = uSize * uPixel * (.45 + aRand * .9) / depth;
        vAlpha = smoothstep(17., 4.5, depth) * (.35 + .65 * smoothstep(.0, .5, aRand));
        vRand = aRand;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAlpha; varying float vRand;
      void main(){
        float d = length(gl_PointCoord - .5);
        if (d > .5) discard;
        float a = smoothstep(.5, .08, d);
        vec3 col = mix(uColor, vec3(.86, 1., .78), step(.965, vRand));
        gl_FragColor = vec4(col, a * vAlpha * uOpacity * .8);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  let morph = 0, shownMorph = -1, spin = 0, mx = 0, my = 0, tx = 0, ty = 0, vel = 0;
  addEventListener("pointermove", (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  function applyMorph(m) {
    const max = order.length - 1;
    m = clamp(m, 0, max);
    const a = Math.min(Math.floor(m), max - 1), t = m - a;
    const A = shapes[order[a]], B = shapes[order[a + 1]];
    for (let i = 0; i < N; i++) {
      const k = ease(clamp(t * 1.7 - rand[i] * 0.7));
      const j = i * 3;
      pos[j] = A[j] + (B[j] - A[j]) * k;
      pos[j + 1] = A[j + 1] + (B[j + 1] - A[j + 1]) * k;
      pos[j + 2] = A[j + 2] + (B[j + 2] - A[j + 2]) * k;
    }
    geo.attributes.position.needsUpdate = true;
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth / innerHeight < 0.8 ? 55 : 40;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize, { passive: true });
  resize();

  let last = performance.now();
  function frame(now, opacity) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    mat.uniforms.uTime.value = now / 1000;
    if (Math.abs(morph - shownMorph) > 0.0005) { applyMorph(morph); shownMorph = morph; }
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    spin = (spin + dt * (0.07 + vel * 0.6)) % (Math.PI * 2);
    // the final portal stays facing the viewer so it frames the call-to-action
    const face = clamp(morph - (order.length - 2));
    const spinA = spin > Math.PI ? spin - Math.PI * 2 : spin;
    group.rotation.y = spinA * (1 - face) + mx * (0.5 - face * 0.3);
    group.rotation.x = my * (0.3 - face * 0.15);
    mat.uniforms.uVel.value += (vel - mat.uniforms.uVel.value) * 0.1;
    mat.uniforms.uOpacity.value = opacity;
    renderer.render(scene, camera);
  }
  return {
    frame, applyMorph,
    setMorph(v) { morph = v; },
    setVelocity(v) { vel = clamp(Math.abs(v) / 60, 0, 1); },
  };
})();

/* =========================================================
   2. Video loops — autoplay, muted, no controls, never stop
   ========================================================= */
const videos = $$(".p-video");
const visibleVideos = new Set();
function loadVideo(v) {
  if (v.dataset.loaded) return;
  v.dataset.loaded = "1";
  v.muted = true; v.defaultMuted = true; v.loop = true; v.controls = false;
  v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
  v.preload = "auto";
  v.src = v.dataset.src;
  v.load();
}
function play(v) {
  loadVideo(v);
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
}
videos.forEach((v) => {
  v.controls = false;
  // Some browsers drop `loop` after a stall; restart manually so the reel never stops.
  v.addEventListener("ended", () => { v.currentTime = 0; play(v); });
  v.addEventListener("pause", () => { if (visibleVideos.has(v) && !document.hidden) setTimeout(() => visibleVideos.has(v) && v.paused && play(v), 250); });
  v.addEventListener("contextmenu", (e) => e.preventDefault());
});
if ("IntersectionObserver" in window) {
  const near = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && loadVideo(e.target)), { rootMargin: "120% 0px" });
  const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { visibleVideos.add(e.target); play(e.target); }
    else { visibleVideos.delete(e.target); e.target.pause(); }
  }), { threshold: 0.01 });
  videos.forEach((v) => { near.observe(v); seen.observe(v); });
} else videos.forEach(play);
// Low-power modes can block autoplay until the first gesture — retry then.
const kick = () => visibleVideos.forEach(play);
["pointerdown", "touchstart", "keydown", "wheel"].forEach((t) => addEventListener(t, kick, { passive: true, once: true }));
document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });

const pad = (n) => String(n).padStart(2, "0");
function updateTimecodes() {
  visibleVideos.forEach((v) => {
    const fig = v.closest(".p-float");
    const t = v.currentTime || 0, d = v.duration || 1;
    const tc = fig.querySelector(".tc"), head = fig.querySelector(".head");
    tc.textContent = `00:00:${pad(Math.floor(t))}:${pad(Math.floor((t % 1) * 30))}`;
    head.style.left = `calc(${(t / d) * 100}% - 1px)`;
  });
}

/* =========================================================
   3. Scroll choreography
   ========================================================= */
const rail = $(".rail"), railCount = $(".rail-count b"), railFill = $(".rail-fill"), railName = $(".rail-name");
const railTotal = $(".rail-count i");
if (railTotal) railTotal.textContent = "/ " + pad(projects.length);
const names = projects.map((p) => $(".p-title", p).textContent.trim());
let lenis = null;

function chapterState() {
  const vh = innerHeight;
  let m = 0, active = -1, local = 0;
  for (let i = 1; i < sections.length; i++) {
    const r = sections[i].getBoundingClientRect();
    const span = i === sections.length - 1 ? vh * 0.55 : vh;
    m += ease(clamp((vh - r.top) / span));
  }
  projects.forEach((p, i) => {
    const r = p.getBoundingClientRect();
    if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) { active = i; local = clamp(-r.top / Math.max(1, r.height - vh)); }
  });
  return { m, active, local };
}

let lastActive = -2, railShown = false, glDrawn = 0;
function tick(now) {
  const st = chapterState();
  if (gl && !(reduced && glDrawn > 2)) {
    glDrawn++;
    gl.setMorph(st.m);
    // dim the field while a project video is on screen so the work stays the focus
    const inWork = st.m > 1.6 && st.m < sections.length - 1.4;
    gl.frame(now, inWork ? 0.5 : 1);
  }
  if (rail && hasGsap && !reduced) {
    const show = st.active >= 0;
    if (show !== railShown) { railShown = show; gsap.to(rail, { autoAlpha: show ? 1 : 0, x: show ? 0 : 20, duration: 0.5, ease: "power3.out" }); }
    if (st.active >= 0) {
      if (st.active !== lastActive) {
        lastActive = st.active;
        railCount.textContent = pad(st.active + 1);
        railName.textContent = names[st.active];
      }
      railFill.style.transform = `scaleY(${(st.active + st.local) / projects.length})`;
    }
  }
  updateTimecodes();
}

function splitChars(el) { return $$(".ch", el); }

function heroIntro() {
  if (!hasGsap || reduced) return;
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.from(".hl > span", { yPercent: 115, rotate: 6, duration: 1.6, stagger: 0.09 })
    .from(".hero-reg > span", { scale: 0, opacity: 0, duration: 1, ease: "back.out(3)" }, 0.6)
    .from(".hero-eyebrow > *", { y: 20, opacity: 0, duration: 1.2 }, 0.35)
    .from(".hero-foot-in > *", { y: 30, opacity: 0, duration: 1.2, stagger: 0.1 }, 0.5)
    .from(".site-header > *", { y: -20, opacity: 0, duration: 1, stagger: 0.08 }, 0.4);
}

function setupScroll() {
  if (!hasGsap || reduced) return;
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add("motion");
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on("scroll", (e) => { ScrollTrigger.update(); gl && gl.setVelocity(e.velocity || 0); });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* --- Hero: the letters break apart as you leave --- */
  const hls = $$(".hl");
  const heroTl = gsap.timeline({ scrollTrigger: { trigger: ".hero-stage", start: "top top", end: "+=90%", pin: true, scrub: 1 } });
  heroTl
    .to(hls[0], { xPercent: -90, yPercent: -30, rotate: -14, opacity: 0, ease: "power2.in" }, 0)
    .to(hls[1], { scale: 2.8, opacity: 0, ease: "power2.in" }, 0)
    .to(hls[2], { xPercent: 90, yPercent: -30, rotate: 14, opacity: 0, ease: "power2.in" }, 0)
    .to(".hero-reg", { opacity: 0, y: -60 }, 0)
    .to(".hero-eyebrow", { y: -40, opacity: 0 }, 0)
    .to(".hero-foot", { y: -60, opacity: 0 }, 0);

  /* --- Manifesto: words light up one by one --- */
  const mTl = gsap.timeline({ scrollTrigger: { trigger: ".m-stage", start: "top top", end: "+=130%", pin: true, scrub: 1 } });
  mTl.fromTo(".mw", { opacity: 0.12, y: 14 }, { opacity: 1, y: 0, stagger: 0.12, ease: "power2.out", duration: 0.6 }, 0)
    .from(".m-label", { y: 20, opacity: 0, duration: 0.6 }, 0)
    .from(".m-sub", { y: 20, opacity: 0, duration: 0.6 }, 1)
    .to({}, { duration: 0.6 });

  /* --- Projects --- */
  const mm = gsap.matchMedia();
  mm.add({ wide: "(min-width: 901px)", small: "(max-width: 900px)" }, (ctx) => {
    const { wide } = ctx.conditions;
    projects.forEach((section, i) => {
      const stage = $(".p-stage", section);
      const media = $(".p-media", section);
      const float = $(".p-float", section);
      const frame = $(".p-frame", section);
      const cap = $(".p-timeline", section);
      const num = $(".p-num", section);
      const numWrap = $(".p-num-wrap", section);
      const info = $(".p-info", section);
      const chars = splitChars($(".p-title", info));
      const rest = [$(".p-kicker", info), $(".p-desc", info), $(".p-more", info), $(".p-meta", info)].filter(Boolean);
      const layout = section.dataset.layout;
      const dir = layout === "left" ? 1 : -1; // where the video moves on the x-axis

      gsap.set(media, { xPercent: -50, yPercent: -50, transformPerspective: 1400 });
      gsap.set([float, frame], { transformPerspective: 1400 });
      gsap.set(info, { autoAlpha: 0 });

      // Arrive: the frame rises in, unfolding from a tilted, cropped card.
      gsap.timeline({ scrollTrigger: { trigger: section, start: "top bottom", end: "top top", scrub: 1 } })
        .fromTo(frame, { clipPath: "inset(16% 20% 16% 20% round 48px)", scale: 0.78, rotationX: 32, rotationZ: dir * 5 },
          { clipPath: "inset(0% 0% 0% 0% round 14px)", scale: 1, rotationX: 0, rotationZ: 0, ease: "power2.out" }, 0)
        .fromTo(cap, { opacity: 0 }, { opacity: 1, ease: "none" }, 0.6)
        .fromTo(num, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, ease: "power2.out" }, 0);

      // Pinned: video plays → it steps aside → the story appears → it all clears.
      const tl = gsap.timeline({ defaults: { ease: "power3.inOut" }, scrollTrigger: { trigger: stage, start: "top top", end: wide ? "+=260%" : "+=200%", pin: true, scrub: 1, anticipatePin: 1 } });
      tl.to({}, { duration: 0.35 });
      if (wide && layout !== "over") {
        tl.to(media, { x: () => dir * innerWidth * (dir > 0 ? 0.165 : 0.19), scale: 0.6, rotationY: -dir * 12, duration: 1 }, 0.35);
      } else if (wide) {
        tl.to(media, { y: () => -innerHeight * 0.09, scale: 0.86, rotationX: 6, duration: 1 }, 0.35);
      } else {
        tl.to(media, { y: () => -innerHeight * 0.05, scale: 0.97, duration: 1 }, 0.35);
      }
      tl.to(num, { x: () => dir * -innerWidth * 0.1, duration: 1 }, 0.35)
        .set(info, { autoAlpha: 1 }, 0.55)
        .fromTo(chars, { yPercent: 115, rotate: 10 }, { yPercent: 0, rotate: 0, stagger: 0.035, duration: 0.6, ease: "power3.out" }, 0.6)
        .fromTo(rest, { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.6, ease: "power3.out" }, 0.75);
      if (layout === "over" && wide) tl.fromTo(info, { clipPath: "inset(100% 0% 0% 0% round 18px)" }, { clipPath: "inset(0% 0% 0% 0% round 18px)", duration: 0.7, ease: "power3.out" }, 0.55);
      tl.to({}, { duration: 0.7 })
        .to(chars, { yPercent: -115, stagger: 0.02, duration: 0.5, ease: "power3.in" }, ">")
        .to(rest, { y: -30, opacity: 0, stagger: 0.06, duration: 0.45, ease: "power3.in" }, "<")
        .to(info, { clipPath: "inset(0% 0% 100% 0% round 18px)", duration: 0.5, ease: "power3.in" }, "<0.25")
        .to(media, { x: 0, y: 0, scale: 0.92, rotationY: 0, rotationX: 0, duration: 0.8 }, "<0.2")
        .to(num, { x: 0, duration: 0.8 }, "<");

      // Leave: carried up by the scroll, tipping back and shrinking away.
      gsap.timeline({ scrollTrigger: { trigger: section, start: "bottom bottom", end: "bottom top", scrub: 1 } })
        .to(float, { scale: 0.72, rotationX: -22, opacity: 0.15, ease: "power2.in" }, 0)
        .to(numWrap, { yPercent: -60, opacity: 0, ease: "none" }, 0);
    });
    return () => {};
  });

  /* --- Contact --- */
  gsap.to(".marquee-row", { xPercent: -38, ease: "none", scrollTrigger: { trigger: ".contact", start: "top bottom", end: "bottom top", scrub: 1 } });
  const cTl = gsap.timeline({ scrollTrigger: { trigger: ".c-stage", start: "top 70%", toggleActions: "play none none reverse" } });
  cTl.from(".c-eyebrow", { y: 20, opacity: 0, duration: 0.8, ease: "power3.out" })
    .from(".c-title .ch", { yPercent: 115, rotate: 8, stagger: 0.025, duration: 1.1, ease: "expo.out" }, 0.1)
    .from([".c-text", ".c-tools"], { y: 30, opacity: 0, stagger: 0.1, duration: 1, ease: "power3.out" }, 0.5)
    .from(".cta-orb", { scale: 0, rotate: -120, duration: 1.4, ease: "expo.out" }, 0.3)
    .from(".c-note", { opacity: 0, duration: 0.8 }, 1);

  // Magnetic call-to-action
  const orb = $(".cta-orb"), core = $(".orb-core");
  if (orb && matchMedia("(hover: hover)").matches) {
    const xTo = gsap.quickTo(core, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(core, "y", { duration: 0.6, ease: "power3.out" });
    orb.addEventListener("pointermove", (e) => {
      const r = orb.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35); yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    orb.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  }
}

/* =========================================================
   4. Links, booking dialog, loader
   ========================================================= */
function scrollToTarget(hash) {
  const target = hash === "#top" ? 0 : $(hash);
  if (target === null) return;
  if (lenis) lenis.scrollTo(target, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (target === 0) scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}
$$("[data-scroll]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); scrollToTarget(a.getAttribute("href")); }));

initBooking({ gsap: hasGsap ? gsap : null, getLenis: () => lenis, reduced });

function runLoader(done) {
  const loader = $(".loader");
  if (!loader || !hasGsap || reduced) { loader && loader.remove(); done(); return; }
  const count = $(".loader-count b", loader);
  const state = { v: 0 };
  const ready = Promise.race([
    Promise.all([document.fonts ? document.fonts.ready : null, new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true })))]),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
  const tl = gsap.timeline();
  tl.to(state, { v: 82, duration: 1.1, ease: "power2.inOut", onUpdate: () => { count.textContent = String(Math.round(state.v)).padStart(3, "0"); } })
    .to(".loader-bar", { scaleX: 0.82, duration: 1.1, ease: "power2.inOut" }, 0);
  ready.then(() => {
    gsap.timeline({ delay: Math.max(0, 1.1 - tl.time()) })
      .to(state, { v: 100, duration: 0.45, ease: "power2.out", onUpdate: () => { count.textContent = String(Math.round(state.v)).padStart(3, "0"); } })
      .to(".loader-bar", { scaleX: 1, duration: 0.45 }, 0)
      .to(".loader-inner", { yPercent: -40, opacity: 0, duration: 0.6, ease: "power3.in" }, 0.5)
      .to(".loader-bar", { scaleY: 0, duration: 0.3 }, 0.6)
      .to(".loader-panel", { yPercent: -100, duration: 1.1, ease: "expo.inOut" }, 0.75)
      .add(() => done(), 1.15)
      .add(() => loader.remove());
  });
}

/* =========================================================
   5. Halftone cursor (kept from the previous site)
   ========================================================= */
function halftoneCursor() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || reduced) return;
  const canvas = document.createElement("canvas");
  canvas.className = "cursor-halftone";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let w, h, strength = 0, target = 0, active = false;
  const cur = { x: innerWidth / 2, y: innerHeight / 2 }, aim = { ...cur };
  const resize = () => { w = innerWidth; h = innerHeight; const r = Math.min(devicePixelRatio || 1, 2); canvas.width = w * r; canvas.height = h * r; canvas.style.width = w + "px"; canvas.style.height = h + "px"; ctx.setTransform(r, 0, 0, r, 0, 0); };
  resize(); addEventListener("resize", resize, { passive: true });
  addEventListener("pointermove", (e) => { active = true; if (strength < 0.01) { cur.x = e.clientX; cur.y = e.clientY; } aim.x = e.clientX; aim.y = e.clientY; }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => { active = false; });
  return () => {
    if (active) {
      const el = document.elementFromPoint(aim.x, aim.y);
      target = el && el.closest("a, button, .p-frame, .p-info, h1, h2, p, .book, li, .marquee") ? 0 : 1;
    } else target = 0;
    cur.x += (aim.x - cur.x) * 0.22; cur.y += (aim.y - cur.y) * 0.22;
    strength += (target - strength) * 0.1;
    ctx.clearRect(0, 0, w, h);
    if (strength < 0.004) return;
    const R = 190, S = 46;
    for (let y = Math.floor((cur.y - R) / S) * S; y <= cur.y + R; y += S) {
      for (let x = Math.floor((cur.x - R) / S) * S; x <= cur.x + R; x += S) {
        const d = Math.hypot(x - cur.x, y - cur.y);
        if (d >= R) continue;
        const k = Math.pow(1 - d / R, 1.4) * strength;
        if (k < 0.012) continue;
        ctx.fillStyle = `rgba(75,210,0,${Math.min(0.9, k * 0.86)})`;
        ctx.beginPath(); ctx.arc(x, y, 0.6 + k * 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
}

/* =========================================================
   6. Boot
   ========================================================= */
scrollTo(0, 0);
setupScroll();
const cursorFrame = halftoneCursor();
// Render loop: GSAP's ticker when available (keeps WebGL in sync with Lenis), rAF otherwise.
if (hasGsap) gsap.ticker.add(() => { const now = performance.now(); tick(now); cursorFrame && cursorFrame(); });
else { const loop = (now) => { tick(now); cursorFrame && cursorFrame(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
if (reduced && gl) { gl.applyMorph(0); }

runLoader(() => {
  heroIntro();
  lenis && lenis.start();
  ScrollTrigger && ScrollTrigger.refresh();
  if (location.hash && $(location.hash)) setTimeout(() => scrollToTarget(location.hash), 300);
});
