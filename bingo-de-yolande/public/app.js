// ===================== Bingo de Yolande — logique front-end =====================

const ACCESS_CODE = "yolandemorue"; // doit correspondre à BINGO_ACCESS_CODE côté serveur
const LETTERS = ["B", "I", "N", "G", "O"];
function letterFor(n) {
  if (n <= 15) return "B";
  if (n <= 30) return "I";
  if (n <= 45) return "N";
  if (n <= 60) return "G";
  return "O";
}

// ---------- Sons originaux (Web Audio API) ----------
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    _audioCtx = new AC();
  }
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

function playTrumpetCall() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const playBrassNote = (freq, startTime, duration, peakGain) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc2.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq, startTime);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2400, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + duration + 0.02);
      osc2.stop(startTime + duration + 0.02);
    };
    playBrassNote(523.25, now, 0.16, 0.2);
    playBrassNote(659.25, now + 0.14, 0.26, 0.24);
  } catch (e) {
    // ignore
  }
}

function playBingoSaxJingle() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const playSaxNote = (freq, startTime, duration, peakGain) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const vibratoLFO = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 1.005, startTime);

      vibratoLFO.frequency.setValueAtTime(5.5, startTime);
      vibratoGain.gain.setValueAtTime(freq * 0.012, startTime);
      vibratoLFO.connect(vibratoGain);
      vibratoGain.connect(osc1.frequency);
      vibratoGain.connect(osc2.frequency);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, startTime);
      filter.frequency.linearRampToValueAtTime(2200, startTime + duration * 0.4);
      filter.frequency.linearRampToValueAtTime(1400, startTime + duration);
      filter.Q.value = 1.2;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + duration * 0.18);
      gain.gain.setValueAtTime(peakGain, startTime + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      vibratoLFO.start(startTime);
      osc1.start(startTime);
      osc2.start(startTime);
      vibratoLFO.stop(startTime + duration + 0.05);
      osc1.stop(startTime + duration + 0.05);
      osc2.stop(startTime + duration + 0.05);
    };

    const phrase = [
      { f: 392.0, t: 0.0, d: 0.14, g: 0.22 },
      { f: 440.0, t: 0.12, d: 0.14, g: 0.22 },
      { f: 523.25, t: 0.24, d: 0.16, g: 0.24 },
      { f: 440.0, t: 0.4, d: 0.13, g: 0.2 },
      { f: 587.33, t: 0.53, d: 0.16, g: 0.24 },
      { f: 659.25, t: 0.69, d: 0.16, g: 0.25 },
      { f: 783.99, t: 0.85, d: 0.3, g: 0.27 },
      { f: 698.46, t: 1.14, d: 0.14, g: 0.22 },
      { f: 880.0, t: 1.28, d: 0.16, g: 0.25 },
      { f: 987.77, t: 1.44, d: 0.16, g: 0.26 },
      { f: 1174.66, t: 1.6, d: 0.55, g: 0.3 },
    ];
    phrase.forEach((n) => playSaxNote(n.f, now + n.t, n.d, n.g));

    const chordStart = now + 2.05;
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => {
      playSaxNote(f, chordStart, 0.85, 0.22);
    });
  } catch (e) {
    // ignore
  }
}

// ---------- Connexion WebSocket ----------
const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host);
let state = { title: "Bingo de Yolande", drawn: [], claims: [], generation: 0 };
let firstStateReceived = false;
let prevLastBall = null;
let prevGeneration = 0;
const seenValidated = new Set();
let celebrationFirstRun = true;

function send(obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "state") {
    const prevDrawnLen = state.drawn.length;
    state = msg.state;
    onStateUpdate(prevDrawnLen);
  }
});

// ---------- Navigation entre écrans ----------
const screens = {
  choose: document.getElementById("choose-screen"),
  code: document.getElementById("code-screen"),
  name: document.getElementById("name-screen"),
  public: document.getElementById("public-screen"),
  controller: document.getElementById("controller-screen"),
};
function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

let deviceId = "dev_" + Math.random().toString(36).slice(2) + Date.now();
let playerName = null;
let myClaimStatus = null;

const params = new URLSearchParams(location.search);
if (params.get("view") === "public") {
  showScreen("name");
} else {
  showScreen("choose");
}

document.getElementById("btn-show-code").addEventListener("click", () => showScreen("code"));
document.getElementById("btn-go-public").addEventListener("click", () => showScreen("name"));
document.getElementById("btn-code-back").addEventListener("click", () => showScreen("choose"));

document.getElementById("btn-unlock").addEventListener("click", tryUnlock);
document.getElementById("code-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});
function tryUnlock() {
  const val = document.getElementById("code-input").value.trim();
  if (val === ACCESS_CODE) {
    document.getElementById("code-error").style.display = "none";
    document.getElementById("code-input").value = "";
    showScreen("controller");
    renderControllerTitle();
  } else {
    document.getElementById("code-error").style.display = "block";
    document.getElementById("code-input").value = "";
  }
}

document.getElementById("btn-confirm-name").addEventListener("click", confirmName);
document.getElementById("name-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmName();
});
document.getElementById("name-input").addEventListener("input", (e) => {
  document.getElementById("btn-confirm-name").disabled = !e.target.value.trim();
});
function confirmName() {
  const val = document.getElementById("name-input").value.trim();
  if (!val) return;
  playerName = val;
  document.getElementById("public-player-name").textContent = playerName;
  showScreen("public");
  renderPublic();
}

document.getElementById("public-back-btn").addEventListener("click", () => showScreen("choose"));
document.getElementById("controller-back-btn").addEventListener("click", () => showScreen("choose"));

document.getElementById("btn-send-bingo").addEventListener("click", () => {
  if (!playerName || myClaimStatus) return;
  send({ type: "send_bingo", name: playerName, deviceId });
  myClaimStatus = "pending";
  renderPublicBingoZone();
});

document.getElementById("title-input").addEventListener("change", (e) => {
  send({ type: "set_title", title: e.target.value, code: ACCESS_CODE });
});

document.getElementById("btn-undo").addEventListener("click", () => {
  send({ type: "undo_last", code: ACCESS_CODE });
});
document.getElementById("btn-reset").addEventListener("click", () => {
  send({ type: "reset_game", code: ACCESS_CODE });
});

// ---------- Grilles ----------
function buildGrid(container, drawnSet, lastBall, clickable) {
  container.innerHTML = "";
  for (let row = 0; row < 15; row++) {
    LETTERS.forEach((l, colIdx) => {
      const min = colIdx * 15 + 1;
      const n = min + row;
      const isDrawn = drawnSet.has(n);
      const isLast = n === lastBall;
      const el = document.createElement(clickable ? "button" : "div");
      el.className = "cell" + (isDrawn ? " drawn" : "") + (isLast ? " last" : "") + (clickable ? " clickable" : "");
      el.textContent = n;
      if (clickable) {
        el.disabled = isDrawn;
        el.addEventListener("click", () => {
          send({ type: "select_number", number: n, code: ACCESS_CODE });
        });
      }
      container.appendChild(el);
    });
  }
}

// ---------- Rendu public ----------
function renderPublic() {
  if (!playerName) return;
  document.getElementById("public-title").textContent = state.title.toUpperCase();

  const drawnSet = new Set(state.drawn);
  const lastBall = state.drawn.length ? state.drawn[state.drawn.length - 1] : null;

  const empty = document.getElementById("public-empty");
  const ballWrap = document.getElementById("public-ball-wrap");
  if (state.drawn.length === 0) {
    empty.classList.remove("hidden");
    ballWrap.classList.add("hidden");
  } else {
    empty.classList.add("hidden");
    ballWrap.classList.remove("hidden");
    const ball = document.getElementById("public-ball");
    ball.classList.add("filled");
    document.getElementById("public-ball-letter").textContent = letterFor(lastBall);
    document.getElementById("public-ball-number").textContent = lastBall;
  }

  buildGrid(document.getElementById("public-grid"), drawnSet, lastBall, false);

  const count = state.drawn.length;
  document.getElementById("public-count").textContent =
    count + (count > 1 ? " numéros tirés" : " numéro tiré") + " sur 75";

  renderPublicBingoZone();
}

function renderPublicBingoZone() {
  const btn = document.getElementById("btn-send-bingo");
  const pendingCard = document.getElementById("status-pending");
  const validatedCard = document.getElementById("status-validated");
  const rejectedCard = document.getElementById("status-rejected");
  [btn, pendingCard, validatedCard, rejectedCard].forEach((el) => el.classList.add("hidden"));

  if (myClaimStatus === "validated") {
    validatedCard.textContent = `🎉 Bingo validé ! Bravo ${playerName} !`;
    validatedCard.classList.remove("hidden");
  } else if (myClaimStatus === "rejected") {
    rejectedCard.classList.remove("hidden");
  } else if (myClaimStatus === "pending") {
    pendingCard.classList.remove("hidden");
  } else if (state.drawn.length > 0) {
    btn.classList.remove("hidden");
  }
}

// ---------- Rendu animateur ----------
function renderControllerTitle() {
  document.getElementById("title-input").value = state.title;
}

function renderController() {
  if (screens.controller.classList.contains("hidden")) return;
  renderControllerTitle();

  const drawnSet = new Set(state.drawn);
  const lastBall = state.drawn.length ? state.drawn[state.drawn.length - 1] : null;

  const ball = document.getElementById("controller-ball");
  const placeholder = document.getElementById("controller-ball-placeholder");
  if (lastBall) {
    ball.classList.add("filled");
    placeholder.classList.add("hidden");
    document.getElementById("controller-ball-letter").textContent = letterFor(lastBall);
    document.getElementById("controller-ball-number").textContent = lastBall;
  } else {
    ball.classList.remove("filled");
    placeholder.classList.remove("hidden");
    document.getElementById("controller-ball-letter").textContent = "";
    document.getElementById("controller-ball-number").textContent = "";
  }

  const count = state.drawn.length;
  const remaining = 75 - count;
  document.getElementById("controller-count").textContent =
    count + (count > 1 ? " sortis" : " sorti") + " · " + remaining + (remaining > 1 ? " restants" : " restant");

  buildGrid(document.getElementById("controller-grid"), drawnSet, lastBall, true);

  renderClaimZone();
}

function renderClaimZone() {
  const zone = document.getElementById("claim-zone");
  const pending = state.claims.filter((c) => c.status === "pending");
  const current = pending[0];
  const queueRest = pending.length - 1;

  if (!current) {
    zone.innerHTML = "";
    return;
  }

  zone.innerHTML = `
    <div class="claim-card" style="margin-bottom:20px;">
      <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--gold); opacity:0.8; margin-bottom:8px; text-align:center;">
        📣 Annonce BINGO à vérifier
      </div>
      <div style="font-family:'Archivo Black', sans-serif; font-size:22px; text-align:center; margin-bottom:4px;">
        ${escapeHtml(current.name)}
      </div>
      <div style="font-size:12px; opacity:0.55; text-align:center; margin-bottom:14px;">
        Annoncé après ${current.drawCount} numéro${current.drawCount > 1 ? "s" : ""} sorti${current.drawCount > 1 ? "s" : ""}
        ${current.atDraw ? " · dernier numéro : " + current.atDraw : ""}
      </div>
      <div style="display:flex; gap:10px;">
        <button id="btn-validate-claim" style="flex:1; background:var(--gold); color:var(--ink); border:none; border-radius:10px; padding:12px 0; font-size:14px; font-weight:700;">✓ Valider</button>
        <button id="btn-reject-claim" style="flex:1; background:rgba(247,239,224,0.08); color:var(--cream); border:1px solid rgba(247,239,224,0.25); border-radius:10px; padding:12px 0; font-size:14px;">✕ Rejeter</button>
      </div>
      ${queueRest > 0 ? `<div style="font-size:11px; opacity:0.5; text-align:center; margin-top:10px;">+ ${queueRest} autre${queueRest > 1 ? "s" : ""} annonce${queueRest > 1 ? "s" : ""} en attente</div>` : ""}
    </div>
  `;

  document.getElementById("btn-validate-claim").addEventListener("click", () => {
    send({ type: "resolve_claim", claimId: current.id, status: "validated", code: ACCESS_CODE });
  });
  document.getElementById("btn-reject-claim").addEventListener("click", () => {
    send({ type: "resolve_claim", claimId: current.id, status: "rejected", code: ACCESS_CODE });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Réaction aux mises à jour d'état ----------
function onStateUpdate(prevDrawnLen) {
  // Réinitialiser le droit de réclamer si une nouvelle partie a commencé
  if (state.generation !== prevGeneration) {
    prevGeneration = state.generation;
    myClaimStatus = null;
  }

  // Suivre le statut de MA réclamation
  if (deviceId) {
    const mine = state.claims.find((c) => c.deviceId === deviceId && c.generation === state.generation);
    if (mine) myClaimStatus = mine.status;
  }

  const lastBall = state.drawn.length ? state.drawn[state.drawn.length - 1] : null;

  // Son de trompette à chaque nouveau numéro (sauf au tout premier chargement)
  if (firstStateReceived && lastBall !== prevLastBall && lastBall !== null) {
    playTrumpetCall();
  }
  prevLastBall = lastBall;

  // Détection des annonces nouvellement validées → célébration collective
  if (celebrationFirstRun) {
    state.claims.forEach((c) => {
      if (c.status === "validated") seenValidated.add(c.id);
    });
    celebrationFirstRun = false;
  } else {
    state.claims.forEach((c) => {
      if (c.status === "validated" && !seenValidated.has(c.id)) {
        seenValidated.add(c.id);
        triggerCelebration(c.name);
      }
    });
  }

  firstStateReceived = true;

  if (!screens.public.classList.contains("hidden")) renderPublic();
  if (!screens.controller.classList.contains("hidden")) renderController();

  // Le titre par défaut du champ de nom (avant que le joueur n'ait choisi son prénom)
  document.getElementById("name-screen-title").textContent = state.title.toUpperCase();
}

function triggerCelebration(name) {
  playBingoSaxJingle();
  const overlay = document.getElementById("celebration-overlay");
  document.getElementById("celebration-name").textContent = `🎉 Bravo ${name} ! 🎉`;
  spawnConfetti(overlay);
  overlay.classList.remove("hidden");
  setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.querySelectorAll(".confetti").forEach((el) => el.remove());
  }, 6000);
}

function spawnConfetti(overlay) {
  const colors = ["#FFC857", "#FF4D6D", "#F7EFE0", "#7CD6C8"];
  for (let i = 0; i < 24; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    const left = Math.random() * 100;
    const delay = Math.random() * 1.2;
    const dur = 2.4 + Math.random() * 1.6;
    const size = 8 + Math.random() * 8;
    const color = colors[i % colors.length];
    el.style.left = left + "%";
    el.style.width = size + "px";
    el.style.height = size * 1.6 + "px";
    el.style.background = color;
    el.style.animation = `confettiFall ${dur}s linear ${delay}s forwards`;
    overlay.appendChild(el);
  }
}

// ---------- QR code (panneau animateur) ----------
function setupQrCode() {
  const url = new URL(window.location.href);
  url.searchParams.set("view", "public");
  const shareUrl = url.toString();

  const canvas = document.getElementById("qr-canvas");
  canvas.innerHTML = "";
  // eslint-disable-next-line no-undef
  new QRCode(canvas, {
    text: shareUrl,
    width: 220,
    height: 220,
    colorDark: "#1B1430",
    colorLight: "#F7EFE0",
  });

  document.getElementById("btn-copy-link").addEventListener("click", () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      const btn = document.getElementById("btn-copy-link");
      const original = btn.textContent;
      btn.textContent = "Lien copié ✓";
      setTimeout(() => (btn.textContent = original), 1500);
    });
  });

  document.getElementById("btn-toggle-qr").addEventListener("click", () => {
    const box = document.getElementById("qr-box");
    const btn = document.getElementById("btn-toggle-qr");
    const hidden = box.classList.toggle("hidden");
    btn.textContent = hidden ? "Afficher le QR code" : "Masquer le QR code";
  });
}
setupQrCode();
