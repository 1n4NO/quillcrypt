const progress = document.querySelector('.progress span');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0}%`;
}

window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

menuToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.querySelector('span').textContent = open ? '×' : '+';
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.querySelector('span').replaceChildren('+');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible'));
}, { threshold: 0.14 });
document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

document.querySelectorAll('[data-demo]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault();
  const original = link.innerHTML;
  link.innerHTML = 'Coming soon <span>↗</span>';
  window.setTimeout(() => { link.innerHTML = original; }, 1800);
}));
