// --- API base (gère localhost, prod et file://) ----------------------------
function getApiBase() {
  const { protocol, hostname } = window.location;

  // Ouverture directe du fichier -> pas de host
  if (protocol === 'file:' || !hostname) {
    return 'http://localhost:8000';
  }

  // Dev local on garde 8000 pour le backend
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }

  // Prod/staging: même protocole + host, port backend 8000
  return `${protocol}//${hostname}:8000`;
}

const API_BASE = getApiBase();
const API = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

// --- helper fetch JSON (tolère les erreurs non-JSON) -----------------------
async function jfetch(url, opts) {
  const r = await fetch(url, opts);
  let data;
  try {
    data = await r.json();
  } catch (_) {
    const txt = await r.text().catch(() => '');
    data = { detail: txt || 'Erreur inconnue' };
  }
  if (!r.ok) {
    const msg = data.detail || data.error || r.statusText || 'Erreur inconnue';
    throw new Error(msg);
  }
  return data;
}

// --- meta -------------------------------------------------------------------
async function loadMeta() {
  const metaEl = document.getElementById('meta');
  try {
    const meta = await jfetch(API('/metadata'));
    let html = '';
    if (meta.Marque) {
      const brands = meta.Marque.slice(0, 10)
        .map(v => `<span class="meta-pill">${v}</span>`).join('');
      html += `<div class='tip'>Exemples Marque:</div><div>${brands}</div>`;
    }
    if (meta.Prix) {
      html += `<div class='tip'>Prix min/max: ${meta.Prix.min} / ${meta.Prix.max}</div>`;
    }
    if (meta.Annee) {
      html += `<div class='tip'>Année min/max: ${meta.Annee.min} / ${meta.Annee.max}</div>`;
    }
    metaEl.innerHTML = html || '<div class="tip">Aucune métadonnée.</div>';
  } catch (e) {
    metaEl.innerHTML = `<div class="tip">Métadonnées indisponibles. ${e.message ?? ''}</div>`;
  }
}
loadMeta();

// --- chat UI ---------------------------------------------------------------
const chat = document.getElementById('chat');

function addBubble(role, content, isAnswer = false) {
  const wrap = document.createElement('div');
  wrap.className = `bubble ${role}`;

  const inner = document.createElement('div');
  inner.className = 'bubble-inner';
  inner.textContent = content;
  wrap.appendChild(inner);

  if (isAnswer) {
    const pre = document.createElement('div');
    pre.className = 'answer';
    pre.textContent = content;

    inner.textContent = 'Réponse SGI :';

    const box = document.createElement('div');
    box.className = 'answer-box';

    const btn = document.createElement('button');
    btn.className = 'copy';
    btn.textContent = 'Copier';
    btn.onclick = () => navigator.clipboard.writeText(pre.textContent);

    box.appendChild(pre);
    box.appendChild(btn);
    inner.appendChild(box);
  }

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById('composer').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('question');
  const text = q.value.trim();
  if (!text) return;

  addBubble('user', text);
  q.value = '';

  try {
    const data = await jfetch(API('/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ question: text })
    });
    addBubble('assistant', data.answer, true);
  } catch (e2) {
    addBubble('assistant', 'Erreur: ' + (e2.message || 'inconnue'));
  }
});
