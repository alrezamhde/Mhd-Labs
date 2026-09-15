const pagePath = location.pathname.replace(/\/$/, "");
const isAbout = pagePath === "/about";
const projectType = "Motion Graphics · After Effects";

const projects = [
  { title: "ChatGPT", file: "chatgpt.mp4", poster: "chatgpt.webp" },
  { title: "Delusion", file: "delusion.mp4", poster: "delusion.webp" },
  { title: "Depth", file: "depth.mp4", poster: "depth.webp" },
  { title: "Lovart", file: "lovart.mp4", poster: "lovart.webp" },
  { title: "Mhd Labs Intro", file: "mhd-labs-intro.mp4", poster: "mhd-labs-intro.webp" },
  { title: "Smooth Pack", file: "smooth-pack.mp4", poster: "smooth-pack.webp" },
];

const workIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
const aboutIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>';
const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg>';
const closeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

const projectCards = projects.map((project, index) => `
  <article class="project">
    <button class="project-open" type="button" data-project="${index}" aria-label="Play ${project.title}">
      <span class="art">
        <video class="project-video" muted loop playsinline preload="metadata" poster="/media/${project.poster}" aria-hidden="true">
          <source src="/media/${project.file}" type="video/mp4">
        </video>
        <span class="project-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="play-indicator">${playIcon}</span>
      </span>
    </button>
    <div class="project-info">
      <h2>${project.title}</h2>
      <span>${projectType}</span>
    </div>
  </article>
`).join("");

const workPage = `
  <main class="work">
    <div class="section-label">
      <h1>Selected work</h1>
      <span>01 — 06</span>
    </div>
    <div class="grid">${projectCards}</div>
  </main>
  <dialog class="video-dialog" id="projectPlayer" aria-labelledby="projectTitle">
    <button class="dialog-close" id="closePlayer" type="button" aria-label="Close video">${closeIcon}</button>
    <div class="dialog-video-wrap">
      <video class="dialog-video" id="fullVideo" controls playsinline></video>
    </div>
    <div class="dialog-meta">
      <h2 id="projectTitle"></h2>
      <p>${projectType}</p>
    </div>
  </dialog>
`;

const aboutPage = `
  <main class="about">
    <p class="eyebrow">A little about me</p>
    <h1>Good design.<br>Even better <span>in motion.</span></h1>
    <div class="about-lower">
      <div>
        <p class="bio">I'm <strong>Alireza</strong>, a motion and product designer. I turn ideas into clear, engaging visual stories — from SaaS animations to digital experiences.<br><br>I work with teams to make products easier to understand and more enjoyable to discover.</p>
        <p class="tools">After Effects &nbsp; / &nbsp; Premiere Pro &nbsp; / &nbsp; Blender</p>
      </div>
      <div class="call-area">
        <p>Have something in mind?<br>Let's talk about your next project.</p>
        <a class="call-button" id="book" href="https://calendar.app.google/EygPvXTVFHdfKUzS7" target="_blank" rel="noopener noreferrer" aria-haspopup="dialog" aria-controls="booking">Book a call <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></a>
      </div>
    </div>
  </main>
  <dialog class="booking-dialog" id="booking" aria-labelledby="bookingTitle">
    <div class="booking-header">
      <div>
        <span class="booking-kicker">Google Calendar</span>
        <h2 id="bookingTitle">Choose a time</h2>
      </div>
      <button class="booking-close" id="closeBooking" type="button" aria-label="Close booking calendar">${closeIcon}</button>
    </div>
    <iframe class="booking-frame" src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ1xn8LHA2X_q5Zpt4-KL248pQkfJvIu3bUvIwJbyvd4WjONnAWBqXUXeezy1Cua8nSgl60O6Btp?gv=true" title="Book a call with Alireza" loading="lazy" frameborder="0"></iframe>
  </dialog>
`;

document.querySelector("#app").innerHTML = `
  <header>
    <a class="brand" href="/" aria-label="MHD home">MHD<span>®</span></a>
    <div class="header-note"><span>Independent designer</span>Motion &amp; Design</div>
  </header>
  ${isAbout ? aboutPage : workPage}
  <nav class="bottom-nav" aria-label="Main navigation">
    <a href="/" class="${!isAbout ? "active" : ""}" ${!isAbout ? 'aria-current="page"' : ""}>${workIcon}Work</a>
    <a href="/about/" class="${isAbout ? "active" : ""}" ${isAbout ? 'aria-current="page"' : ""}>${aboutIcon}About</a>
  </nav>
`;

const setupHalftoneCursor = () => {
  const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!hasFinePointer || prefersReducedMotion) return;

  const canvas = document.createElement("canvas");
  canvas.className = "cursor-halftone";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    canvas.remove();
    return;
  }

  let width = window.innerWidth;
  let height = window.innerHeight;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let frame = 0;
  let strength = 0;
  let targetStrength = 0;
  let pointerActive = false;
  let textRects = [];
  const surfaceSelector = "a, button, dialog, .bottom-nav";
  const textSelector = [
    ".header-note",
    ".section-label h1",
    ".section-label span",
    ".project-info h2",
    ".project-info span",
    ".eyebrow",
    ".about h1",
    ".bio",
    ".tools",
    ".call-area p",
  ].join(", ");
  const current = { x: width / 2, y: height / 2 };
  const target = { x: current.x, y: current.y };

  const measureTextRects = () => {
    textRects = [];
    document.querySelectorAll(textSelector).forEach((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();

      while (textNode) {
        if (textNode.textContent.trim()) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          [...range.getClientRects()].forEach((rect) => {
            if (rect.width > 0 && rect.height > 0) {
              textRects.push({
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
              });
            }
          });
        }
        textNode = walker.nextNode();
      }
    });
  };

  const isOverText = (x, y) => textRects.some((rect) => (
    x >= rect.left
    && x <= rect.right
    && y >= rect.top
    && y <= rect.bottom
  ));

  const updateTargetStrength = (x, y, element) => {
    const targetElement = element instanceof Element ? element : null;
    const isOverInterface = targetElement?.closest(surfaceSelector)
      || isOverText(x, y)
      || document.querySelector("dialog[open]");
    targetStrength = isOverInterface ? 0 : 1;
  };

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const scheduleDraw = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  const draw = () => {
    frame = 0;
    current.x += (target.x - current.x) * 0.22;
    current.y += (target.y - current.y) * 0.22;
    const strengthEase = 0.095;
    strength += (targetStrength - strength) * strengthEase;
    context.clearRect(0, 0, width, height);

    if (strength > 0.004) {
      const radius = Math.min(220, Math.max(170, width * 0.15));
      const spacing = 49;
      const startX = Math.floor((current.x - radius) / spacing) * spacing;
      const endX = Math.ceil((current.x + radius) / spacing) * spacing;
      const startY = Math.floor((current.y - radius) / spacing) * spacing;
      const endY = Math.ceil((current.y + radius) / spacing) * spacing;

      const glow = context.createRadialGradient(current.x, current.y, 0, current.x, current.y, radius);
      glow.addColorStop(0, `rgba(75, 210, 0, ${0.055 * strength})`);
      glow.addColorStop(0.58, `rgba(75, 210, 0, ${0.018 * strength})`);
      glow.addColorStop(1, "rgba(75, 210, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(current.x - radius, current.y - radius, radius * 2, radius * 2);

      for (let y = startY; y <= endY; y += spacing) {
        for (let x = startX; x <= endX; x += spacing) {
          const distance = Math.hypot(x - current.x, y - current.y);
          if (distance > radius) continue;

          const falloff = Math.max(0, 1 - distance / radius);
          const intensity = Math.pow(falloff, 1.42) * strength;
          if (intensity < 0.012) continue;

          const dotRadius = 0.6 + intensity * 3.2;
          const alpha = Math.min(0.9, intensity * 0.86);
          context.shadowBlur = intensity > 0.42 ? 8 * intensity : 0;
          context.shadowColor = "rgba(75, 210, 0, 0.78)";
          context.fillStyle = `rgba(75, 210, 0, ${alpha})`;
          context.beginPath();
          context.arc(x, y, dotRadius, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.shadowBlur = 0;
    }

    const stillMoving = Math.abs(target.x - current.x) > 0.15
      || Math.abs(target.y - current.y) > 0.15
      || Math.abs(targetStrength - strength) > 0.006;
    if (stillMoving) scheduleDraw();
  };

  window.addEventListener("pointermove", (event) => {
    pointerActive = true;
    if (strength < 0.01) {
      current.x = event.clientX;
      current.y = event.clientY;
    }
    target.x = event.clientX;
    target.y = event.clientY;
    updateTargetStrength(event.clientX, event.clientY, event.target);
    scheduleDraw();
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", () => {
    pointerActive = false;
    targetStrength = 0;
    scheduleDraw();
  });

  window.addEventListener("blur", () => {
    pointerActive = false;
    targetStrength = 0;
    scheduleDraw();
  });

  window.addEventListener("resize", () => {
    resize();
    measureTextRects();
    if (pointerActive) {
      updateTargetStrength(target.x, target.y, document.elementFromPoint(target.x, target.y));
    }
    scheduleDraw();
  }, { passive: true });

  window.addEventListener("scroll", () => {
    measureTextRects();
    if (pointerActive) {
      updateTargetStrength(target.x, target.y, document.elementFromPoint(target.x, target.y));
    }
    scheduleDraw();
  }, { passive: true });

  resize();
  measureTextRects();
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      measureTextRects();
      if (pointerActive) {
        updateTargetStrength(target.x, target.y, document.elementFromPoint(target.x, target.y));
        scheduleDraw();
      }
    });
  }
};

setupHalftoneCursor();

if (isAbout) {
  document.title = "About — MHD";
  const booking = document.querySelector("#booking");
  const bookingLink = document.querySelector("#book");

  bookingLink.addEventListener("click", (event) => {
    if (typeof booking.showModal !== "function") return;
    event.preventDefault();
    if (!booking.open) {
      document.body.classList.add("modal-open");
      booking.showModal();
    }
  });

  document.querySelector("#closeBooking").addEventListener("click", () => booking.close());
  booking.addEventListener("close", () => document.body.classList.remove("modal-open"));
  booking.addEventListener("click", (event) => {
    if (event.target !== booking) return;
    const rect = booking.getBoundingClientRect();
    const outside = event.clientX < rect.left
      || event.clientX > rect.right
      || event.clientY < rect.top
      || event.clientY > rect.bottom;
    if (outside) booking.close();
  });
} else {
  const modal = document.querySelector("#projectPlayer");
  const fullVideo = document.querySelector("#fullVideo");
  const modalTitle = document.querySelector("#projectTitle");
  const previewVideos = [...document.querySelectorAll(".project-video")];

  const playVisiblePreviews = () => {
    if (modal.open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    previewVideos.forEach((video) => {
      const rect = video.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible) video.play().catch(() => {});
    });
  };

  const resetPlayer = () => {
    document.body.classList.remove("modal-open");
    fullVideo.pause();
    fullVideo.removeAttribute("src");
    fullVideo.removeAttribute("poster");
    fullVideo.load();
    playVisiblePreviews();
  };

  document.querySelectorAll("[data-project]").forEach((button) => {
    button.addEventListener("click", () => {
      const project = projects[Number(button.dataset.project)];
      if (!project) return;
      previewVideos.forEach((video) => video.pause());
      modalTitle.textContent = project.title;
      fullVideo.poster = `/media/${project.poster}`;
      fullVideo.src = `/media/${project.file}`;
      document.body.classList.add("modal-open");
      modal.showModal();
      fullVideo.play().catch(() => {});
    });
  });

  document.querySelector("#closePlayer").addEventListener("click", () => modal.close());
  modal.addEventListener("close", resetPlayer);
  modal.addEventListener("click", (event) => {
    if (event.target !== modal) return;
    const rect = modal.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) modal.close();
  });

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (modal.open) return entry.target.pause();
        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) entry.target.play().catch(() => {});
        else entry.target.pause();
      });
    }, { threshold: [0, 0.45, 0.8] });
    previewVideos.forEach((video) => observer.observe(video));
  }
}
