// ===============================
// BASIC DATA MODEL
// ===============================

const STORAGE_KEY_TEAMS = "soccer_sub_teams_v5";

let teams = [];
let currentTeamId = null;
let gameClockSeconds = 0;
let clockInterval = null;

let editingPlayerId = null;
let selectedPlayerId = null;
let onDeckPlayerId = null; // ⭐ ON-DECK tracking

// ===============================
// DOM ELEMENTS
// ===============================

// Screens
const gameScreen = document.getElementById("gameScreen");
const teamManagerScreen = document.getElementById("teamManagerScreen");
const playerEditorScreen = document.getElementById("playerEditorScreen");

// Navigation
const openTeamManagerBtn = document.getElementById("openTeamManager");
const backToGameBtn = document.getElementById("backToGame");
const backToTeamManagerBtn = document.getElementById("backToTeamManager");

// Team selector
const teamSelectEl = document.getElementById("teamSelect");

// Game screen
const gameClockEl = document.getElementById("gameClock");
const startClockBtn = document.getElementById("startClockBtn");
const pauseClockBtn = document.getElementById("pauseClockBtn");
const resetClockBtn = document.getElementById("resetClockBtn");
const fieldEl = document.getElementById("field");
const benchEl = document.getElementById("bench");
const suggestionListEl = document.getElementById("suggestionList");

// Team Manager
const teamNameInputEl = document.getElementById("teamNameInput");
const formationInputEl = document.getElementById("formationInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const rosterListEl = document.getElementById("rosterList");
const saveTeamBtn = document.getElementById("saveTeamBtn");

// Player Editor
const playerEditorTitleEl = document.getElementById("playerEditorTitle");
const playerNameInputEl = document.getElementById("playerNameInput");
const playerNumberInputEl = document.getElementById("playerNumberInput");
const playerPrimaryInputEl = document.getElementById("playerPrimaryInput");
const playerSecondaryInputEl = document.getElementById("playerSecondaryInput");
const playerTertiaryInputEl = document.getElementById("playerTertiaryInput");
const playerTwoWayInputEl = document.getElementById("playerTwoWayInput");
const playerNotesInputEl = document.getElementById("playerNotesInput");
const savePlayerBtn = document.getElementById("savePlayerBtn");
const deletePlayerBtn = document.getElementById("deletePlayerBtn");

// ⭐ NEW: attack/defense inputs (assumed present in HTML)
const playerAttackInputEl = document.getElementById("playerAttackInput");
const playerDefenseInputEl = document.getElementById("playerDefenseInput");

// ===============================
// UTIL
// ===============================

function getPlayerById(id) {
  const team = getCurrentTeam();
  return team ? team.players.find(p => p.id === id) : null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getCurrentTeam() {
  return teams.find(t => t.id === currentTeamId);
}

// ===============================
// STORAGE (with migration)
// ===============================

function loadTeams() {
  const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
  if (raw) {
    teams = JSON.parse(raw);

    teams.forEach(team => {
      if (!Array.isArray(team.players)) return;
      team.players.forEach(p => {
        if (!p.positions || typeof p.positions !== "object") {
          p.positions = { primary: [], secondary: [], tertiary: [] };
        } else {
          p.positions.primary = Array.isArray(p.positions.primary) ? p.positions.primary : [];
          p.positions.secondary = Array.isArray(p.positions.secondary) ? p.positions.secondary : [];
          p.positions.tertiary = Array.isArray(p.positions.tertiary) ? p.positions.tertiary : [];
        }
        if (typeof p.onField !== "boolean") p.onField = false;
        if (!("assignedPos" in p)) p.assignedPos = null;
        if (typeof p.minutesField !== "number") p.minutesField = 0;
        if (typeof p.minutesBench !== "number") p.minutesBench = 0;

        // ⭐ NEW: attack/defense weighting
        if (typeof p.attackRating !== "number") p.attackRating = 0.5;
        if (typeof p.defenseRating !== "number") p.defenseRating = 0.5;

        // ⭐ NEW: target position for ON-DECK
        if (!("targetPosition" in p)) p.targetPosition = null;
      });
    });
  } else {
    teams = [
      {
        id: "default",
        name: "U12 Travel",
        formation: "7v7-2-3-1",
        players: []
      }
    ];
  }
  if (!currentTeamId && teams.length) currentTeamId = teams[0].id;
}

function saveTeams() {
  localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(teams));
}

// ===============================
// SCREEN NAVIGATION
// ===============================

function showGameScreen() {
  gameScreen.classList.remove("hidden");
  teamManagerScreen.classList.add("hidden");
  playerEditorScreen.classList.add("hidden");
}

function showTeamManagerScreen() {
  gameScreen.classList.add("hidden");
  teamManagerScreen.classList.remove("hidden");
  playerEditorScreen.classList.add("hidden");
  loadTeamIntoManager();
}

function showPlayerEditorScreen() {
  gameScreen.classList.add("hidden");
  teamManagerScreen.classList.add("hidden");
  playerEditorScreen.classList.remove("hidden");
}

// ===============================
// TEAM SELECT + MANAGER
// ===============================

function renderTeamSelect() {
  teamSelectEl.innerHTML = "";
  teams.forEach(team => {
    const opt = document.createElement("option");
    opt.value = team.id;
    opt.textContent = team.name;
    teamSelectEl.appendChild(opt);
  });
  teamSelectEl.value = currentTeamId;
}

teamSelectEl.addEventListener("change", () => {
  currentTeamId = teamSelectEl.value;
  renderField();
  renderBench();
  renderSuggestions();
});

function loadTeamIntoManager() {
  const team = getCurrentTeam();
  if (!team) return;
  teamNameInputEl.value = team.name;
  formationInputEl.value = team.formation;
  renderRosterList(team);
}

function renderRosterList(team) {
  rosterListEl.innerHTML = "";
  team.players
    .slice()
    .sort((a, b) => a.number - b.number)
    .forEach(player => {
      const li = document.createElement("li");
      li.dataset.playerId = player.id;

      const pos = player.positions || { primary: [] };
      const primary = Array.isArray(pos.primary) ? pos.primary.join(", ") : "";

      li.innerHTML = `
        <span>#${player.number} ${player.name}</span>
        <span class="role-tag">${primary}</span>
      `;
      li.addEventListener("click", () => {
        loadPlayerIntoEditor(player);
        showPlayerEditorScreen();
      });
      rosterListEl.appendChild(li);
    });
}

addPlayerBtn.addEventListener("click", () => {
  clearPlayerEditor();
  showPlayerEditorScreen();
});

saveTeamBtn.addEventListener("click", () => {
  const team = getCurrentTeam();
  if (!team) return;
  team.name = teamNameInputEl.value.trim() || team.name;
  team.formation = formationInputEl.value;
  saveTeams();
  renderTeamSelect();
  renderField();
  renderBench();
  renderSuggestions();
  showGameScreen();
});

// ===============================
// PLAYER EDITOR
// ===============================

function clearPlayerEditor() {
  editingPlayerId = null;
  playerEditorTitleEl.textContent = "New Player";
  playerNameInputEl.value = "";
  playerNumberInputEl.value = "";
  playerPrimaryInputEl.value = "";
  playerSecondaryInputEl.value = "";
  playerTertiaryInputEl.value = "";
  playerTwoWayInputEl.checked = false;
  playerNotesInputEl.value = "";

  if (playerAttackInputEl) playerAttackInputEl.value = "0.5";
  if (playerDefenseInputEl) playerDefenseInputEl.value = "0.5";
}

function loadPlayerIntoEditor(player) {
  editingPlayerId = player.id;
  playerEditorTitleEl.textContent = `Edit Player #${player.number}`;
  playerNameInputEl.value = player.name;
  playerNumberInputEl.value = player.number;

  const pos = player.positions || { primary: [], secondary: [], tertiary: [] };
  playerPrimaryInputEl.value = Array.isArray(pos.primary) ? pos.primary.join(",") : "";
  playerSecondaryInputEl.value = Array.isArray(pos.secondary) ? pos.secondary.join(",") : "";
  playerTertiaryInputEl.value = Array.isArray(pos.tertiary) ? pos.tertiary.join(",") : "";

  playerTwoWayInputEl.checked = !!player.twoWay;
  playerNotesInputEl.value = player.notes || "";

  if (playerAttackInputEl) playerAttackInputEl.value = player.attackRating ?? 0.5;
  if (playerDefenseInputEl) playerDefenseInputEl.value = player.defenseRating ?? 0.5;
}

savePlayerBtn.addEventListener("click", () => {
  const team = getCurrentTeam();
  if (!team) return;

  const name = playerNameInputEl.value.trim();
  const number = parseInt(playerNumberInputEl.value.trim(), 10);
  if (!name || isNaN(number)) return;

  const primary = playerPrimaryInputEl.value.split(",").map(s => s.trim()).filter(Boolean);
  const secondary = playerSecondaryInputEl.value.split(",").map(s => s.trim()).filter(Boolean);
  const tertiary = playerTertiaryInputEl.value.split(",").map(s => s.trim()).filter(Boolean);
  const twoWay = playerTwoWayInputEl.checked;
  const notes = playerNotesInputEl.value.trim();

  const attackRating = playerAttackInputEl
    ? Math.max(0, Math.min(1, parseFloat(playerAttackInputEl.value) || 0.5))
    : 0.5;
  const defenseRating = playerDefenseInputEl
    ? Math.max(0, Math.min(1, parseFloat(playerDefenseInputEl.value) || 0.5))
    : 0.5;

  if (editingPlayerId) {
    const player = team.players.find(p => p.id === editingPlayerId);
    if (!player) return;
    player.name = name;
    player.number = number;
    player.positions = { primary, secondary, tertiary };
    player.twoWay = twoWay;
    player.notes = notes;
    player.attackRating = attackRating;
    player.defenseRating = defenseRating;
  } else {
    team.players.push({
      id: generateId(),
      name,
      number,
      positions: { primary, secondary, tertiary },
      twoWay,
      notes,
      minutesField: 0,
      minutesBench: 0,
      onField: false,
      assignedPos: null,
      attackRating,
      defenseRating,
      targetPosition: null
    });
  }

  saveTeams();
  loadTeamIntoManager();
  renderField();
  renderBench();
  renderSuggestions();
  showTeamManagerScreen();
});

deletePlayerBtn.addEventListener("click", () => {
  if (!editingPlayerId) {
    showTeamManagerScreen();
    return;
  }
  const team = getCurrentTeam();
  if (!team) return;
  team.players = team.players.filter(p => p.id !== editingPlayerId);
  saveTeams();
  loadTeamIntoManager();
  renderField();
  renderBench();
  renderSuggestions();
  showTeamManagerScreen();
});

// ===============================
// CLOCK
// ===============================

function updatePlayerMinutes() {
  const team = getCurrentTeam();
  if (!team) return;

  team.players.forEach(player => {
    if (player.onField) {
      player.minutesField += 1;
    } else {
      player.minutesBench += 1;
    }
  });

  saveTeams();
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateClockDisplay() {
  gameClockEl.textContent = formatClock(gameClockSeconds);
}

startClockBtn.addEventListener("click", () => {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    gameClockSeconds += 1;
    updateClockDisplay();
    updatePlayerMinutes();
  }, 1000);
});

pauseClockBtn.addEventListener("click", () => {
  if (!clockInterval) return;
  clearInterval(clockInterval);
  clockInterval = null;
});

resetClockBtn.addEventListener("click", () => {
  gameClockSeconds = 0;
  updateClockDisplay();
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
});

// ===============================
// FIELD + BENCH RENDERING
// ===============================

const FORMATION_SLOTS = {
  "7v7-2-3-1": [
    { id: "Left Striker", x: 35, y: 45 }, { id: "Right Striker", x: 65, y: 45 },
    { id: "Left Back", x: 25, y: 70 }, { id: "Mid", x: 50, y: 60 }, { id: "Right Back", x: 75, y: 70 },
    { id: "Keep", x: 50, y: 90 }
  ],

  "9v9-3-3-2": [
    { id: "Left Striker", x: 35, y: 30 }, { id: "Right Striker", x: 65, y: 30 },
    { id: "LW", x: 20, y: 50 }, { id: "CM", x: 50, y: 50 }, { id: "RW", x: 80, y: 50 },
    { id: "Left Back", x: 20, y: 70 }, { id: "Center Back", x: 50, y: 75 }, { id: "Right Back", x: 80, y: 70 },
    { id: "Keep", x: 50, y: 90 }
  ],

  "11v11-3-2-3-2": [
    { id: "ST1", x: 35, y: 18 }, { id: "ST2", x: 65, y: 18 },
    { id: "LW", x: 20, y: 35 }, { id: "CAM", x: 50, y: 32 }, { id: "RW", x: 80, y: 35 },
    { id: "Left Center Defensive Mid", x: 35, y: 55 }, { id: "Right Center Defensive Mid", x: 65, y: 55 },
    { id: "Left Back", x: 20, y: 70 }, { id: "Center Back", x: 50, y: 75 }, { id: "Right Back", x: 80, y: 70 },
    { id: "Keep", x: 50, y: 92 }
  ]
};

// attack/defense weighting per slot
const POSITION_WEIGHTS = {
  "Left Striker": { attack: 0.9, defense: 0.1 },
  "Right Striker": { attack: 0.9, defense: 0.1 },
  "ST1": { attack: 0.9, defense: 0.1 },
  "ST2": { attack: 0.9, defense: 0.1 },
  "LW": { attack: 0.8, defense: 0.2 },
  "RW": { attack: 0.8, defense: 0.2 },
  "CAM": { attack: 0.7, defense: 0.3 },
  "Mid": { attack: 0.5, defense: 0.5 },
  "CM": { attack: 0.5, defense: 0.5 },
  "Left Center Defensive Mid": { attack: 0.4, defense: 0.6 },
  "Right Center Defensive Mid": { attack: 0.4, defense: 0.6 },
  "Left Back": { attack: 0.2, defense: 0.8 },
  "Center Back": { attack: 0.1, defense: 0.9 },
  "Right Back": { attack: 0.2, defense: 0.8 },
  "Keep": { attack: 0.0, defense: 1.0 }
};

function scoreFitForSlot(player, slotId) {
  const weights = POSITION_WEIGHTS[slotId];
  if (!weights) return -1;
  const atk = typeof player.attackRating === "number" ? player.attackRating : 0.5;
  const def = typeof player.defenseRating === "number" ? player.defenseRating : 0.5;
  return atk * weights.attack + def * weights.defense;
}

function getNextPositionNeedingSub() {
  const team = getCurrentTeam();
  if (!team) return null;

  const assigned = team.players
    .filter(p => p.onField && p.assignedPos)
    .map(p => ({ player: p, slotId: p.assignedPos }));

  if (!assigned.length) return null;

  assigned.sort((a, b) => b.player.minutesField - a.player.minutesField);
  return assigned[0]; // { player, slotId }
}

function determineOnDeckTarget(player) {
  const team = getCurrentTeam();
  if (!team) return;

  const slots = FORMATION_SLOTS[team.formation] || [];
  let bestSlot = null;
  let bestScore = -1;

  slots.forEach(slot => {
    const score = scoreFitForSlot(player, slot.id);
    if (score > bestScore) {
      bestScore = score;
      bestSlot = slot.id;
    }
  });

  player.targetPosition = bestSlot;
}

function renderField() {
  const team = getCurrentTeam();
  if (!team) return;
  fieldEl.innerHTML = "";

  const slots = FORMATION_SLOTS[team.formation] || FORMATION_SLOTS["7v7-2-3-1"];

  // DRAW POSITION SLOTS
  slots.forEach(slot => {
    const div = document.createElement("div");
    div.className = "position-slot";
    div.dataset.slotId = slot.id;
    div.style.left = `${slot.x}%`;
    div.style.top = `${slot.y}%`;
    div.textContent = slot.id;

    if (selectedPlayerId) {
      div.classList.add("highlight");
    }

    // MOBILE TAP
    div.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (!selectedPlayerId) return;
      const player = getPlayerById(selectedPlayerId);
      if (!player) return;

      player.onField = true;
      player.assignedPos = slot.id;

      selectedPlayerId = null;
      renderField();
      renderBench();
      renderSuggestions();
    });

    // DESKTOP CLICK
    div.addEventListener("click", (e) => {
      e.stopPropagation();

      if (!selectedPlayerId) return;
      const player = getPlayerById(selectedPlayerId);
      if (!player) return;

      player.onField = true;
      player.assignedPos = slot.id;

      selectedPlayerId = null;
      renderField();
      renderBench();
      renderSuggestions();
    });

    fieldEl.appendChild(div);
  });

  // DRAW PLAYERS ALREADY ON FIELD
  team.players
    .filter(p => p.onField && p.assignedPos)
    .forEach(player => {
      const slot = slots.find(s => s.id === player.assignedPos);
      if (!slot) return;

      const token = document.createElement("div");
      token.className = "player-token";
      token.style.left = `${slot.x}%`;
      token.style.top = `${slot.y}%`;
      token.innerHTML = `
        <div class="player-number">#${player.number}</div>
        <div class="player-name">${player.name}</div>
        <div class="minutes">
          <span class="bench-time ${player.onField ? "" : "active"}">B: ${player.minutesBench}</span>
          |
          <span class="field-time ${player.onField ? "active" : ""}">F: ${player.minutesField}</span>
        </div>
      `;

      token.addEventListener("touchstart", (e) => {
        e.stopPropagation();
        e.preventDefault();
        selectedPlayerId = player.id;
        renderField();
        renderBench();
      });

      token.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedPlayerId = player.id;
        renderField();
        renderBench();
      });

      fieldEl.appendChild(token);
    });
}

// ===============================
// BENCH LOGIC
// ===============================

function handleBenchDropZone() {
  const team = getCurrentTeam();
  if (!team) return;
  if (!selectedPlayerId) return;

  const player = getPlayerById(selectedPlayerId);
  if (!player) return;

  if (player.onField) {
    player.onField = false;
    player.assignedPos = null;
    selectedPlayerId = null;

    renderField();
    renderBench();
    renderSuggestions();
  }
}

function sortBenchPlayers(players) {
  return players.slice().sort((a, b) => {
    if (a.id === onDeckPlayerId) return -1;
    if (b.id === onDeckPlayerId) return 1;

    if (b.minutesBench !== a.minutesBench) {
      return b.minutesBench - a.minutesBench;
    }

    const next = getNextPositionNeedingSub();
    if (!next) return 0;

    const scoreA = scoreFitForSlot(a, next.slotId);
    const scoreB = scoreFitForSlot(b, next.slotId);

    return scoreB - scoreA;
  });
}

function handleBenchTap(benchPlayerId) {
  const team = getCurrentTeam();
  if (!team) return;

  if (!selectedPlayerId) {
    onDeckPlayerId = benchPlayerId;
    const p = getPlayerById(benchPlayerId);
    if (p) determineOnDeckTarget(p);
    renderBench();
    renderField();
    return;
  }

  const selectedPlayer = getPlayerById(selectedPlayerId);

  if (selectedPlayer && selectedPlayer.onField) {
    selectedPlayer.onField = false;
    selectedPlayer.assignedPos = null;
    selectedPlayerId = null;

    renderBench();
    renderField();
    renderSuggestions();
    return;
  }

  selectedPlayerId = benchPlayerId;
  renderBench();
  renderField();
}

function renderBench() {
  const team = getCurrentTeam();
  if (!team) return;
  benchEl.innerHTML = "";

  const benchPlayers = sortBenchPlayers(team.players.filter(p => !p.onField));

  benchPlayers.forEach(player => {
    const token = document.createElement("div");
    token.className = "player-token bench";

    if (player.id === onDeckPlayerId) {
      token.classList.add("on-deck");
    }

    token.innerHTML = `
      <div class="player-number">#${player.number}</div>
      <div class="player-name">${player.name}</div>
      <div class="minutes">
        <span class="bench-time ${player.onField ? "" : "active"}">B: ${player.minutesBench}</span>
        |
        <span class="field-time ${player.onField ? "active" : ""}">F: ${player.minutesField}</span>
      </div>
      <div class="minutes">${Math.round(player.attackRating * 100)}/${Math.round(player.defenseRating * 100)} A/D</div>
    `;

    if (player.id === onDeckPlayerId && player.targetPosition) {
      const target = document.createElement("div");
      target.className = "target";
      target.textContent = `On Deck for: ${player.targetPosition}`;
      token.appendChild(target);
    }

    if (selectedPlayerId === player.id) {
      token.classList.add("selected");
    }

    token.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleBenchTap(player.id);
    });

    token.addEventListener("click", (e) => {
      e.stopPropagation();
      handleBenchTap(player.id);
    });

    benchEl.appendChild(token);
  });
}

// ===============================
// SUGGESTIONS (minimal / optional)
// ===============================

function renderSuggestions() {
  suggestionListEl.innerHTML = "";
  // You can leave this empty since bench ordering + ON-DECK covers the logic.
}

// ===============================
// NAVIGATION BUTTONS
// ===============================

openTeamManagerBtn.addEventListener("click", () => {
  showTeamManagerScreen();
});

backToGameBtn.addEventListener("click", () => {
  showGameScreen();
});

backToTeamManagerBtn.addEventListener("click", () => {
  showTeamManagerScreen();
});

// ===============================
// INIT
// ===============================

function init() {
  loadTeams();
  renderTeamSelect();
  updateClockDisplay();
  renderField();
  renderBench();
  renderSuggestions();
  showGameScreen();

  if (benchEl && benchEl.parentElement) {
    benchEl.parentElement.addEventListener("touchstart", (e) => {
      if (e.target.classList.contains("player-token")) return;
      e.stopPropagation();
      e.preventDefault();
      handleBenchDropZone();
    });

    benchEl.parentElement.addEventListener("click", (e) => {
      if (e.target.classList.contains("player-token")) return;
      e.stopPropagation();
      handleBenchDropZone();
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
