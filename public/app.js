const card = document.querySelector('.card');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('status');

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
