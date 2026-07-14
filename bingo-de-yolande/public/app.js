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

// Son joué à chaque numéro annoncé : fichier audio fourni (public/sounds/numero.mp3)
function playTrumpetCall() {
  try {
    // Un nouvel objet Audio à chaque appel permet de superposer le son
    // si l'animateur clique vite sur plusieurs numéros d'affilée.
    const audio = new Audio("sounds/numero.mp3");
    audio.play().catch((err) => {
      console.warn(
        "Son non joué (sounds/numero.mp3) — soit le fichier est introuvable à cet emplacement, soit aucune interaction tactile n'a encore eu lieu sur la page :",
        err
      );
    });
  } catch (e) {
    console.warn("Erreur lors de la lecture du son sounds/numero.mp3 :", e);
  }
}

// Son joué sur tous les écrans publics quand un BINGO est validé (fichier fourni : sounds/victoire.mp3)
function playBingoSaxJingle() {
  try {
    const audio = new Audio("sounds/victoire.mp3");
    audio.play().catch((err) => {
      console.warn(
        "Son de victoire non joué (sounds/victoire.mp3) — fichier introuvable ou aucune interaction tactile encore eue sur la page :",
        err
      );
    });
  } catch (e) {
    console.warn("Erreur lors de la lecture du son sounds/victoire.mp3 :", e);
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
  // Mémoriser la vue active pour la restaurer au rechargement
  // (on ne mémorise pas les écrans transitoires comme "choose", "code", "name")
  if (name === "public" || name === "controller") {
    sessionStorage.setItem("bingo_screen", name);
  } else if (name === "choose") {
    sessionStorage.removeItem("bingo_screen");
    sessionStorage.removeItem("bingo_player_name");
  }
}

let deviceId = sessionStorage.getItem("bingo_device_id");
if (!deviceId) {
  deviceId = "dev_" + Math.random().toString(36).slice(2) + Date.now();
  sessionStorage.setItem("bingo_device_id", deviceId);
}
let playerName = null;
let myClaimStatus = null;

// Restauration au rechargement
const savedScreen = sessionStorage.getItem("bingo_screen");
const savedName = sessionStorage.getItem("bingo_player_name");
const params = new URLSearchParams(location.search);

if (savedScreen === "controller") {
  // L'animateur était connecté : on restaure directement le panneau animateur
  showScreen("controller");
} else if (savedScreen === "public" && savedName) {
  // Le joueur avait choisi son prénom : on restaure directement la vue publique
  playerName = savedName;
  document.getElementById("public-player-name").textContent = playerName;
  showScreen("public");
} else if (params.get("view") === "public") {
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
  const val = document.getElementById("code-input").value.trim().toLowerCase();
  if (val === ACCESS_CODE.toLowerCase()) {
    document.getElementById("code-error").style.display = "none";
    document.getElementById("code-input").value = "";
    showScreen("controller");
    renderController();
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
  sessionStorage.setItem("bingo_player_name", playerName);
  document.getElementById("public-player-name").textContent = playerName;
  showScreen("public");
  renderPublic();
}

document.getElementById("public-back-btn").addEventListener("click", () => showScreen("choose"));
document.getElementById("controller-back-btn").addEventListener("click", () => showScreen("choose"));

document.getElementById("btn-send-bingo").addEventListener("click", () => {
  const someoneElsePending = state.claims.some(
    (c) => c.status === "pending" && c.deviceId !== deviceId && c.generation === state.generation
  );
  if (!playerName || myClaimStatus || someoneElsePending) return;
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
      const photo = isDrawn ? casePhotoFor(n) : null;

      const el = document.createElement(clickable ? "button" : "div");
      el.className = "cell" + (isDrawn ? " drawn" : "") + (isLast ? " last" : "") + (clickable ? " clickable" : "");

      if (photo) {
        // Case tirée avec photo : image en fond + numéro en petit par-dessus
        el.style.backgroundImage = `url('${photo}')`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        el.style.position = "relative";
        el.style.overflow = "hidden";
        // Voile coloré semi-transparent par-dessus la photo
        el.style.backgroundColor = isLast
          ? "rgba(255,77,109,0.45)"
          : "rgba(27,20,48,0.35)";
        // Numéro en petit en bas de la case
        const label = document.createElement("span");
        label.textContent = n;
        label.style.cssText = `
          position: absolute;
          bottom: 1px;
          right: 3px;
          font-size: 9px;
          font-weight: 700;
          color: white;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          line-height: 1;
        `;
        el.appendChild(label);
      } else {
        el.textContent = n;
      }

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

  // Bannière persistante : reste affichée tant que la partie en cours a un ou plusieurs gagnants
  const winners = state.claims.filter(
    (c) => c.status === "validated" && c.generation === state.generation
  );
  const banner = document.getElementById("winner-banner");
  if (winners.length > 0) {
    const names = winners.map((w) => w.name).join(", ");
    banner.textContent = `🎉 Bravo ${names}, tu as gagné !`;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
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

  // Y a-t-il une annonce pending de quelqu'un d'autre ?
  const someoneElsePending = state.claims.some(
    (c) => c.status === "pending" && c.deviceId !== deviceId && c.generation === state.generation
  );

  if (myClaimStatus === "validated") {
    validatedCard.textContent = `🎉 Bingo validé ! Bravo ${playerName}, tu as gagné !`;
    validatedCard.classList.remove("hidden");
  } else if (myClaimStatus === "rejected") {
    rejectedCard.classList.remove("hidden");
  } else if (myClaimStatus === "pending") {
    pendingCard.classList.remove("hidden");
  } else if (someoneElsePending) {
    // Quelqu'un d'autre est en cours de vérification — on bloque le bouton
    pendingCard.textContent = "⏳ Vérification en cours… Attendez la décision de l'animateur.";
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

// ---------- Photos de célébration (détection automatique des fichiers présents) ----------
// On essaie une liste de noms possibles ; ceux qui n'existent pas sont simplement ignorés.
const CELEBRATION_PHOTO_CANDIDATES = Array.from(
  { length: 10 },
  (_, i) => `images/celebration-${i + 1}.jpg`
);
let availableCelebrationPhotos = [];
(function detectCelebrationPhotos() {
  let remaining = CELEBRATION_PHOTO_CANDIDATES.length;
  CELEBRATION_PHOTO_CANDIDATES.forEach((src) => {
    const img = new Image();
    img.onload = () => {
      availableCelebrationPhotos.push(src);
      remaining--;
    };
    img.onerror = () => {
      remaining--;
    };
    img.src = src;
  });
})();

// Photos de cases : images/cases/case-1.jpg à case-20.jpg
// Chaque numéro reçoit toujours la même photo (déterministe : numéro % nbPhotos)
const CASE_PHOTO_CANDIDATES = Array.from(
  { length: 20 },
  (_, i) => `images/cases/case-${i + 1}.jpg`
);
let availableCasePhotos = [];
(function detectCasePhotos() {
  CASE_PHOTO_CANDIDATES.forEach((src) => {
    const img = new Image();
    img.onload = () => availableCasePhotos.push(src);
    img.onerror = () => {};
    img.src = src;
  });
})();

// Retourne la photo à afficher pour un numéro donné (stable, pas aléatoire)
function casePhotoFor(n) {
  if (availableCasePhotos.length === 0) return null;
  return availableCasePhotos[n % availableCasePhotos.length];
}

function triggerCelebration(name) {
  playBingoSaxJingle();
  const overlay = document.getElementById("celebration-overlay");
  const photo = document.getElementById("celebration-photo");
  if (availableCelebrationPhotos.length > 0) {
    const pick =
      availableCelebrationPhotos[Math.floor(Math.random() * availableCelebrationPhotos.length)];
    photo.src = pick;
    photo.classList.remove("hidden");
  } else {
    photo.classList.add("hidden");
  }
  document.getElementById("celebration-name").textContent = `🎉 Bravo ${name}, tu as gagné ! 🎉`;
  spawnConfetti(overlay);
  overlay.classList.remove("hidden");
  setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.querySelectorAll(".confetti").forEach((el) => el.remove());
  }, 18500);
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
