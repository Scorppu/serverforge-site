const TYPE_SELECTOR = [
  ".eyebrow",
  ".hero h1",
  ".lede",
  ".version-line",
  ".hero .note",
  ".story .kicker",
  ".story h2",
  ".story .body",
  ".caption",
  ".site-footer p",
].join(",");

const TYPE_MIN_MS = 380;
const TYPE_MAX_MS = 820;
const TYPE_PER_CHAR_MS = 18;

type Token = { kind: "char"; ch: string } | { kind: "br" };

type Block = {
  el: HTMLElement;
  chars: HTMLElement[];
  shown: number;
  started: boolean;
};

const originals = new Map<HTMLElement, string>();
let blocks: Block[] = [];
let reduceQuery: MediaQueryList | null = null;
let animGen = 0;
let viewObserver: IntersectionObserver | null = null;

function tokensFrom(el: HTMLElement): Token[] {
  const tokens: Token[] = [];
  const trimStart = { value: true };

  const pushText = (raw: string): void => {
    let text = raw.replace(/\s+/g, " ");
    if (trimStart.value) text = text.replace(/^ /, "");
    trimStart.value = false;
    for (const ch of text) {
      if (ch === " " && tokens.length === 0) continue;
      tokens.push({ kind: "char", ch });
    }
  };

  const walk = (node: Node): void => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        pushText(child.textContent ?? "");
      } else if (child instanceof HTMLBRElement) {
        const last = tokens[tokens.length - 1];
        if (last?.kind === "char" && last.ch === " ") tokens.pop();
        tokens.push({ kind: "br" });
        trimStart.value = true;
      } else if (child instanceof HTMLElement) {
        walk(child);
      }
    });
  };

  walk(el);
  while (tokens[0]?.kind === "char" && tokens[0].ch === " ") tokens.shift();
  const tail = tokens[tokens.length - 1];
  if (tail?.kind === "char" && tail.ch === " ") tokens.pop();
  return tokens;
}

function enhance(el: HTMLElement): Block | null {
  if (!originals.has(el)) originals.set(el, el.innerHTML);
  const tokens = tokensFrom(el);
  const chars: HTMLElement[] = [];
  const sr = document.createElement("span");
  sr.className = "typed-sr";
  sr.textContent = tokens
    .map((token) => (token.kind === "br" ? " " : token.ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  const visual = document.createElement("span");
  visual.className = "typed-visual";
  visual.setAttribute("aria-hidden", "true");

  tokens.forEach((token) => {
    if (token.kind === "br") {
      visual.append(document.createElement("br"));
      return;
    }
    const span = document.createElement("span");
    span.className = "typed-ch";
    span.textContent = token.ch;
    chars.push(span);
    visual.append(span);
  });

  el.classList.add("typed");
  el.replaceChildren(sr, visual);
  return { el, chars, shown: -1, started: false };
}

function restoreAll(): void {
  animGen += 1;
  viewObserver?.disconnect();
  viewObserver = null;
  for (const [el, html] of originals) {
    el.innerHTML = html;
    el.classList.remove("typed");
  }
  blocks = [];
}

function applyCount(block: Block, count: number): void {
  if (block.shown === count) return;
  const from = block.shown < 0 ? 0 : Math.min(block.shown, count);
  const to = Math.max(block.shown, count);
  for (let i = from; i < to; i++) {
    block.chars[i]?.classList.toggle("is-on", i < count);
  }
  block.shown = count;
}

function hostOf(el: HTMLElement): HTMLElement | null {
  return el.closest<HTMLElement>("section, footer");
}

function intersects(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function atEnd(): boolean {
  const vh = window.innerHeight || 1;
  const maxScroll = document.documentElement.scrollHeight - vh;
  return maxScroll <= 0 || window.scrollY >= maxScroll - 2;
}

function startBlock(block: Block): void {
  if (block.started || reduceQuery?.matches) return;
  block.started = true;
  const total = block.chars.length;
  const gen = animGen;
  if (total === 0) {
    applyCount(block, 0);
    return;
  }
  const duration = Math.min(TYPE_MAX_MS, Math.max(TYPE_MIN_MS, total * TYPE_PER_CHAR_MS));
  const startedAt = performance.now();
  const step = (now: number): void => {
    if (gen !== animGen) return;
    const t = Math.min(1, (now - startedAt) / duration);
    applyCount(block, Math.round(total * t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function startHost(host: HTMLElement): void {
  blocks.forEach((block) => {
    if (hostOf(block.el) === host) startBlock(block);
  });
}

function scanVisible(): void {
  if (reduceQuery?.matches || blocks.length === 0) return;
  const end = atEnd();
  document.querySelectorAll<HTMLElement>("section, footer").forEach((host) => {
    if (intersects(host) || (end && host.matches("footer, #local-data"))) startHost(host);
  });
}

export function updateScrollType(): void {
  scanVisible();
}

function enhanceAll(): void {
  if (blocks.length > 0) return;
  document.querySelectorAll<HTMLElement>(TYPE_SELECTOR).forEach((el) => {
    if (el.closest(".app-stage")) return;
    const block = enhance(el);
    if (block) blocks.push(block);
  });
}

function watchView(): void {
  viewObserver?.disconnect();
  if (reduceQuery?.matches) return;
  viewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) startHost(entry.target as HTMLElement);
    });
  });
  document.querySelectorAll<HTMLElement>("section, footer").forEach((host) => {
    viewObserver?.observe(host);
  });
  scanVisible();
}

function sync(reduce: boolean): void {
  document.documentElement.classList.toggle("motion-ok", !reduce);
  document.documentElement.classList.toggle("reduced-motion", reduce);
  if (reduce) {
    document.documentElement.classList.remove("show-welcome", "welcome-leave");
    restoreAll();
    return;
  }
  enhanceAll();
  watchView();
}

export function bindScrollType(reduce: MediaQueryList): void {
  reduceQuery = reduce;
  sync(reduce.matches);
  reduce.addEventListener("change", () => {
    sync(reduceQuery?.matches ?? false);
  });

  document.fonts?.ready.then(() => scanVisible()).catch(() => undefined);
  window.addEventListener("scrollend", () => scanVisible());
  window.addEventListener("hashchange", () => {
    requestAnimationFrame(scanVisible);
  });
  window.addEventListener("resize", () => scanVisible());
}
