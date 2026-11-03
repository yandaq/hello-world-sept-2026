const card = document.querySelector('.card');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('status');

// Decorative work starts before the message request and never changes card state.
function initMouseTrail() {
  const backdrop = document.querySelector('.backdrop');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const interval = 45;
  const lifetime = 700;
  const maxParticles = 16;
  const particles = new Map();
  let lastEmission = -Infinity;

  function clear() {
    for (const [particle, timer] of particles) {
      clearTimeout(timer);
      particle.remove();
    }
    particles.clear();
    lastEmission = -Infinity;
  }

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || motion.matches || document.hidden ||
        (event.movementX === 0 && event.movementY === 0)) return;
    const now = performance.now();
    if (now - lastEmission < interval || particles.size >= maxParticles) return;
    lastEmission = now;

    const particle = document.createElement('span');
    particle.className = 'sparkle';
    particle.style.setProperty('--spark-x', `${event.clientX}px`);
    particle.style.setProperty('--spark-y', `${event.clientY}px`);
    particle.style.setProperty('--spark-turn', `${Math.random() * 90}deg`);
    backdrop.append(particle);
    // A bounded timer also removes nodes if CSS animation events never arrive.
    particles.set(particle, setTimeout(() => {
      particle.remove();
      particles.delete(particle);
    }, lifetime));
  }, { passive: true });

  motion.addEventListener('change', () => {
    if (motion.matches) clear();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clear();
  });
  window.addEventListener('pagehide', clear);
}

initMouseTrail();

function fail(text, error) {
  console.error('failed to load message:', error);
  statusEl.textContent = text;
  card.dataset.state = 'error';
}

try {
  const response = await fetch('/api/message');
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && typeof data.error === 'string' ? data.error : `request failed (${response.status})`;
    fail(detail, new Error(`GET /api/message → ${response.status}: ${detail}`));
  } else if (!data || typeof data.message !== 'string') {
    fail('The server returned an unexpected response.', new Error('malformed JSON body from /api/message'));
  } else {
    messageEl.textContent = data.message;
    statusEl.textContent = '';
    card.dataset.state = 'ready';
  }
} catch (error) {
  fail('Could not reach the server. Please try again.', error);
}
