'use strict';

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

function initHeader() {
  const header = document.querySelector('.header');
  let scheduled = false;
  function update() {
    header.classList.toggle('scrolled', window.scrollY > 70);
    scheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

function initMenu() {
  const button = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.navigation');
  const mobile = window.matchMedia('(max-width: 760px)');
  function setOpen(open, restoreFocus = false) {
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('span').textContent = open ? 'Fechar' : 'Menu';
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (restoreFocus) button.focus();
  }
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    setOpen(false);
    const target = document.querySelector(link.getAttribute('href'));
    if (target && mobile.matches) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
  });
  document.addEventListener('keydown', event => {
    if (button.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') setOpen(false, true);
    if (event.key === 'Tab') {
      const last = nav.querySelector('a:last-child');
      if (event.shiftKey && document.activeElement === button) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); button.focus(); }
    }
  });
  mobile.addEventListener('change', () => setOpen(false));
}

function initScrollReveal() {
  if (!('IntersectionObserver' in window) || motionPreference.matches) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(element => {
    element.classList.add('is-pending');
    observer.observe(element);
  });
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) {
      document.querySelectorAll('.reveal').forEach(element => element.classList.add('is-visible'));
      observer.disconnect();
    }
  });
}

function initCounters() {
  const format = new Intl.NumberFormat('pt-BR');
  const counters = [...document.querySelectorAll('[data-value]')].filter(element =>
    element.dataset.value.trim() !== '' && Number.isFinite(Number(element.dataset.value))
  );
  function animate(element) {
    const value = Number(element.dataset.value);
    const suffix = element.dataset.suffix || '';
    if (motionPreference.matches) { element.textContent = format.format(value) + suffix; return; }
    const start = performance.now();
    function tick(now) {
      const progress = motionPreference.matches ? 1 : Math.min((now - start) / 1100, 1);
      element.textContent = format.format(Math.round(value * (1 - Math.pow(1 - progress, 3)))) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (!('IntersectionObserver' in window)) { counters.forEach(animate); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { animate(entry.target); observer.unobserve(entry.target); }
  }), { threshold: 0.5 });
  counters.forEach(element => observer.observe(element));
}

function initParallax() {
  const photo = document.querySelector('.hero-photo img');
  const desktop = window.matchMedia('(min-width: 1001px) and (pointer: fine)');
  let scheduled = false;
  function update() {
    if (motionPreference.matches || !desktop.matches) photo.style.removeProperty('translate');
    else if (window.scrollY < window.innerHeight * 1.5) photo.style.translate = `0 ${Math.min(window.scrollY * 0.055, 40)}px`;
    scheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }, { passive: true });
  desktop.addEventListener('change', update);
  motionPreference.addEventListener('change', update);
  update();
}

function initMarquee() {
  const ticker = document.querySelector('.ticker');
  const button = ticker.querySelector('.ticker-toggle');
  button.addEventListener('click', () => {
    const paused = ticker.classList.toggle('is-paused');
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Retomar faixa em movimento' : 'Pausar faixa em movimento');
    button.textContent = paused ? 'Retomar' : 'Pausar';
  });
}

initHeader();
initMenu();
initScrollReveal();
initCounters();
initParallax();
initMarquee();
