// ====== DATA & STORAGE ======

const STORAGE_KEY_TEAMS = "soccer_sub_teams_v1";
const STORAGE_KEY_STATE_PREFIX = "soccer_sub_state_";

let teams = [];
let currentTeamId = null;
let gameClockSeconds = 0;
let clockInterval = null;

// Default sample teams (you can edit/remove later)
const defaultTeams = [
  {
    id: "u12",
    name: "U12 Travel",
    formation: "11v11-4-3-3",
    players: [
      {
        id: "rowan",
        name: "Rowan",
        number: 9,
        positions: {
          primary: ["ST", "RW", "CAM"],
          secondary: ["LW"],
          tertiary: []
        },
        twoWay: true,
        minutesField: 0,
        minutesBench: 0,
        onField: false,
        notes: ""
      },
      {
        id: "alex",
        name: "Alex",
        number: 7,
        positions: {
          primary: ["LW", "RW"],
          secondary: ["ST"],
          tertiary: []
        },
        twoWay: false,
        minutesField: 0,
        minutesBench: 0,
        onField: false,
        notes: ""
      }
      // add more players here
    ]
  }
];

// ====== UTIL ======

function loadTeams() {
  const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
  if (raw) {
    try {
      teams = JSON.parse(raw);
    } catch {
      teams = defaultTeams;
    }
  } else {
    teams = defaultTeams;
  }
}

function saveTeams() {
  localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(teams));
}

function getTeamById(id) {
  return teams.find(t => t.id === id);
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ====== STATE SAVE / RESTORE ======

function loadTeamState(teamId) {
  const raw = localStorage.getItem(STORAGE_KEY_STATE_PREFIX + teamId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTeamState(teamId, state) {
  localStorage.setItem(
    STORAGE_KEY_STATE_PREFIX + teamId,
    JSON.stringify(state)
  );
}

function buildCurrentState() {
  const team = getTeamById(currentTeamId);
  if (!team) return null;
  return {
    gameClockSeconds,
    players: team.players.map(p => ({
      id: p.id,
      minutesField: p.minutesField,
      minutesBench: p.minutesBench,
      onField: p.onField,
      notes: p.notes
    }))
  };
}

function applyStateToTeam(team, state) {
  if (!state) return;
  gameClockSeconds = state.gameClockSeconds || 0;
  const map = new Map(state.players.map(p => [p.id, p]));
  team.players.forEach(p => {
    const s = map.get(p.id);
    if (!s) return;
    p.minutesField = s.minutesField;
    p.minutesBench = s.minutesBench;
    p.onField = s.onField;
    p.notes = s.notes || "";
  });
}

// ====== DOM ELEMENTS ======

const teamSelectEl = document.getElementById("teamSelect");
const gameClockEl = document.getElementById("gameClock");
const startClockBtn = document.getElementById("startClockBtn");
const pauseClockBtn = document.getElementById("pauseClockBtn");
const resetClockBtn = document.getElementById("resetClockBtn");

const fieldEl = document.getElementById("field");
const benchEl = document.getElementById("bench");
const suggestionListEl = document.getElementById("suggestionList");

const playerModalEl = document.getElementById("playerModal");
const closePlayerModalBtn = document.getElementById("closePlayerModal");
const modalPlayerNameEl = document.getElementById("modalPlayerName");
const modalPlayerNumberEl = document.getElementById("modalPlayerNumber");
const modalPlayerPrimaryEl = document.getElementById("modalPlayerPrimary");
const modalPlayerSecondaryEl = document.getElementById("modalPlayerSecondary");
const modalPlayerTertiaryEl = document.getElementById("modalPlayerTertiary");
const modalMinutesFieldEl = document.getElementById("modalMinutesField");
const modalMinutesBenchEl = document.getElementById("modalMinutesBench");
const modalFatigueEl = document.getElementById("modalFatigue");
const modalNotesEl = document.getElementById("modalNotes");
const savePlayerNotesBtn = document.getElementById("savePlayerNotes");

const rosterModalEl = document.getElementById("rosterModal");
const closeRosterModalBtn = document.getElementById("closeRosterModal");
const teamNameInputEl = document.getElementById("teamNameInput");
const formationInputEl = document.getElementById("formationInput");
const rosterListEl = document.getElementById("rosterList");
const playerNameInputEl = document.getElementById("playerNameInput");
const playerNumberInputEl = document.getElementById("playerNumberInput");
const playerPrimaryInputEl = document.getElementById("playerPrimaryInput");
const playerSecondaryInputEl = document.getElementById("playerSecondaryInput");
const playerTertiaryInputEl = document.getElementById("playerTertiaryInput");
const playerTwoWayInputEl = document.getElementById("playerTwoWayInput");
const playerNotesInputEl = document.getElementById("playerNotesInput");
const savePlayerBtn = document.getElementById("savePlayerBtn");
const deletePlayerBtn = document.getElementById("deletePlayerBtn");
const saveRosterBtn = document.getElementById("saveRosterBtn");

const addTeamBtn = document.getElementById("addTeamBtn");
const editRosterBtn = document.getElementById("editRosterBtn");

let selectedPlayerIdForModal = null;
let selectedPlayerIdForEditor = null;

// ====== FIELD LAYOUT (simple presets) ======

function getPositionSlotsForFormation(formation) {
  // Very simple layouts; you can refine positions later
  const slots = [];

  const addSlot = (code, xPercent, yPercent) => {
    slots.push({ code, xPercent, yPercent });
  };

  if (formation.startsWith("7v7")) {
    // GK, 2 backs, 3 mids, 1 striker
    addSlot("GK", 50, 95);
    addSlot("LB", 25, 75);
    addSlot("RB", 75, 75);
    addSlot("LM", 25, 50);
    addSlot("CM", 50, 50);
    addSlot("RM", 75, 50);
    addSlot("ST", 50, 20);
  } else if (formation.startsWith("9v9")) {
    addSlot("GK", 50, 95);
    addSlot("LB", 20, 80);
    addSlot("CB", 50, 80);
    addSlot("RB", 80, 80);
    addSlot("LM", 20, 55);
    addSlot("CM", 50, 55);
    addSlot("RM", 80, 55);
    addSlot("CAM", 50, 35);
    addSlot("ST", 50, 15);
  } else {
    // 11v11 4-3-3
    addSlot("GK", 50, 95);
    addSlot("LB", 20, 80);
    addSlot("LCB", 35, 80);
    addSlot("RCB", 65, 80);
    addSlot("RB", 80, 80);
    addSlot("LCM", 35, 60);
    addSlot("CM", 50, 60);
    addSlot("RCM", 65, 60);
    addSlot("LW", 20, 35);
    addSlot("ST", 50, 25);
    addSlot("RW", 80, 35);
  }

  return slots;
}

// ====== RENDERING ======

function renderTeamSelect() {
  teamSelectEl.innerHTML = "";
  teams.forEach(team => {
    const opt = document.createElement("option");
    opt.value = team.id;
    opt.textContent = team.name;
    teamSelectEl.appendChild(opt);
  });
  if (!currentTeamId && teams.length > 0) {
    currentTeamId = teams[0].id;
  }
  teamSelectEl.value = currentTeamId;
}

function renderField() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  fieldEl.innerHTML = "";

  const slots = getPositionSlotsForFormation(team.formation);
  slots.forEach(slot => {
    const slotEl = document.createElement("div");
    slotEl.className = "position-slot";
    slotEl.dataset.position = slot.code;
    slotEl.style.left = `${slot.xPercent}%`;
    slotEl.style.top = `${slot.yPercent}%`;
    slotEl.style.transform = "translate(-50%, -50%)";
    slotEl.textContent = slot.code;
    fieldEl.appendChild(slotEl);
  });

  // Place players on field
  team.players
    .filter(p => p.onField)
    .forEach(p => {
      const pos = findBestPositionForPlayer(p, slots);
      const token = createPlayerToken(p, false);
      if (pos) {
        token.style.left = `${pos.xPercent}%`;
        token.style.top = `${pos.yPercent}%`;
        token.style.transform = "translate(-50%, -50%)";
      } else {
        // fallback center
        token.style.left = "50%";
        token.style.top = "50%";
        token.style.transform = "translate(-50%, -50%)";
      }
      fieldEl.appendChild(token);
    });
}

function renderBench() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  benchEl.innerHTML = "";
  team.players
    .filter(p => !p.onField)
    .forEach(p => {
      const token = createPlayerToken(p, true);
      benchEl.appendChild(token);
    });
}

function createPlayerToken(player, isBench) {
  const el = document.createElement("div");
  el.className = "player-token" + (isBench ? " bench" : "");
  el.dataset.playerId = player.id;

  const roleClass = getRoleClassForPlayer(player);
  if (roleClass) el.classList.add(roleClass);

  const nameEl = document.createElement("div");
  nameEl.className = "player-name";
  nameEl.textContent = player.name;

  const numEl = document.createElement("div");
  numEl.className = "player-number";
  numEl.textContent = `#${player.number}`;

  const minsEl = document.createElement("div");
  minsEl.className = "player-minutes";
  minsEl.textContent = `${Math.round(player.minutesField)}'`;

  el.appendChild(nameEl);
  el.appendChild(numEl);
  el.appendChild(minsEl);

  // Click → open player modal
  el.addEventListener("click", e => {
    e.stopPropagation();
    openPlayerModal(player.id);
  });

  // Drag & drop (simple: click+hold → move)
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("mousedown", e => {
    dragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    el.style.cursor = "grabbing";
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = "grab";
    handleDropPlayer(el);
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const rect = fieldEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    el.style.position = "absolute";
    el.style.left = `${xPercent}%`;
    el.style.top = `${yPercent}%`;
    el.style.transform = "translate(-50%, -50%)";
  });

  return el;
}

function getRoleClassForPlayer(player) {
  const primary = player.positions.primary || [];
  if (primary.includes("GK")) return "gk";
  if (primary.some(p => ["CB", "LCB", "RCB", "LB", "RB"].includes(p)))
    return "defense";
  if (primary.some(p => ["ST", "LW", "RW", "CAM"].includes(p)))
    return "offense";
  return "";
}

// ====== DRAG / DROP LOGIC (simple) ======

function handleDropPlayer(tokenEl) {
  const playerId = tokenEl.dataset.playerId;
  const team = getTeamById(currentTeamId);
  if (!team) return;
  const player = team.players.find(p => p.id === playerId);
  if (!player) return;

  const rectField = fieldEl.getBoundingClientRect();
  const rectToken = tokenEl.getBoundingClientRect();

  const centerX = rectToken.left + rectToken.width / 2;
  const centerY = rectToken.top + rectToken.height / 2;

  const insideField =
    centerX >= rectField.left &&
    centerX <= rectField.right &&
    centerY >= rectField.top &&
    centerY <= rectField.bottom;

  if (insideField) {
    // Put on field
    player.onField = true;
  } else {
    // Put on bench
    player.onField = false;
  }

  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
}

// ====== PLAYER MODAL ======

function openPlayerModal(playerId) {
  const team = getTeamById(currentTeamId);
  if (!team) return;
  const player = team.players.find(p => p.id === playerId);
  if (!player) return;

  selectedPlayerIdForModal = playerId;

  modalPlayerNameEl.textContent = player.name;
  modalPlayerNumberEl.textContent = player.number;
  modalPlayerPrimaryEl.textContent = (player.positions.primary || []).join(", ");
  modalPlayerSecondaryEl.textContent = (player.positions.secondary || []).join(", ");
  modalPlayerTertiaryEl.textContent = (player.positions.tertiary || []).join(", ");
  modalMinutesFieldEl.textContent = `${Math.round(player.minutesField)}'`;
  modalMinutesBenchEl.textContent = `${Math.round(player.minutesBench)}'`;
  const fatigue = computeFatigue(player);
  modalFatigueEl.textContent = fatigue.toFixed(2);
  modalNotesEl.value = player.notes || "";

  playerModalEl.classList.remove("hidden");
}

function closePlayerModal() {
  playerModalEl.classList.add("hidden");
  selectedPlayerIdForModal = null;
}

closePlayerModalBtn.addEventListener("click", closePlayerModal);

savePlayerNotesBtn.addEventListener("click", () => {
  if (!selectedPlayerIdForModal) return;
  const team = getTeamById(currentTeamId);
  if (!team) return;
  const player = team.players.find(p => p.id === selectedPlayerIdForModal);
  if (!player) return;
  player.notes = modalNotesEl.value || "";
  saveTeams();
  autosaveState();
  closePlayerModal();
});

// ====== ROSTER MODAL ======

function openRosterModal() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  teamNameInputEl.value = team.name;
  formationInputEl.value = team.formation;

  renderRosterList(team);
  clearPlayerEditor();

  rosterModalEl.classList.remove("hidden");
}

function closeRosterModal() {
  rosterModalEl.classList.add("hidden");
  selectedPlayerIdForEditor = null;
}

closeRosterModalBtn.addEventListener("click", closeRosterModal);

function renderRosterList(team) {
  rosterListEl.innerHTML = "";
  team.players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `#${p.number} ${p.name}`;
    li.dataset.playerId = p.id;
    if (p.id === selectedPlayerIdForEditor) li.classList.add("active");
    li.addEventListener("click", () => {
      selectedPlayerIdForEditor = p.id;
      renderRosterList(team);
      loadPlayerIntoEditor(p);
    });
    rosterListEl.appendChild(li);
  });
}

function clearPlayerEditor() {
  playerNameInputEl.value = "";
  playerNumberInputEl.value = "";
  playerPrimaryInputEl.value = "";
  playerSecondaryInputEl.value = "";
  playerTertiaryInputEl.value = "";
  playerTwoWayInputEl.checked = false;
  playerNotesInputEl.value = "";
}

function loadPlayerIntoEditor(player) {
  playerNameInputEl.value = player.name;
  playerNumberInputEl.value = player.number;
  playerPrimaryInputEl.value = (player.positions.primary || []).join(",");
  playerSecondaryInputEl.value = (player.positions.secondary || []).join(",");
  playerTertiaryInputEl.value = (player.positions.tertiary || []).join(",");
  playerTwoWayInputEl.checked = !!player.twoWay;
  playerNotesInputEl.value = player.notes || "";
}

savePlayerBtn.addEventListener("click", () => {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  const name = playerNameInputEl.value.trim();
  const number = parseInt(playerNumberInputEl.value.trim(), 10);
  if (!name || isNaN(number)) return;

  const primary = playerPrimaryInputEl.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const secondary = playerSecondaryInputEl.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const tertiary = playerTertiaryInputEl.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const twoWay = playerTwoWayInputEl.checked;
  const notes = playerNotesInputEl.value || "";

  if (selectedPlayerIdForEditor) {
    const player = team.players.find(p => p.id === selectedPlayerIdForEditor);
    if (!player) return;
    player.name = name;
    player.number = number;
    player.positions = { primary, secondary, tertiary };
    player.twoWay = twoWay;
    player.notes = notes;
  } else {
    const newPlayer = {
      id: generateId(),
      name,
      number,
      positions: { primary, secondary, tertiary },
      twoWay,
      minutesField: 0,
      minutesBench: 0,
      onField: false,
      notes
    };
    team.players.push(newPlayer);
    selectedPlayerIdForEditor = newPlayer.id;
  }

  saveTeams();
  renderRosterList(team);
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
});

deletePlayerBtn.addEventListener("click", () => {
  if (!selectedPlayerIdForEditor) return;
  const team = getTeamById(currentTeamId);
  if (!team) return;
  team.players = team.players.filter(p => p.id !== selectedPlayerIdForEditor);
  selectedPlayerIdForEditor = null;
  saveTeams();
  renderRosterList(team);
  clearPlayerEditor();
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
});

saveRosterBtn.addEventListener("click", () => {
  const team = getTeamById(currentTeamId);
  if (!team) return;
  const name = teamNameInputEl.value.trim();
  const formation = formationInputEl.value;
  if (name) team.name = name;
  team.formation = formation;
  saveTeams();
  renderTeamSelect();
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
  closeRosterModal();
});

addTeamBtn.addEventListener("click", () => {
  const id = generateId();
  const newTeam = {
    id,
    name: "New Team",
    formation: "7v7-2-3-1",
    players: []
  };
  teams.push(newTeam);
  saveTeams();
  currentTeamId = id;
  renderTeamSelect();
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
  openRosterModal();
});

editRosterBtn.addEventListener("click", openRosterModal);

// ====== CLOCK & TIMERS ======

function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    gameClockSeconds += 1;
    gameClockEl.textContent = formatClock(gameClockSeconds);
    tickPlayerMinutes();
    autosaveState();
  }, 1000);
}

function pauseClock() {
  if (!clockInterval) return;
  clearInterval(clockInterval);
  clockInterval = null;
}

function resetClock() {
  pauseClock();
  gameClockSeconds = 0;
  gameClockEl.textContent = formatClock(gameClockSeconds);
  const team = getTeamById(currentTeamId);
  if (!team) return;
  team.players.forEach(p => {
    p.minutesField = 0;
    p.minutesBench = 0;
  });
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
}

startClockBtn.addEventListener("click", startClock);
pauseClockBtn.addEventListener("click", pauseClock);
resetClockBtn.addEventListener("click", resetClock);

function tickPlayerMinutes() {
  const team = getTeamById(currentTeamId);
  if (!team) return;
  team.players.forEach(p => {
    if (p.onField) {
      p.minutesField += 1 / 60; // seconds → minutes
    } else {
      p.minutesBench += 1 / 60;
    }
  });
  renderField();
  renderBench();
  updateSuggestions();
}

// ====== FATIGUE & SUGGESTIONS ======

function computeFatigue(player) {
  // Simple model: more minutes on field → higher fatigue, bench reduces it slightly
  const fieldFactor = player.minutesField;
  const benchFactor = player.minutesBench * 0.3;
  return Math.max(0, fieldFactor - benchFactor);
}

function findBestPositionForPlayer(player, slots) {
  const primary = player.positions.primary || [];
  const secondary = player.positions.secondary || [];
  const tertiary = player.positions.tertiary || [];

  // Try primary
  for (const pos of primary) {
    const slot = slots.find(s => s.code === pos);
    if (slot) return slot;
  }
  // Then secondary
  for (const pos of secondary) {
    const slot = slots.find(s => s.code === pos);
    if (slot) return slot;
  }
  // Then tertiary
  for (const pos of tertiary) {
    const slot = slots.find(s => s.code === pos);
    if (slot) return slot;
  }
  return null;
}

function updateSuggestions() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  const onField = team.players.filter(p => p.onField);
  const onBench = team.players.filter(p => !p.onField);

  // Sort field players by fatigue descending
  const fatigued = [...onField].sort(
    (a, b) => computeFatigue(b) - computeFatigue(a)
  );

  const suggestions = [];

  fatigued.forEach(player => {
    const fatigue = computeFatigue(player);
    if (fatigue < 10) return; // threshold; tweak as needed

    // Find bench candidates who can play similar positions
    const candidates = onBench
      .map(b => ({
        player: b,
        score: computeSubFitScore(player, b)
      }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return;

    const best = candidates[0].player;
    suggestions.push(
      `Sub ${best.name} (#${best.number}) for ${player.name} (#${player.number}) — fatigue ${fatigue.toFixed(
        1
      )}`
    );
  });

  suggestionListEl.innerHTML = "";
  if (suggestions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No urgent subs suggested.";
    suggestionListEl.appendChild(li);
  } else {
    suggestions.slice(0, 5).forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      suggestionListEl.appendChild(li);
    });
  }
}

function computeSubFitScore(fieldPlayer, benchPlayer) {
  // Higher score = better fit
  let score = 0;

  const fieldPrimary = fieldPlayer.positions.primary || [];
  const benchPrimary = benchPlayer.positions.primary || [];
  const benchSecondary = benchPlayer.positions.secondary || [];

  // Positional overlap
  if (benchPrimary.some(p => fieldPrimary.includes(p))) score += 10;
  if (benchSecondary.some(p => fieldPrimary.includes(p))) score += 6;

  // Two-way flexibility
  if (benchPlayer.twoWay) score += 3;

  // Minutes balancing (less field time = better)
  score += Math.max(0, 15 - benchPlayer.minutesField); // prefer underplayed

  return score;
}

// ====== AUTOSAVE ======

function autosaveState() {
  const state = buildCurrentState();
  if (!state) return;
  saveTeamState(currentTeamId, state);
}

// ====== INIT ======

function init() {
  loadTeams();
  renderTeamSelect();

  // Load state for current team
  const team = getTeamById(currentTeamId);
  if (team) {
    const state = loadTeamState(currentTeamId);
    applyStateToTeam(team, state);
  }

  gameClockEl.textContent = formatClock(gameClockSeconds);
  renderField();
  renderBench();
  updateSuggestions();

  teamSelectEl.addEventListener("change", () => {
    currentTeamId = teamSelectEl.value;
    const team = getTeamById(currentTeamId);
    if (team) {
      const state = loadTeamState(currentTeamId);
      applyStateToTeam(team, state);
    }
    gameClockEl.textContent = formatClock(gameClockSeconds);
    renderField();
    renderBench();
    updateSuggestions();
  });
}

init();
