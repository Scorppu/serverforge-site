const LINES = ["serverforge", "welcome", "local Minecraft server operations"] as const;

const CHAR_MS = 32;
const LINE_GAP_MS = 210;
const LEAD_MS = 260;
const HOLD_MS = 560;

const SCROLL_KEYS = new Set([
  " ",
  "Spacebar",
  "Enter",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  "Tab",
  "Escape",
]);

function lineStart(index: number): number {
  let time = LEAD_MS;
  for (let i = 0; i < index; i++) {
    time += LINES[i].length * CHAR_MS + LINE_GAP_MS;
  }
  return time;
}

function typedCount(line: number, elapsed: number): number {
  const start = lineStart(line);
  if (elapsed <= start) return 0;
  return Math.min(LINES[line].length, Math.floor((elapsed - start) / CHAR_MS));
}

function activeLine(elapsed: number): number {
  for (let i = 0; i < LINES.length; i++) {
    if (elapsed < lineStart(i) + LINES[i].length * CHAR_MS) return i;
  }
  return LINES.length - 1;
}

const FINISH_MS = lineStart(LINES.length - 1) + LINES[LINES.length - 1].length * CHAR_MS + HOLD_MS;

function markSeen(): void {
  try {
    sessionStorage.setItem("sf-welcome", "1");
  } catch {
    /* Storage can throw in private mode. The intro still ends. */
  }
}

function releaseScrollLock(): void {
  window.dispatchEvent(new Event("sf-welcome-done"));
}

export function startWelcome(reduce: MediaQueryList): void {
  const root = document.documentElement;
  const welcome = document.querySelector<HTMLElement>(".welcome");
  if (!welcome) return;

  const texts = welcome.querySelectorAll<HTMLElement>(".welcome-text");
  const lines = welcome.querySelectorAll<HTMLElement>(".welcome-live .welcome-line");

  let frame = 0;
  let elapsed = 0;
  let last = 0;
  let closed = false;

  const paint = (time: number): void => {
    let caret = activeLine(time);
    if (time < LEAD_MS) caret = 0;
    lines.forEach((line, index) => {
      const count = typedCount(index, time);
      const slot = texts[index];
      const next = LINES[index].slice(0, count);
      if (slot && slot.textContent !== next) slot.textContent = next;
      line.classList.toggle("is-active", index === caret && time < FINISH_MS);
    });
  };

  const close = (immediate: boolean): void => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    markSeen();
    releaseScrollLock();
    window.removeEventListener("keydown", onKey);
    welcome.removeEventListener("click", onClick);
    reduce.removeEventListener("change", onReduce);

    const finish = (): void => {
      root.classList.remove("show-welcome", "welcome-leave");
      welcome.setAttribute("hidden", "");
    };

    if (immediate || reduce.matches) {
      finish();
      return;
    }

    root.classList.add("welcome-leave");
    const timeout = window.setTimeout(finish, 500);
    welcome.addEventListener(
      "transitionend",
      (event) => {
        if (event.target !== welcome || event.propertyName !== "opacity") return;
        window.clearTimeout(timeout);
        finish();
      },
      { once: true },
    );
  };

  const onKey = (event: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(event.key)) event.preventDefault();
    close(true);
  };

  const onClick = (): void => {
    close(true);
  };

  const onReduce = (): void => {
    if (reduce.matches) close(true);
  };

  const tick = (now: number): void => {
    if (closed) return;
    if (!document.hidden) elapsed += now - last;
    last = now;
    paint(elapsed);
    if (elapsed >= FINISH_MS) {
      close(false);
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  if (!root.classList.contains("show-welcome") || reduce.matches) {
    root.classList.remove("show-welcome", "welcome-leave");
    releaseScrollLock();
    return;
  }

  markSeen();
  welcome.removeAttribute("hidden");
  paint(0);
  last = performance.now();
  frame = requestAnimationFrame(tick);
  window.addEventListener("keydown", onKey);
  welcome.addEventListener("click", onClick);
  reduce.addEventListener("change", onReduce);

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || closed) return;
    close(true);
  });
}
