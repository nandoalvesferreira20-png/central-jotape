/* Acrescente fotos locais aqui. Preserve nomes, dimensões e alt descritivo.
   A ordem define a composição; o primeiro registro ocupa o destaque. */
const galleryImages = [
  { src: 'assets/img/galeria/IMG_7308.JPG.jpeg', alt: 'Jotapê em retrato em preto e branco, com uma mão junto ao rosto', width: 2704, height: 3600 },
  { src: 'assets/img/galeria/IMG_7310.JPG.jpeg', alt: 'Jotapê de casaco preto e braços cruzados', width: 2928, height: 3904 },
  { src: 'assets/img/galeria/IMG_7311.JPG.jpeg', alt: 'Jotapê com as mãos tatuadas e anéis diante do rosto', width: 1888, height: 2528 },
  { src: 'assets/img/galeria/IMG_7312.JPG.jpeg', alt: 'Retrato de Jotapê com colar sobre um casaco preto', width: 2464, height: 3280 },
  { src: 'assets/img/galeria/IMG_7317.JPG.jpeg', alt: 'Jotapê em preto e branco, com as mãos junto ao rosto', width: 2288, height: 3056 }
];

function initGallery() {
  const grid = document.querySelector('[data-gallery]');
  const dialog = document.querySelector('.gallery-lightbox');
  const full = dialog.querySelector('[data-full-image]');
  const caption = dialog.querySelector('[data-gallery-caption]');
  const count = dialog.querySelector('[data-gallery-count]');
  const close = dialog.querySelector('.gallery-close');
  let current = 0;
  let trigger;
  let touchStart = null;
  let active = 0;
  let drag = null;
  let suppressClickUntil = 0;
  const carousel = document.querySelector('.gallery-carousel');
  const slides = [];
  function activate(index) {
    active = (index + galleryImages.length) % galleryImages.length;
    slides.forEach((slide, i) => {
      let offset = (i - active + galleryImages.length) % galleryImages.length;
      if (offset > galleryImages.length / 2) offset -= galleryImages.length;
      slide.style.setProperty('--offset', offset);
      slide.classList.toggle('is-active', offset === 0);
      slide.classList.toggle('is-away', Math.abs(offset) > 1);
      slide.setAttribute('aria-hidden', String(offset !== 0));
      slide.querySelector('button').tabIndex = offset === 0 ? 0 : -1;
    });
    document.querySelector('[data-carousel-count]').textContent = String(active + 1).padStart(2, '0') + ' / ' + String(galleryImages.length).padStart(2, '0');
    const caption = document.querySelector('[data-active-caption]');
    caption.textContent = galleryImages[active].caption || '';
    caption.hidden = !caption.textContent;
  }

  function show(index) {
    current = (index + galleryImages.length) % galleryImages.length;
    const photo = galleryImages[current];
    full.src = photo.src;
    full.alt = photo.alt;
    caption.textContent = photo.alt;
    count.textContent = (current + 1) + ' / ' + galleryImages.length;
  }
  galleryImages.forEach((photo, index) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Ampliar: ' + photo.alt);
    button.setAttribute('aria-haspopup', 'dialog');
    const image = document.createElement('img');
    Object.assign(image, photo, { loading: index === 0 ? 'eager' : 'lazy', decoding: 'async' });
    image.draggable = false;
    button.append(image);
    figure.append(button);
    grid.append(figure);
    slides.push(figure);
    button.addEventListener('click', () => {
      if (Date.now() < suppressClickUntil) return;
      if (index !== active) { activate(index); return; }
      trigger = button;
      show(index);
      dialog.showModal();
      document.body.classList.add('gallery-open');
      close.focus();
    });
  });
  activate(0);
  document.querySelector('[data-carousel-previous]').addEventListener('click', () => activate(active - 1));
  document.querySelector('[data-carousel-next]').addEventListener('click', () => activate(active + 1));
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const wasSlide = event.target.closest('.gallery-item');
      activate(active + (event.key === 'ArrowLeft' ? -1 : 1));
      if (wasSlide) slides[active].querySelector('button').focus({ preventScroll: true });
    }
  });
  grid.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId };

  });
  grid.addEventListener('pointermove', event => {
    if (drag && event.pointerId === drag.id && Math.abs(event.clientX - drag.x) > 8 && Math.abs(event.clientX - drag.x) > Math.abs(event.clientY - drag.y)) grid.setPointerCapture(event.pointerId);
  });
  grid.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      activate(active + (dx < 0 ? 1 : -1));
      suppressClickUntil = Date.now() + 350;
    }
    drag = null;
  });
  grid.addEventListener('pointercancel', () => { drag = null; });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('gallery-open');
    touchStart = null;
    trigger?.focus();
  });
  dialog.querySelector('[data-previous]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  // O dialog nativo mantém o foco no modal e fecha com Escape.
  dialog.addEventListener('click', event => {
    if (event.target === dialog || event.target.classList.contains('gallery-lightbox-content')) dialog.close();
  });
  full.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  full.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  full.addEventListener('touchcancel', () => { touchStart = null; });
}
initGallery();
