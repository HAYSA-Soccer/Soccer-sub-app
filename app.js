// ===============================
// BASIC DATA MODEL
// ===============================

const STORAGE_KEY_TEAMS = "soccer_sub_teams_v5";

let teams = [];
let currentTeamId = null;
let gameClockSeconds = 0;
let clockInterval = null;

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

let editingPlayerId = null;let selectedPlayerId = null;

function selectPlayer(playerId) {
  selectedPlayerId = playerId;
  renderField();
  renderBench();
}


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

    // MIGRATE OLD PLAYER SHAPE SAFELY
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

  if (editingPlayerId) {
    const player = team.players.find(p => p.id === editingPlayerId);
    if (!player) return;
    player.name = name;
    player.number = number;
    player.positions = { primary, secondary, tertiary };
    player.twoWay = twoWay;
    player.notes = notes;
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
      assignedPos: null
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
    { id: "GK", x: 50, y: 90 },
    { id: "LB", x: 20, y: 65 },
    { id: "RB", x: 80, y: 65 },
    { id: "LCM", x: 35, y: 45 },
    { id: "RCM", x: 65, y: 45 },
    { id: "LW", x: 20, y: 25 },
    { id: "RW", x: 80, y: 25 }
  ],
  "9v9-3-3-2": [
    { id: "GK", x: 50, y: 90 },
    { id: "LB", x: 20, y: 70 },
    { id: "CB", x: 50, y: 70 },
    { id: "RB", x: 80, y: 70 },
    { id: "LCM", x: 35, y: 50 },
    { id: "RCM", x: 65, y: 50 },
    { id: "LW", x: 20, y: 30 },
    { id: "ST", x: 50, y: 25 },
    { id: "RW", x: 80, y: 30 }
  ],
  "11v11-4-3-3": [
    { id: "GK", x: 50, y: 90 },
    { id: "LB", x: 15, y: 70 },
    { id: "LCB", x: 35, y: 70 },
    { id: "RCB", x: 65, y: 70 },
    { id: "RB", x: 85, y: 70 },
    { id: "LCM", x: 35, y: 50 },
    { id: "CM", x: 50, y: 45 },
    { id: "RCM", x: 65, y: 50 },
    { id: "LW", x: 20, y: 25 },
    { id: "ST", x: 50, y: 20 },
    { id: "RW", x: 80, y: 25 }
  ]
};

function renderField() {
  const team = getCurrentTeam();
  if (!team) return;
  fieldEl.innerHTML = "";

  const slots = FORMATION_SLOTS[team.formation] || FORMATION_SLOTS["7v7-2-3-1"];

  // ============================
  // DRAW POSITION SLOTS
  // ============================
  slots.forEach(slot => {
    const div = document.createElement("div");
    div.className = "position-slot";
    div.dataset.slotId = slot.id;
    div.style.left = `${slot.x}%`;
    div.style.top = `${slot.y}%`;
    div.textContent = slot.id;

    // Highlight slot if a player is selected
    if (selectedPlayerId) {
      div.classList.add("highlight");
    }

    // --- MOBILE TAP ---
    div.addEventListener("touchstart", () => {
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

    // --- DESKTOP CLICK ---
    div.addEventListener("click", () => {
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

  // ============================
  // DRAW PLAYERS ALREADY ON FIELD
  // ============================
  team.players
    .filter(p => p.onField && p.assignedPos)
    .forEach(player => {
      const slot = slots.find(s => s.id === player.assignedPos);
      if (!slot) return;

      const token = document.createElement("div");
      token.className = "player-token";
      token.style.left = `${slot.x}%`;
      token.style.top = `${slot.y}%`;
      token.innerHTML = `<div>#${player.number}</div><div>${player.name}</div>`;

      // --- MOBILE TAP: select field player ---
      token.addEventListener("touchstart", () => {
        selectedPlayerId = player.id;
        renderField();
        renderBench();
      });

      // --- DESKTOP CLICK: select field player ---
      token.addEventListener("click", () => {
        selectedPlayerId = player.id;
        renderField();
        renderBench();
      });

      fieldEl.appendChild(token);
    });
}


function renderBench() {
  const team = getCurrentTeam();
  if (!team) return;
  benchEl.innerHTML = "";

  team.players
    .filter(p => !p.onField)
    .sort((a, b) => a.number - b.number)
    .forEach(player => {
      const token = document.createElement("div");
      token.className = "player-token bench";
      token.innerHTML = `<div>#${player.number}</div><div>${player.name}</div>`;

      // Highlight if selected
      if (selectedPlayerId === player.id) {
        token.classList.add("selected");
      }

      // --- MOBILE TAP ---
      token.addEventListener("touchstart", () => {
        handleBenchTap(player.id);
      });

      // --- DESKTOP CLICK ---
      token.addEventListener("click", () => {
        handleBenchTap(player.id);
      });

      benchEl.appendChild(token);
    });
}


// ===============================
// SUGGESTIONS (SIMPLE VERSION)
// ===============================

function renderSuggestions() {
  const team = getCurrentTeam();
  if (!team) return;
  suggestionListEl.innerHTML = "";

  const benchPlayers = team.players.filter(p => !p.onField);
  const fieldPlayers = team.players.filter(p => p.onField);

  if (!benchPlayers.length || !fieldPlayers.length) return;

  benchPlayers.slice(0, 3).forEach(bp => {
    const li = document.createElement("li");
    li.textContent = `Consider subbing in #${bp.number} ${bp.name}`;
    suggestionListEl.appendChild(li);
  });
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
}

init();
