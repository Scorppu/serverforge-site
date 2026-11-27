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
let caretChar: HTMLElement | null = null;
let armedEl: HTMLElement | null = null;
let reduceQuery: MediaQueryList | null = null;

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

function clearCaret(): void {
  caretChar?.classList.remove("is-caret");
  caretChar = null;
  armedEl?.classList.remove("is-armed");
  armedEl = null;
}

function restoreAll(): void {
  clearCaret();
  for (const [el, html] of originals) {
    el.innerHTML = html;
    el.classList.remove("typed", "is-armed");
  }
  blocks = [];
}

function scrollProgress(el: HTMLElement): number {
  const vh = window.innerHeight || 1;
  const scrollY = window.scrollY;
  const docTop = el.getBoundingClientRect().top + scrollY;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);

  // Copy that already starts on the first screen is the hero handoff: show it whole.
  // Everything below reveals only as scroll moves it from the fold to the reading line.
  if (docTop < vh - 1) return 1;
  if (maxScroll <= 0 || scrollY >= maxScroll - 1) return 1;

  const start = docTop - vh;
  const end = Math.min(docTop - vh * 0.42, maxScroll);
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

function placeCaret(block: Block | null, count: number): void {
  const nextChar =
    block && count > 0 && count < block.chars.length ? (block.chars[count - 1] ?? null) : null;
  const nextArmed = block && count <= 0 && block.chars.length > 0 ? block.el : null;
  if (caretChar === nextChar && armedEl === nextArmed) return;
  clearCaret();
  if (nextArmed) {
    nextArmed.classList.add("is-armed");
    armedEl = nextArmed;
  }
  if (nextChar) {
    nextChar.classList.add("is-caret");
    caretChar = nextChar;
  }
}

export function updateScrollType(): void {
  if (blocks.length === 0) return;
  const measured = blocks.map((block) => {
    const progress = scrollProgress(block.el);
    return { progress, count: countFor(progress, block.chars.length) };
  });
  blocks.forEach((block, index) => applyCount(block, measured[index].count));

  let active = -1;
  for (let i = 0; i < measured.length; i++) {
    if (measured[i].progress > 0 && measured[i].progress < 1) active = i;
  }
  placeCaret(active < 0 ? null : blocks[active], active < 0 ? 0 : measured[active].count);
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

  const observer = new ResizeObserver(() => updateScrollType());
  observer.observe(document.documentElement);
}
