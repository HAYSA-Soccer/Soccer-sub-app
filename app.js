// ===============================
// DATA STORAGE
// ===============================

const STORAGE_KEY_TEAMS = "soccer_sub_teams_v5";
const STORAGE_KEY_STATE_PREFIX = "soccer_sub_state_";

let teams = [];
let currentTeamId = null;
let selectedPlayerId = null;

let gameClockSeconds = 0;
let clockInterval = null;

// ===============================
// DOM ELEMENTS
// ===============================

// Screens
const gameScreen = document.getElementById("gameScreen");
const teamManagerScreen = document.getElementById("teamManagerScreen");
const playerEditorScreen = document.getElementById("playerEditorScreen");

// Navigation buttons
const openTeamManagerBtn = document.getElementById("openTeamManager");
const backToGameBtn = document.getElementById("backToGame");
const backToTeamManagerBtn = document.getElementById("backToTeamManager");

// Team Manager elements
const teamSelectEl = document.getElementById("teamSelect");
const teamNameInputEl = document.getElementById("teamNameInput");
const formationInputEl = document.getElementById("formationInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const rosterListEl = document.getElementById("rosterList");
const saveTeamBtn = document.getElementById("saveTeamBtn");

// Player Editor elements
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

// Game screen elements
const gameClockEl = document.getElementById("gameClock");
const startClockBtn = document.getElementById("startClockBtn");
const pauseClockBtn = document.getElementById("pauseClockBtn");
const resetClockBtn = document.getElementById("resetClockBtn");

const fieldEl = document.getElementById("field");
const benchEl = document.getElementById("bench");
const suggestionListEl = document.getElementById("suggestionList");

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
// TEAM STORAGE
// ===============================

function loadTeams() {
  const raw = localStorage.getItem(STORAGE_KEY_TEAMS);
  if (raw) {
    teams = JSON.parse(raw);
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

// ===============================
// TEAM MANAGER LOGIC
// ===============================

function loadTeamIntoManager() {
  const team = getTeamById(currentTeamId);
  teamNameInputEl.value = team.name;
  formationInputEl.value = team.formation;
  renderRosterList(team);
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
  const team = getTeamById(currentTeamId);
  team.name = teamNameInputEl.value.trim();
  team.formation = formationInputEl.value;
  saveTeams();
  renderTeamSelect();
  renderField();
  renderBench();
  updateSuggestions();
  showGameScreen();
});

// ===============================
// PLAYER EDITOR LOGIC
// ===============================

function clearPlayerEditor() {
  delete savePlayerBtn.dataset.editingId;
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
  savePlayerBtn.dataset.editingId = player.id;
  playerEditorTitleEl.textContent = `Edit Player #${player.number}`;
  playerNameInputEl.value = player.name;
  playerNumberInputEl.value = player.number;
  playerPrimaryInputEl.value = player.positions.primary.join(",");
  playerSecondaryInputEl.value = player.positions.secondary.join(",");
  playerTertiaryInputEl.value = player.positions.tertiary.join(",");
  playerTwoWayInputEl.checked = player.twoWay;
  playerNotesInputEl.value = player.notes || "";
}

savePlayerBtn.addEventListener("click", () => {
  const team = getTeamById(currentTeamId);

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
