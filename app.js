// ===================== CONFIG BACKEND =====================
// URL par défaut (ton tunnel ngrok actuel) — change-la si ngrok en génère une nouvelle
const DEFAULT_BACKEND = "https://c85bdac23fa4.ngrok-free.app";

// Permet d'override l'URL backend via ?api=https://xxxx  (pratique pour tester)
function getApiBase() {
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("api");
    if (fromQuery) return fromQuery.trim();
  } catch (_) {}
  return DEFAULT_BACKEND;
}

const API_BASE = getApiBase();
const API = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;


// ===================== FETCH HELPER =====================
// helper fetch JSON (tolère les erreurs non-JSON)
async function jfetch(url, opts) {
  const r = await fetch(url, opts);
  let data;
  try {
    data = await r.json();
  } catch (_) {
    const txt = await r.text().catch(() => "");
    data = { detail: txt || "Erreur inconnue" };
  }
  if (!r.ok) {
    const msg = data.detail || data.error || r.statusText || "Erreur inconnue";
    throw new Error(msg);
  }
  return data;
}


// ===================== METADATA (optionnel) =====================
async function loadMeta() {
  const metaEl = document.getElementById("meta");
  if (!metaEl) return;
  try {
    const meta = await jfetch(API("/metadata"));
    let html = "";
    if (meta.Marque && Array.isArray(meta.Marque)) {
      const brands = meta.Marque.slice(0, 10)
        .map(v => `<span class="meta-pill">${v}</span>`).join("");
      html += `<div class='tip'>Exemples Marque:</div><div>${brands}</div>`;
    }
    if (meta.Prix && meta.Prix.min != null && meta.Prix.max != null) {
      html += `<div class='tip'>Prix min/max: ${meta.Prix.min} / ${meta.Prix.max}</div>`;
    }
    if (meta.Annee && meta.Annee.min != null && meta.Annee.max != null) {
      html += `<div class='tip'>Année min/max: ${meta.Annee.min} / ${meta.Annee.max}</div>`;
    }
    metaEl.innerHTML = html || "<div class='tip'>Aucune métadonnée.</div>";
  } catch (e) {
    metaEl.innerHTML = `<div class="tip">Métadonnées indisponibles. ${e.message ?? ""}</div>`;
  }
}
loadMeta();


// ===================== CHAT UI =====================
const chat = document.getElementById("chat");

function addBubble(role, content, isAnswer = false) {
  const wrap = document.createElement("div");
  wrap.className = `bubble ${role}`;

  const inner = document.createElement("div");
  inner.className = "bubble-inner";
  inner.textContent = content;
  wrap.appendChild(inner);

  if (isAnswer) {
    const pre = document.createElement("div");
    pre.className = "answer";
    pre.textContent = content;

    inner.textContent = "Réponse SGI :";

    const box = document.createElement("div");
    box.className = "answer-box";

    const btn = document.createElement("button");
    btn.className = "copy";
    btn.textContent = "Copier";
    btn.onclick = () => navigator.clipboard.writeText(pre.textContent);

    box.appendChild(pre);
    box.appendChild(btn);
    inner.appendChild(box);
  }

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

// Pousse la valeur dans le dashboard Dassault (paramètre mappé sgi.filter)
function applyToDashboard(sgiText) {
  if (!sgiText) return;
  window.top.postMessage(
    {
      target: "3DEXPERIENCE",
      type: "dashboard-parameter",
      action: "set",
      name: "sgi.filter",   // doit correspondre au mapping du widget DP
      value: sgiText
    },
    "*"
  );
}

// Gestion du formulaire
document.getElementById("composer").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = document.getElementById("question");
  const text = q.value.trim();
  if (!text) return;

  addBubble("user", text);
  q.value = "";

  try {
    const data = await jfetch(API("/chat"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({ question: text })
    });

    // On attend "sgi" (conforme à app.py corrigé). Fallback sur "answer" si besoin.
    const sgi = data.sgi ?? data.answer ?? "";
    addBubble("assistant", sgi || "(vide)", true);

    // 🚀 Pousse direct la réponse dans le dashboard → met à jour la Data Perspective
    applyToDashboard(sgi);

  } catch (e2) {
    addBubble("assistant", "Erreur: " + (e2.message || "inconnue"));
  }
});

// (optionnel) écoute la confirmation du dashboard
window.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "dashboard-parameter" && d.name === "sgi.filter") {
    console.log("✔ Filtre appliqué dans le dashboard:", d.value);
  }
});
