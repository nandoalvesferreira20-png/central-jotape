function initTitlesPopover() {
  const trigger = document.querySelector('#titles-trigger');
  const panel = document.querySelector('#titles-popover');
  if (!trigger || !panel) return;
  let closeTimer;
  let pointerActivation = false;
  let wasOpen = false;
  let restoringFocus = false;
  const isOpen = () => panel.matches(':popover-open');
  function position() {
    if (!isOpen()) return;
    const anchor = trigger.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    panel.style.left = Math.max(left + 12, Math.min(anchor.left, left + width - box.width - 12)) + 'px';
    const below = anchor.bottom + 8;
    const preferred = below + box.height <= top + height - 12 ? below : anchor.top - box.height - 8;
    panel.style.top = Math.max(top + 12, Math.min(preferred, top + height - box.height - 12)) + 'px';
  }
  function open() { clearTimeout(closeTimer); if (!isOpen()) panel.showPopover(); trigger.setAttribute('aria-expanded', 'true'); position(); }
  function close(restore = false) {
    clearTimeout(closeTimer);
    if (isOpen()) panel.hidePopover();
    trigger.setAttribute('aria-expanded', 'false');
    if (restore) { restoringFocus = true; trigger.focus({ preventScroll: true }); restoringFocus = false; }
  }
  function leave() {
    closeTimer = setTimeout(() => {
      if (document.activeElement !== trigger && !panel.contains(document.activeElement) && !trigger.matches(':hover') && !panel.matches(':hover')) close();
    }, 180);
  }
  trigger.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') open(); });
  trigger.addEventListener('pointerleave', leave);
  panel.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  panel.addEventListener('pointerleave', leave);
  trigger.addEventListener('pointerdown', () => { pointerActivation = true; wasOpen = isOpen(); });
  trigger.addEventListener('pointercancel', () => { pointerActivation = false; });
  trigger.addEventListener('focus', () => { if (!pointerActivation && !restoringFocus) open(); });
  trigger.addEventListener('click', () => {
    const shouldClose = pointerActivation ? wasOpen : isOpen();
    pointerActivation = false;
    if (shouldClose) close(); else open();
  });
  trigger.addEventListener('blur', leave);
  panel.addEventListener('focusout', leave);
  panel.querySelector('[data-titles-close]').addEventListener('click', () => close(true));
  panel.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(isOpen())));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) { event.preventDefault(); close(true); }
  });
  // O popover nativo fecha ao clicar fora sem bloquear a navegação da página.
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });
  window.visualViewport?.addEventListener('resize', position);
}
initTitlesPopover();
