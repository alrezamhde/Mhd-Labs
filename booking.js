// MHD — in-site booking. Talks to a Google Apps Script web app (see google-apps-script/Code.gs)
// that reads Alireza's free times from Google Calendar and creates the event + Meet invite.

// ▼▼ Paste your Apps Script web app URL here (ends with /exec). Empty = preview mode. ▼▼
export const BOOKING_API = "";
// ▲▲

const FALLBACK_URL = "https://calendar.app.google/EygPvXTVFHdfKUzS7";
// Used only in preview mode, mirroring the defaults in Code.gs.
const DEMO_RULES = { tz: "America/Toronto", duration: 30, days: [1, 2, 3, 4, 5], from: 10, to: 18, step: 30, daysAhead: 30 };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: visitorTz, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: visitorTz, hour: "numeric", minute: "2-digit" });
const longDateFmt = new Intl.DateTimeFormat("en-US", { timeZone: visitorTz, weekday: "long", month: "long", day: "numeric" });
const tzShort = (() => {
  try { return new Intl.DateTimeFormat("en-US", { timeZone: visitorTz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName").value; }
  catch (e) { return ""; }
})();
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/* ---------- preview-mode slot generator (same rules as Code.gs defaults) ---------- */
function zoned(y, m, d, h, min, tz) {
  const guess = Date.UTC(y, m, d, h, min);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour % 24, +g.minute);
  return new Date(guess - (asUtc - guess));
}
function demoSlots() {
  const r = DEMO_RULES, out = [], now = Date.now() + 12 * 3600e3;
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: r.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  for (let i = 0; i <= r.daysAhead; i++) {
    const day = new Date(Date.UTC(t[0], t[1] - 1, t[2] + i));
    if (!r.days.includes(day.getUTCDay())) continue;
    for (let m = r.from * 60; m + r.duration <= r.to * 60; m += r.step) {
      const s = zoned(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Math.floor(m / 60), m % 60, r.tz);
      // fake a few busy blocks so the preview looks like a real calendar
      if (s.getTime() < now || ((day.getUTCDate() * 7 + m / 30) % 5 === 0)) continue;
      out.push(s.toISOString());
    }
  }
  return { ok: true, duration: r.duration, slots: out };
}

/* ---------- API ---------- */
async function fetchSlots() {
  if (!BOOKING_API) { await new Promise((r) => setTimeout(r, 600)); return demoSlots(); }
  const res = await fetch(`${BOOKING_API}?action=slots&t=${Date.now()}`, { method: "GET" });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Could not load times");
  return data;
}
async function sendBooking(payload) {
  if (!BOOKING_API) { await new Promise((r) => setTimeout(r, 1200)); return { ok: true, demo: true, start: payload.start }; }
  const res = await fetch(BOOKING_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "book", ...payload }) });
  return res.json();
}

/* ---------- UI ---------- */
export function initBooking({ gsap, getLenis, reduced }) {
  const root = $("#book");
  if (!root) return;
  const grid = $("[data-grid]", root), monthEl = $("[data-month]", root);
  const slotsEl = $("[data-slots]", root), slotsHead = $("[data-slots-head]", root);
  const state = $("[data-state]", root), stateText = $("[data-state-text]", root), stateActions = $("[data-state-actions]", root);
  const pickDate = $("[data-pick-date]", root), pickTime = $("[data-pick-time]", root);
  const form = $("[data-form]", root), formError = $("[data-form-error]", root), submitLabel = $("[data-submit-label]", root);
  const steps = $$("[data-step]", root), inds = $$("[data-step-ind]", root);
  const anim = !!gsap && !reduced;

  $("[data-tz]", root).textContent = `${visitorTz.replace(/_/g, " ")}${tzShort ? " · " + tzShort : ""}`;
  if (!BOOKING_API) $("[data-demo]", root).hidden = false;

  let byDay = new Map(), months = [], monthIdx = 0, selectedDay = null, selectedSlot = null, loaded = false, opener = null, step = 1, busy = false;

  /* steps */
  function go(n) {
    const from = steps.find((s) => +s.dataset.step === step), to = steps.find((s) => +s.dataset.step === n);
    step = n;
    inds.forEach((li) => { li.classList.toggle("is-on", +li.dataset.stepInd === n); li.classList.toggle("is-done", +li.dataset.stepInd < n); });
    if (from === to) return;
    from.classList.remove("is-active"); to.classList.add("is-active");
    if (anim) {
      gsap.fromTo(to, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" });
      gsap.from($$(".field, .chips, .form-title, .book-submit, .book-back, .done > *", to), { y: 24, opacity: 0, duration: 0.8, stagger: 0.05, ease: "expo.out", delay: 0.05 });
    }
    if (innerWidth <= 900) root.scrollTo({ top: n === 1 ? 0 : $(".book-main", root).offsetTop, behavior: anim ? "smooth" : "auto" });
    if (n === 2) setTimeout(() => $("#bkName").focus({ preventScroll: true }), 350);
    if (n === 3) drawCheck();
  }

  /* load + calendar */
  function showState(text, isError) {
    state.hidden = false; stateText.textContent = text; stateActions.hidden = !isError;
    root.classList.toggle("is-loading", !isError);
  }
  async function load() {
    showState("Loading open times…", false);
    try {
      const data = await fetchSlots();
      if (data.duration) $("[data-duration]", root).textContent = `${data.duration} min`;
      byDay = new Map();
      data.slots.map((iso) => new Date(iso)).sort((a, b) => a - b).forEach((d) => {
        const k = dayKeyFmt.format(d);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(d);
      });
      const now = new Date();
      months = [];
      const first = byDay.size ? [...byDay.keys()][0] : dayKeyFmt.format(now);
      const last = byDay.size ? [...byDay.keys()].pop() : first;
      let [y, m] = first.split("-").map(Number); m -= 1;
      const [ly, lm] = last.split("-").map(Number);
      while (y < ly || (y === ly && m <= lm - 1)) { months.push([y, m]); m++; if (m > 11) { m = 0; y++; } }
      if (!months.length) months.push([now.getFullYear(), now.getMonth()]);
      monthIdx = 0; loaded = true; state.hidden = true; root.classList.remove("is-loading");
      if (!byDay.size) { showState("No open times in the next few weeks. Try the Google booking page instead.", true); return; }
      renderMonth(true);
      selectDay([...byDay.keys()][0], false);
    } catch (err) {
      showState("Couldn’t load open times right now.", true);
    }
  }

  function renderMonth(first) {
    const [y, m] = months[monthIdx];
    monthEl.innerHTML = `${new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(Date.UTC(y, m, 15)))} <span>${y}</span>`;
    $("[data-prev]", root).disabled = monthIdx === 0;
    $("[data-next]", root).disabled = monthIdx === months.length - 1;
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const todayKey = dayKeyFmt.format(new Date());
    let html = "";
    for (let i = 0; i < lead; i++) html += `<span class="cal-pad" aria-hidden="true"></span>`;
    for (let d = 1; d <= count; d++) {
      const k = keyOf(y, m, d), n = (byDay.get(k) || []).length;
      const label = `${longDateFmt.format(new Date(Date.UTC(y, m, d, 12)))}${n ? `, ${n} open time${n > 1 ? "s" : ""}` : ", no open times"}`;
      html += `<button type="button" class="cal-day${n ? " has" : ""}${k === todayKey ? " today" : ""}${k === selectedDay ? " sel" : ""}" data-day="${k}" ${n ? "" : "disabled"} aria-label="${label}" aria-pressed="${k === selectedDay}"><span>${d}</span></button>`;
    }
    grid.innerHTML = html;
    if (anim) gsap.from(grid.children, { opacity: 0, y: first ? 14 : 8, scale: 0.92, duration: 0.5, stagger: { each: 0.008, from: "start" }, ease: "power3.out" });
  }

  function selectDay(k, focusSlots) {
    selectedDay = k; selectedSlot = null;
    $$(".cal-day", grid).forEach((b) => { const on = b.dataset.day === k; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on); });
    const list = byDay.get(k) || [];
    const [y, m, d] = k.split("-").map(Number);
    const label = longDateFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
    slotsHead.innerHTML = `<b>${label}</b><span>${list.length} open time${list.length === 1 ? "" : "s"}</span>`;
    slotsEl.innerHTML = list.map((t, i) => `<button type="button" class="slot" data-slot="${i}"><span class="slot-time">${timeFmt.format(t)}</span><span class="slot-go">Select →</span></button>`).join("");
    pickDate.textContent = label; pickTime.textContent = "then a time";
    if (anim) gsap.from(slotsEl.children, { opacity: 0, x: 24, duration: 0.55, stagger: 0.035, ease: "expo.out" });
    if (focusSlots && slotsEl.firstElementChild && innerWidth <= 900) slotsEl.closest(".slots").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  grid.addEventListener("click", (e) => { const b = e.target.closest(".cal-day.has"); if (b) selectDay(b.dataset.day, true); });
  $("[data-prev]", root).addEventListener("click", () => { if (monthIdx > 0) { monthIdx--; renderMonth(); } });
  $("[data-next]", root).addEventListener("click", () => { if (monthIdx < months.length - 1) { monthIdx++; renderMonth(); } });
  slotsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".slot"); if (!b) return;
    selectedSlot = byDay.get(selectedDay)[+b.dataset.slot];
    const end = new Date(selectedSlot.getTime() + parseInt($("[data-duration]", root).textContent, 10) * 60000);
    pickTime.textContent = `${timeFmt.format(selectedSlot)} – ${timeFmt.format(end)}`;
    $$(".slot", slotsEl).forEach((s) => s.classList.toggle("sel", s === b));
    if (anim) gsap.fromTo(".book-pick", { scale: 0.97 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, .5)" });
    setTimeout(() => go(2), anim ? 220 : 0);
  });
  $("[data-retry]", root).addEventListener("click", load);
  $("[data-back]", root).addEventListener("click", () => go(1));

  /* form */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim(), email = String(fd.get("email") || "").trim();
    formError.hidden = true;
    $$(".field", form).forEach((f) => f.classList.remove("bad"));
    if (!name) return fail("Add your name so I know who I’m meeting.", "#bkName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("That email doesn’t look right. Check it and try again.", "#bkEmail");
    if (!selectedSlot) return go(1);
    busy = true; root.classList.add("is-sending"); submitLabel.textContent = "Booking…";
    try {
      const res = await sendBooking({ start: selectedSlot.toISOString(), name, email, kind: fd.get("kind") || "", note: String(fd.get("note") || "").trim(), website: fd.get("website") || "", tz: visitorTz });
      if (!res.ok) throw new Error(res.error || "That time was just taken. Pick another one.");
      $("[data-done-when]", root).textContent = `${longDateFmt.format(selectedSlot)} · ${pickTime.textContent} ${tzShort}`;
      $("[data-done-text]", root).textContent = res.demo
        ? "Preview mode: no real booking was made. Once the Google Apps Script is connected, an invite with the Meet link goes to the email you entered."
        : `A calendar invite with the Google Meet link is on its way to ${email}.`;
      const meet = $("[data-meet]", root);
      if (res.meet) { meet.href = res.meet; meet.hidden = false; } else meet.hidden = true;
      go(3);
      loaded = false; // refresh times next time the panel opens
    } catch (err) {
      fail(err.message && err.message !== "Failed to fetch" ? err.message : "Couldn’t reach the calendar. Check your connection and try again.");
      if (/taken/i.test(err.message || "")) setTimeout(() => { go(1); load(); }, 1600);
    } finally {
      busy = false; root.classList.remove("is-sending"); submitLabel.textContent = "Confirm booking";
    }
    function fail(msg, field) {
      formError.textContent = msg; formError.hidden = false;
      if (field) { $(field).closest(".field").classList.add("bad"); $(field).focus(); }
      if (anim) gsap.fromTo(formError, { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, .3)" });
    }
  });

  function drawCheck() {
    const svg = $(".done-check", root);
    if (!anim) return;
    $$("circle, path", svg).forEach((p) => { const l = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: p.tagName === "path" ? 0.6 : 0.9, delay: p.tagName === "path" ? 0.55 : 0, ease: "power3.inOut" }); });
    gsap.from(svg, { scale: 0.6, rotate: -30, duration: 1.2, ease: "expo.out" });
  }

  /* open / close */
  function origin() {
    if (!opener) return "50% 50%";
    const r = opener.getBoundingClientRect();
    return `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
  }
  function open(trigger) {
    opener = trigger || null;
    root.hidden = false;
    document.documentElement.classList.add("book-open");
    const l = getLenis(); l && l.stop();
    if (step === 3) { form.reset(); go(1); }
    if (!loaded) load();
    if (anim) {
      const o = origin();
      gsap.fromTo(root, { clipPath: `circle(0% at ${o})` }, { clipPath: `circle(150% at ${o})`, duration: 1.1, ease: "expo.inOut" });
      gsap.from([".book-side > *", ".cal", ".slots"], { y: 40, opacity: 0, duration: 1, stagger: 0.07, ease: "expo.out", delay: 0.45 });
    }
    setTimeout(() => $(".book-close", root).focus({ preventScroll: true }), 50);
  }
  function close() {
    const done = () => {
      root.hidden = true;
      document.documentElement.classList.remove("book-open");
      const l = getLenis(); l && l.start();
      opener && opener.focus({ preventScroll: true });
    };
    if (anim) gsap.to(root, { clipPath: `circle(0% at ${origin()})`, duration: 0.8, ease: "expo.inOut", onComplete: done });
    else done();
  }
  $$("[data-booking]").forEach((a) => a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault(); open(a);
  }));
  $$("[data-book-close]", root).forEach((b) => b.addEventListener("click", close));
  addEventListener("keydown", (e) => {
    if (root.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab") { // keep focus inside the panel
      const f = $$("button:not([disabled]), a[href]:not([hidden]), input:not(.hp), textarea", root).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  if (location.hash === "#book") setTimeout(() => open(null), 1800);
  return { open, close };
}

export { FALLBACK_URL };
