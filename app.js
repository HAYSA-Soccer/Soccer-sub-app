// STORAGE & DATA

const STORAGE_KEY_TEAMS = "soccer_sub_teams_v4";
const STORAGE_KEY_STATE_PREFIX = "soccer_sub_state_";

let teams = [];
let currentTeamId = null;
let selectedPlayerId = null;

let gameClockSeconds = 0;
let clockInterval = null;

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
        assignedPos: null,
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
        assignedPos: null,
        notes: ""
      }
    ]
  }
];

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

// STATE SAVE / RESTORE

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
  localStorage.setItem(STORAGE_KEY_STATE_PREFIX + teamId, JSON.stringify(state));
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
      assignedPos: p.assignedPos,
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
    p.assignedPos = s.assignedPos;
    p.notes = s.notes || "";
  });
}

// DOM ELEMENTS

const teamSelectEl = document.getElementById("teamSelect");
const goToRosterBtn = document.getElementById("goToRosterBtn");
const backToGameBtn = document.getElementById("backToGameBtn");

const mainViewEl = document.getElementById("mainView");
const rosterViewEl = document.getElementById("rosterView");

const gameClockEl = document.getElementById("gameClock");
const startClockBtn = document.getElementById("startClockBtn");
const pauseClockBtn = document.getElementById("pauseClockBtn");
const resetClockBtn = document.getElementById("resetClockBtn");

const fieldEl = document.getElementById("field");
const benchEl = document.getElementById("bench");
const suggestionListEl = document.getElementById("suggestionList");

const teamNameInputEl = document.getElementById("teamNameInput");
const formationInputEl = document.getElementById("formationInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const rosterListEl = document.getElementById("rosterList");
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
const saveRosterBtn = document.getElementById("saveRosterBtn");

// FIELD LAYOUTS

function getPositionSlotsForFormation(formation) {
  const slots = [];
  const addSlot = (code, x, y) => slots.push({ code, xPercent: x, yPercent: y });

  if (formation.startsWith("7v7")) {
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

// RENDERING

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
    const el = document.createElement("div");
    el.className = "position-slot";
    el.dataset.position = slot.code;
    el.style.left = `${slot.xPercent}%`;
    el.style.top = `${slot.yPercent}%`;
    el.style.transform = "translate(-50%, -50%)";

    el.addEventListener("click", () => {
      if (!selectedPlayerId) return;
      placePlayerAtPosition(selectedPlayerId, slot.code);
    });

    fieldEl.appendChild(el);
  });

  team.players
    .filter(p => p.onField && p.assignedPos)
    .forEach(p => {
      const slot = slots.find(s => s.code === p.assignedPos);
      if (!slot) return;
      const token = createPlayerToken(p, false);
      token.style.left = `${slot.xPercent}%`;
      token.style.top = `${slot.yPercent}%`;
      token.style.transform = "translate(-50%, -50%)";
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

  const nameEl = document.createElement("div");
  nameEl.textContent = player.name;

  const numEl = document.createElement("div");
  numEl.textContent = `#${player.number}`;

  const minsEl = document.createElement("div");
  minsEl.textContent = `${Math.round(player.minutesField)}'`;

  el.appendChild(nameEl);
  el.appendChild(numEl);
  el.appendChild(minsEl);

  el.addEventListener("click", () => {
    handlePlayerSelect(player.id);
  });

  return el;
}

// TAP-TO-SELECT → TAP-TO-PLACE

function handlePlayerSelect(playerId) {
  const team = getTeamById(currentTeamId);
  const player = team.players.find(p => p.id === playerId);

  if (selectedPlayerId === playerId) {
    selectedPlayerId = null;
    clearHighlights();
    return;
  }

  selectedPlayerId = playerId;
  highlightPlayer(playerId);
  highlightValidPositions(player);
}

function highlightPlayer(playerId) {
  document.querySelectorAll(".player-token").forEach(el => {
    el.classList.remove("selected");
    if (el.dataset.playerId === playerId) {
      el.classList.add("selected");
    }
  });
}

function highlightValidPositions(player) {
  const slots = document.querySelectorAll(".position-slot");

  slots.forEach(slot => {
    const pos = slot.dataset.position;
    const { primary, secondary, tertiary } = player.positions;

    if (
      primary.includes(pos) ||
      secondary.includes(pos) ||
      tertiary.includes(pos)
    ) {
      slot.classList.add("highlight");
    }
  });
}

function clearHighlights() {
  document.querySelectorAll(".player-token").forEach(el =>
    el.classList.remove("selected")
  );

  document.querySelectorAll(".position-slot").forEach(slot =>
    slot.classList.remove("highlight")
  );
}

function placePlayerAtPosition(playerId, positionCode) {
  const team = getTeamById(currentTeamId);
  const player = team.players.find(p => p.id === playerId);

  const existing = team.players.find(
    p => p.onField && p.assignedPos === positionCode
  );

  player.onField = true;
  player.assignedPos = positionCode;

  if (existing) {
    existing.onField = false;
    existing.assignedPos = null;
  }

  selectedPlayerId = null;
  clearHighlights();
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
}

// SUGGESTIONS / FATIGUE

function computeFatigue(player) {
  return player.minutesField - player.minutesBench * 0.3;
}

function updateSuggestions() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  const onField = team.players.filter(p => p.onField);
  const bench = team.players.filter(p => !p.onField);

  const sortedField = [...onField].sort(
    (a, b) => computeFatigue(b) - computeFatigue(a)
  );

  const suggestions = [];

  sortedField.slice(0, 3).forEach(fieldPlayer => {
    const candidates = bench.filter(b =>
      b.positions.primary.includes(fieldPlayer.assignedPos) ||
      b.positions.secondary.includes(fieldPlayer.assignedPos) ||
      b.positions.tertiary.includes(fieldPlayer.assignedPos)
    );

    if (candidates.length === 0) return;

    const best = candidates[0];

    suggestions.push({
      out: fieldPlayer,
      in: best
    });
  });

  suggestionListEl.innerHTML = "";

  suggestions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `Sub out #${s.out.number} ${s.out.name} for #${s.in.number} ${s.in.name} (${s.out.assignedPos})`;
    suggestionListEl.appendChild(li);
  });
}

// CLOCK

function startClock() {
  if (clockInterval) return;
  clockInterval = setInterval(() => {
    gameClockSeconds += 1;
    gameClockEl.textContent = formatClock(gameClockSeconds);
    tickMinutes();
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
  autosaveState();
}

function tickMinutes() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  team.players.forEach(p => {
    if (p.onField) {
      p.minutesField += 1 / 60;
    } else {
      p.minutesBench += 1 / 60;
    }
  });

  renderBench();
  updateSuggestions();
}

// AUTOSAVE

function autosaveState() {
  const state = buildCurrentState();
  if (!state) return;
  saveTeamState(currentTeamId, state);
}

// TEAM MANAGER VIEW

function showMainView() {
  mainViewEl.classList.remove("hidden");
  rosterViewEl.classList.add("hidden");
}

function showRosterView() {
  mainViewEl.classList.add("hidden");
  rosterViewEl.classList.remove("hidden");
  loadTeamIntoRosterView();
}

function loadTeamIntoRosterView() {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  teamNameInputEl.value = team.name;
  formationInputEl.value = team.formation;

  renderRosterList(team);
  clearPlayerEditor();
}

function renderRosterList(team) {
  rosterListEl.innerHTML = "";

  team.players.forEach(p => {
    const li = document.createElement("li");
    li.dataset.playerId = p.id;
    li.innerHTML = `
      <span>#${p.number} ${p.name}</span>
      <span class="role-tag">${p.positions.primary.join(", ")}</span>
    `;
    li.addEventListener("click", () => {
      loadPlayerIntoEditor(p);
    });
    rosterListEl.appendChild(li);
  });
}

function clearPlayerEditor() {
  playerEditorTitleEl.textContent = "New Player";
  playerNameInputEl.value = "";
  playerNumberInputEl.value = "";
  playerPrimaryInputEl.value = "";
  playerSecondaryInputEl.value = "";
  playerTertiaryInputEl.value = "";
  playerTwoWayInputEl.checked = false;
  playerNotesInputEl.value = "";
  delete savePlayerBtn.dataset.editingId;
}

function loadPlayerIntoEditor(player) {
  playerEditorTitleEl.textContent = `Edit Player #${player.number}`;
  playerNameInputEl.value = player.name;
  playerNumberInputEl.value = player.number;
  playerPrimaryInputEl.value = player.positions.primary.join(",");
  playerSecondaryInputEl.value = player.positions.secondary.join(",");
  playerTertiaryInputEl.value = player.positions.tertiary.join(",");
  playerTwoWayInputEl.checked = player.twoWay;
  playerNotesInputEl.value = player.notes || "";
  savePlayerBtn.dataset.editingId = player.id;
}

addPlayerBtn.addEventListener("click", () => {
  clearPlayerEditor();
});

savePlayerBtn.addEventListener("click", () => {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  const name = playerNameInputEl.value.trim();
  const number = parseInt(playerNumberInputEl.value.trim(), 10);
  if (!name || isNaN(number)) return;

  const primary = playerPrimaryInputEl.value.split(",").map(s => s.trim()).filter(Boolean);
  const secondary = playerSecondaryInputEl.value.split(",").map(s => s.trim()).filter(Boolean);
  const tertiary = playerTertiaryInputEl.value.split(",").map(s => s.trim()).filter(Boolean);

  const twoWay = playerTwoWayInputEl.checked;
  const notes = playerNotesInputEl.value || "";

  const editingId = savePlayerBtn.dataset.editingId;

  if (editingId) {
    const player = team.players.find(p => p.id === editingId);
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
      minutesField: 0,
      minutesBench: 0,
      onField: false,
      assignedPos: null,
      notes
    });
  }

  saveTeams();
  renderRosterList(team);
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
  clearPlayerEditor();
});

deletePlayerBtn.addEventListener("click", () => {
  const editingId = savePlayerBtn.dataset.editingId;
  if (!editingId) return;

  const team = getTeamById(currentTeamId);
  team.players = team.players.filter(p => p.id !== editingId);

  saveTeams();
  renderRosterList(team);
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
  clearPlayerEditor();
});

saveRosterBtn.addEventListener("click", () => {
  const team = getTeamById(currentTeamId);
  if (!team) return;

  team.name = teamNameInputEl.value.trim() || team.name;
  team.formation = formationInputEl.value;

  saveTeams();
  renderTeamSelect();
  renderField();
  renderBench();
  updateSuggestions();
  autosaveState();
  showMainView();
});

// EVENT WIRING

teamSelectEl.addEventListener("change", () => {
  currentTeamId = teamSelectEl.value;
  const team = getTeamById(currentTeamId);
  const state = loadTeamState(currentTeamId);
  applyStateToTeam(team, state);
  gameClockEl.textContent = formatClock(gameClockSeconds);
  renderField();
  renderBench();
  updateSuggestions();
});

goToRosterBtn.addEventListener("click", showRosterView);
backToGameBtn.addEventListener("click", showMainView);

startClockBtn.addEventListener("click", startClock);
pauseClockBtn.addEventListener("click", pauseClock);
resetClockBtn.addEventListener("click", resetClock);

// INIT

function init() {
  loadTeams();
  renderTeamSelect();

  const team = getTeamById(currentTeamId);
  const state = loadTeamState(currentTeamId);
  applyStateToTeam(team, state);

  gameClockEl.textContent = formatClock(gameClockSeconds);
  renderField();
  renderBench();
  updateSuggestions();
}

init();
