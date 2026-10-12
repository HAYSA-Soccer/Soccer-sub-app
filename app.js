// ===============================
// BASIC DATA MODEL
// ===============================

const STORAGE_KEY_TEAMS = "soccer_sub_teams_v5";

let teams = [];
let currentTeamId = null;

let gameClockSeconds = 0;
let clockInterval = null;
let currentHalf = 1; // 1 or 2
const HALF_DURATION_SECONDS = 25 * 60; // tweak as needed

let editingPlayerId = null;
let selectedPlayerId = null;
let onDeckPlayerId = null; // single auto on-deck

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

// Attack/Defense inputs
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

// Normalize position names so aliases still match formation slots
function normalizePositionName(name) {
  if (!name) return "";
  const trimmed = name.trim();

  const map = {
    "Left Striker": ["Left Striker", "Striker", "ST", "Forward", "LS"],
    "Right Striker": ["Right Striker", "Striker", "ST", "Forward", "RS"],
    "LW": ["LW", "Left Wing", "Left Winger"],
    "RW": ["RW", "Right Wing", "Right Winger"],
    "CM": ["CM", "Mid", "Center Mid", "Central Mid"],
    "Mid": ["Mid", "CM", "Center Mid", "Central Mid"],
    "Left Back": ["Left Back", "LB", "Left Defender"],
    "Right Back": ["Right Back", "RB", "Right Defender"],
    "Center Back": ["Center Back", "CB", "Center Defender"],
    "Keep": ["Keep", "GK", "Goalie", "Goalkeeper"],
    "ST1": ["ST1", "Striker 1", "ST"],
    "ST2": ["ST2", "Striker 2", "ST"],
    "CAM": ["CAM", "Attacking Mid", "10"],
    "Left Center Defensive Mid": ["Left Center Defensive Mid", "LCDM", "CDM"],
    "Right Center Defensive Mid": ["Right Center Defensive Mid", "RCDM", "CDM"]
  };

  for (const slot in map) {
    if (map[slot].includes(trimmed)) return slot;
  }

  return trimmed;
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

        if (typeof p.attackRating !== "number") p.attackRating = 0.5;
        if (typeof p.defenseRating !== "number") p.defenseRating = 0.5;

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
  team.formation = formationInputEl.value.replace(/[: ]+/g, "-");
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

// clamp attack/defense to realistic ranges
function clampRatings() {
  if (!playerAttackInputEl || !playerDefenseInputEl) return;

  let atk = parseFloat(playerAttackInputEl.value) || 0;
  let def = parseFloat(playerDefenseInputEl.value) || 0;

  atk = Math.max(0, Math.min(1, atk));
  def = Math.max(0, Math.min(1, def));

  const total = atk + def;
  const MAX_TOTAL = 1.2;

  if (total > MAX_TOTAL) {
    const scale = MAX_TOTAL / total;
    atk = atk * scale;
    def = def * scale;
  }

  playerAttackInputEl.value = atk.toFixed(2);
  playerDefenseInputEl.value = def.toFixed(2);
}

if (playerAttackInputEl) {
  playerAttackInputEl.addEventListener("input", clampRatings);
}
if (playerDefenseInputEl) {
  playerDefenseInputEl.addEventListener("input", clampRatings);
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

  clampRatings();

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
// CLOCK (WITH HALVES)
// ===============================

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateClockDisplay() {
  gameClockEl.textContent = `H${currentHalf} ${formatClock(gameClockSeconds)}`;
}

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

function tickClock() {
  const team = getCurrentTeam();
  if (!team) return;

  gameClockSeconds += 1;

  if (gameClockSeconds >= HALF_DURATION_SECONDS) {
    clearInterval(clockInterval);
    clockInterval = null;

    if (currentHalf === 1) {
      currentHalf = 2;
      gameClockSeconds = 0;
      updateClockDisplay();
      alert("Second Half Starting");
    } else {
      alert("Match Finished");
    }
  } else {
    updateClockDisplay();
  }

  updatePlayerMinutes();
  renderBench();
  renderField();
  renderSuggestions();
}

startClockBtn.addEventListener("click", () => {
  if (clockInterval) return;
  clockInterval = setInterval(tickClock, 1000);
});

pauseClockBtn.addEventListener("click", () => {
  if (!clockInterval) return;
  clearInterval(clockInterval);
  clockInterval = null;
});

resetClockBtn.addEventListener("click", () => {
  gameClockSeconds = 0;
  currentHalf = 1;
  updateClockDisplay();
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  const team = getCurrentTeam();
  if (team) {
    team.players.forEach(p => {
      p.minutesField = 0;
      p.minutesBench = 0;
    });
    saveTeams();
    renderBench();
    renderField();
    renderSuggestions();
  }
});

// ===============================
// FIELD + FORMATIONS
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

// ===============================
// SUBSTITUTION / SUGGESTION ENGINE
// ===============================

function scoreFitForSlot(player, slotId) {
  const weights = POSITION_WEIGHTS[slotId];
  if (!weights) return -1;

  const allPositions = [
    ...(player.positions.primary || []),
    ...(player.positions.secondary || []),
    ...(player.positions.tertiary || [])
  ];

  const normalizedPositions = allPositions.map(normalizePositionName);
  const normalizedSlot = normalizePositionName(slotId);

  if (!normalizedPositions.includes(normalizedSlot)) {
    return -999; // not trained for this position
  }

  if (normalizedSlot === "Keep") {
    const isGK = normalizedPositions.includes("Keep");
    if (!isGK) return -999;
  }

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
  return assigned[0];
}

function getNextSuggestedSub() {
  const team = getCurrentTeam();
  if (!team) return null;

  const benchPlayers = team.players.filter(p => !p.onField);
  if (!benchPlayers.length) return null;

  const slots = FORMATION_SLOTS[team.formation] || FORMATION_SLOTS["7v7-2-3-1"];

  // empty slot first
  const emptySlots = slots.filter(slot => {
    return !team.players.some(p => p.onField && p.assignedPos === slot.id);
  });

  if (emptySlots.length > 0) {
    const slotId = emptySlots[0].id;

    const ranked = benchPlayers
      .map(p => ({
        player: p,
        score: scoreFitForSlot(p, slotId)
      }))
      .filter(r => r.score > -900)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) return null;

    return {
      benchPlayerId: best.player.id,
      fieldPlayerId: null,
      slotId,
      score: best.score,
      type: "fill"
    };
  }

  const next = getNextPositionNeedingSub();
  if (!next) return null;

  const fieldPlayer = next.player;
  const slotId = next.slotId;
  const fieldScore = scoreFitForSlot(fieldPlayer, slotId);

  const ranked = benchPlayers
    .map(p => ({
      player: p,
      score: scoreFitForSlot(p, slotId)
    }))
    .filter(r => r.score > -900)
    .sort((a, b) => b.score - a.score);

  const bestBench = ranked[0];
  if (!bestBench) return null;

  const fieldNeedsRest = fieldPlayer.minutesField > fieldPlayer.minutesBench;
  const benchIsBetter = bestBench.score > fieldScore;

  if (!fieldNeedsRest && !benchIsBetter) return null;

  return {
    benchPlayerId: bestBench.player.id,
    fieldPlayerId: fieldPlayer.id,
    slotId,
    score: bestBench.score,
    type: "swap"
  };
}

// ===============================
// FIELD RENDERING
// ===============================

function renderField() {
  const team = getCurrentTeam();
  if (!team) return;

  fieldEl.innerHTML = `
    <div class="penalty-box"></div>
    <div class="goal-box"></div>
    <div class="goal-line"></div>
    <div class="penalty-spot"></div>
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>
  `;

  team.players.forEach(p => {
    if (p.onField && !p.assignedPos) {
      p.onField = false;
    }
  });
  saveTeams();

  const slots = FORMATION_SLOTS[team.formation] || FORMATION_SLOTS["7v7-2-3-1"];

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

    const placePlayer = () => {
      if (!selectedPlayerId) return;
      const player = getPlayerById(selectedPlayerId);
      if (!player) return;

      player.onField = true;
      player.assignedPos = slot.id;

      saveTeams();

      selectedPlayerId = null;
      renderField();
      renderBench();
      renderSuggestions();
    };

    div.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      placePlayer();
    });

    div.addEventListener("click", (e) => {
      e.stopPropagation();
      placePlayer();
    });

    fieldEl.appendChild(div);
  });

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
        renderSuggestions();
      });

      token.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedPlayerId = player.id;
        renderField();
        renderBench();
        renderSuggestions();
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

    saveTeams();

    renderField();
    renderBench();
    renderSuggestions();
  }
}

function sortBenchPlayers(players) {
  const suggestion = getNextSuggestedSub();
  const suggestedId = suggestion ? suggestion.benchPlayerId : null;

  return players.slice().sort((a, b) => {
    if (a.id === suggestedId) return -1;
    if (b.id === suggestedId) return 1;

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
    selectedPlayerId = benchPlayerId;
    renderBench();
    renderField();
    return;
  }

  const selectedPlayer = getPlayerById(selectedPlayerId);

  if (selectedPlayer && selectedPlayer.onField) {
    selectedPlayer.onField = false;
    selectedPlayer.assignedPos = null;
    selectedPlayerId = null;

    saveTeams();

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

  const suggestion = getNextSuggestedSub();
  onDeckPlayerId = suggestion ? suggestion.benchPlayerId : null;

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

      <div class="minutes">
        ${Math.round(player.attackRating * 100)}/${Math.round(player.defenseRating * 100)} A/D
      </div>
    `;

    if (suggestion && suggestion.benchPlayerId === player.id) {
      const slotId = suggestion.slotId;
      const rec = document.createElement("div");
      rec.className = "recommended-sub";

      if (suggestion.type === "fill") {
        rec.textContent = `Next Sub: Fill ${slotId}`;
      } else {
        const target = getPlayerById(suggestion.fieldPlayerId);
        rec.textContent = `Next Sub: Replace ${target.name} at ${slotId}`;
      }

      token.appendChild(rec);
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
// SUGGESTIONS (position-aware + alias-aware)
// ===============================

function renderSuggestions() {
  const team = getCurrentTeam();
  if (!team) return;

  suggestionListEl.innerHTML = "";

  const suggestion = getNextSuggestedSub();
  if (!suggestion) return;

  const benchPlayer = getPlayerById(suggestion.benchPlayerId);
  const slotId = suggestion.slotId;

  if (suggestion.type === "fill") {
    const li = document.createElement("li");
    li.textContent = `Fill ${slotId}: #${benchPlayer.number} ${benchPlayer.name}`;
    suggestionListEl.appendChild(li);
    return;
  }

  const fieldPlayer = getPlayerById(suggestion.fieldPlayerId);
  const li = document.createElement("li");
  li.textContent = `Swap at ${slotId}: #${benchPlayer.number} ${benchPlayer.name} for #${fieldPlayer.number} ${fieldPlayer.name}`;
  suggestionListEl.appendChild(li);
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
