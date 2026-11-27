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

type Token = { kind: "char"; ch: string } | { kind: "br" };

type Block = {
  el: HTMLElement;
  chars: HTMLElement[];
  shown: number;
};

const originals = new Map<HTMLElement, string>();
let blocks: Block[] = [];
let reduceQuery: MediaQueryList | null = null;

/** A block is fully typed once its top reaches this fraction of the viewport. */
const ENTER_LINE = 0.9;

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
  return { el, chars, shown: -1 };
}

function restoreAll(): void {
  for (const [el, html] of originals) {
    el.innerHTML = html;
    el.classList.remove("typed");
  }
  blocks = [];
}

function scrollPadding(): number {
  const raw = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
  if (Number.isFinite(raw) && raw > 0) return raw;
  const topbar = document.querySelector(".topbar");
  return (topbar?.getBoundingClientRect().height ?? 64) + 16;
}

function sectionLanded(el: HTMLElement): boolean {
  const section = el.closest("section");
  if (!section) return false;
  // In-page links settle with the section top at scroll-padding, just under the header.
  return section.getBoundingClientRect().top <= scrollPadding() + 24;
}

function scrollProgress(el: HTMLElement): number {
  const vh = window.innerHeight || 1;
  const scrollY = window.scrollY;
  const docTop = el.getBoundingClientRect().top + scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);

  if (maxScroll <= 0 || scrollY >= maxScroll - 1) return 1;
  // Copy on the opening screen is the handoff, already complete.
  if (docTop < vh - 1) return 1;
  // A nav or hash landing completes that section and every section above it.
  if (sectionLanded(el)) return 1;

  // 0 when the block is still at the bottom edge, 1 once it has entered
  // the lower band (top at 90% of the viewport). Mid-screen text is done.
  const start = docTop - vh;
  const end = Math.min(docTop - vh * ENTER_LINE, maxScroll);
  if (end <= start) return scrollY >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
}

function countFor(progress: number, total: number): number {
  if (total === 0 || progress <= 0) return 0;
  if (progress >= 1) return total;
  return Math.min(total, Math.ceil(progress * total));
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

export function updateScrollType(): void {
  if (blocks.length === 0) return;
  const measured = blocks.map((block) => countFor(scrollProgress(block.el), block.chars.length));
  blocks.forEach((block, index) => applyCount(block, measured[index]));
}

function enhanceAll(): void {
  if (blocks.length > 0) return;
  document.querySelectorAll<HTMLElement>(TYPE_SELECTOR).forEach((el) => {
    if (el.closest(".app-stage")) return;
    const block = enhance(el);
    if (block) blocks.push(block);
  });
  updateScrollType();
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
  updateScrollType();
}

export function bindScrollType(reduce: MediaQueryList): void {
  reduceQuery = reduce;
  sync(reduce.matches);
  reduce.addEventListener("change", () => {
    sync(reduceQuery?.matches ?? false);
  });

  document.fonts?.ready.then(() => updateScrollType()).catch(() => undefined);
  window.addEventListener("scrollend", () => updateScrollType());
  window.addEventListener("hashchange", () => {
    requestAnimationFrame(updateScrollType);
  });

  const observer = new ResizeObserver(() => updateScrollType());
  observer.observe(document.documentElement);
}
