import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "./styles.css";

const sectionIds = [
  "instances",
  "live-console",
  "modrinth",
  "players",
  "customization",
  "local-data",
] as const;

const dialog = document.querySelector<HTMLDialogElement>("#installer-dialog");
let opener: HTMLElement | null = null;

document.querySelectorAll<HTMLButtonElement>("[data-open-installer]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!dialog) return;
    opener = button;
    dialog.showModal();
  });
});

dialog?.querySelector<HTMLButtonElement>("[data-close-installer]")?.addEventListener("click", () => {
  dialog.close();
});

dialog?.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) dialog.close();
});

dialog?.addEventListener("close", () => {
  opener?.focus();
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentId = "";

function headerOffset(): number {
  const topbar = document.querySelector(".topbar");
  return (topbar?.getBoundingClientRect().height ?? 64) + 28;
}

function setCurrent(id: string): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-section-link]").forEach((link) => {
    if (link.getAttribute("href") === `#${id}`) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const bar = document.querySelector<HTMLElement>(".mobile-nav");
  const scroller = document.querySelector<HTMLElement>(".mobile-nav-scroll");
  if (!bar || !scroller || getComputedStyle(bar).display === "none") return;

  const link = scroller.querySelector<HTMLElement>(`a[href="#${CSS.escape(id)}"]`);
  if (!link) return;

  const left = link.offsetLeft - (scroller.clientWidth - link.clientWidth) / 2;
  scroller.scrollTo({
    left: Math.max(0, left),
    behavior: prefersReducedMotion.matches ? "auto" : "smooth",
  });
}

function updateCurrent(): void {
  const atBottom =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
  let next: string = sectionIds[0];
  if (atBottom) {
    next = sectionIds[sectionIds.length - 1];
  } else {
    const line = window.scrollY + headerOffset();
    for (const id of sectionIds) {
      const section = document.getElementById(id);
      if (!section) continue;
      const top = section.getBoundingClientRect().top + window.scrollY;
      if (top <= line) next = id;
    }
  }
  if (next === currentId) return;
  currentId = next;
  setCurrent(next);
}

let ticking = false;
function onScroll(): void {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateCurrent();
    ticking = false;
  });
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll);
window.addEventListener("hashchange", () => {
  requestAnimationFrame(updateCurrent);
});
updateCurrent();
