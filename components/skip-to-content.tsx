"use client";

function focusMainContent() {
  const target = document.getElementById("main-content") ?? document.querySelector("main");
  if (!(target instanceof HTMLElement)) return;

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener(
      "blur",
      () => {
        target.removeAttribute("tabindex");
      },
      { once: true }
    );
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(0.75rem+env(safe-area-inset-top))] focus:z-[100] focus:border focus:border-primary focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-ink focus:shadow-lift focus:outline-none focus:ring-4 focus:ring-primary/20"
      onClick={(event) => {
        event.preventDefault();
        focusMainContent();
      }}
    >
      Zum Inhalt springen
    </a>
  );
}
