// Serveur du Bingo de Yolande
// - Sert la page web (animateur + public, dans le même fichier HTML)
// - Garde l'état de la partie en mémoire et le sauvegarde sur disque
// - Diffuse chaque changement en temps réel à tous les écrans connectés via WebSocket

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, "state.json");
const ACCESS_CODE = process.env.BINGO_ACCESS_CODE || "yolandemorue";

// ---------- État de la partie ----------
function defaultState() {
  return {
    title: "Bingo de Yolande",
    drawn: [], // numéros déjà sortis, dans l'ordre
    claims: [], // annonces "BINGO !" : { id, name, drawCount, atDraw, status, timestamp }
    generation: 0, // incrémenté à chaque réinitialisation, pour réactiver les boutons publics
  };
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultState();
  }
}

function saveState(state) {
  fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), (err) => {
    if (err) console.error("Erreur de sauvegarde de l'état :", err);
  });
}

let state = loadState();

// ---------- Serveur HTTP ----------
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast() {
  const payload = JSON.stringify({ type: "state", state });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

wss.on("connection", (ws) => {
  // Envoie l'état actuel dès la connexion
  ws.send(JSON.stringify({ type: "state", state }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (msg.type) {
      case "select_number": {
        if (msg.code !== ACCESS_CODE) return;
        const n = Number(msg.number);
        if (!Number.isInteger(n) || n < 1 || n > 75) return;
        if (state.drawn.includes(n)) return;
        state.drawn.push(n);
        saveState(state);
        broadcast();
        break;
      }
      case "undo_last": {
        if (msg.code !== ACCESS_CODE) return;
        state.drawn.pop();
        saveState(state);
        broadcast();
        break;
      }
      case "reset_game": {
        if (msg.code !== ACCESS_CODE) return;
        state.drawn = [];
        state.claims = [];
        state.generation += 1;
        saveState(state);
        broadcast();
        break;
      }
      case "set_title": {
        if (msg.code !== ACCESS_CODE) return;
        if (typeof msg.title === "string" && msg.title.trim()) {
          state.title = msg.title.trim().slice(0, 60);
          saveState(state);
          broadcast();
        }
        break;
      }
      case "send_bingo": {
        const name = String(msg.name || "").trim().slice(0, 24);
        const deviceId = String(msg.deviceId || "");
        if (!name || !deviceId) return;
        // Empêche un même appareil d'envoyer plusieurs annonces actives pour la génération en cours
        const alreadyClaimed = state.claims.some(
          (c) => c.deviceId === deviceId && c.generation === state.generation
        );
        if (alreadyClaimed) return;
        state.claims.push({
          id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          deviceId,
          name,
          drawCount: state.drawn.length,
          atDraw: state.drawn.length ? state.drawn[state.drawn.length - 1] : null,
          status: "pending",
          generation: state.generation,
          timestamp: Date.now(),
        });
        saveState(state);
        broadcast();
        break;
      }
      case "resolve_claim": {
        if (msg.code !== ACCESS_CODE) return;
        const claim = state.claims.find((c) => c.id === msg.claimId);
        if (!claim) return;
        claim.status = msg.status === "validated" ? "validated" : "rejected";
        saveState(state);
        broadcast();
        break;
      }
      default:
        break;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Bingo de Yolande lancé sur http://localhost:${PORT}`);
  console.log(`Panneau animateur : http://localhost:${PORT}/?view=controller`);
  console.log(`Écran public      : http://localhost:${PORT}/?view=public`);
});
