// Prévia independente da home: rolagem nativa para swipe e foco por teclado.
function initHomeGallery() {
  const strip = document.querySelector('.gallery-teaser-photos');
  if (!strip) return;
  const photos = [...strip.querySelectorAll('a')];
  const controls = document.querySelector('.gallery-teaser-controls');
  let selected = 0;
  let settleTimer;
  function positions() {
    return photos.map(photo => photo.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft);
  }
  strip.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const offsets = positions();
      selected = offsets.reduce((best, position, i) => Math.abs(position - strip.scrollLeft) < Math.abs(offsets[best] - strip.scrollLeft) ? i : best, 0);
    }, 150);
  }, { passive: true });
  function move(direction) {
    clearTimeout(settleTimer);
    selected = (selected + direction + photos.length) % photos.length;
    strip.scrollTo({ left: positions()[selected], behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  controls.hidden = false;
  controls.querySelector('[data-teaser-prev]').addEventListener('click', () => move(-1));
  controls.querySelector('[data-teaser-next]').addEventListener('click', () => move(1));
  strip.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
}
initHomeGallery();
