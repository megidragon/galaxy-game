import API from './api.js';
import { GalaxyRenderer } from './renderer.js';

// State
let gameState = { tick: 0, speed: 'paused' };
let playerEmpire = null;
let empires = [];
let galaxyData = null;
let ships = [];
let exploredSystems = [];
let selectedSystem = null;
let selectedShip = null;
let renderer = null;
let researchState = null;

// Init
async function init() {
  const canvas = document.getElementById('galaxy-canvas');
  renderer = new GalaxyRenderer(canvas);

  renderer.onSystemSelect = (system) => {
    selectedSystem = system;
    selectedShip = null;
    renderer.selectedShip = null;
    updateSidebar();
    updateBottomPanel();
    renderer.render();
  };

  renderer.onShipMove = async (ship, targetSystem) => {
    const result = await API.sendAction({
      type: 'MOVE_SHIP',
      shipId: ship.id,
      targetSystemId: targetSystem.id,
    });
    if (result.ok) {
      showToast(`${ship.name} moving to ${targetSystem.name}`);
      await refreshData();
    } else {
      showToast(result.error || 'Cannot move there', true);
    }
  };

  // Speed controls
  document.querySelectorAll('#speed-controls button').forEach(btn => {
    btn.addEventListener('click', () => setSpeed(btn.dataset.speed));
  });

  await refreshData();

  // Center on player home system
  if (playerEmpire && galaxyData) {
    const homeSys = galaxyData.systems.find(s => s.id === playerEmpire.homeSystemId);
    if (homeSys) renderer.centerOnSystem(homeSys);
  }

  // Poll for updates
  setInterval(refreshData, 1000);
}

async function refreshData() {
  try {
    const [state, empiresData, mapData, allShips, player] = await Promise.all([
      API.getGameState(),
      API.getEmpires(),
      API.getGalaxyMap(),
      API.getAllShips(),
      API.getPlayerEmpire(),
    ]);

    gameState = state;
    empires = empiresData;
    galaxyData = mapData;
    ships = allShips;
    playerEmpire = player;

    if (playerEmpire) {
      exploredSystems = await API.getExploredSystems(playerEmpire.id);
      researchState = await API.getResearchState();
    }

    // Enrich systems with starbase data
    if (galaxyData) {
      const starbases = await API.get('/galaxy/map').then(d => {
        // Starbases are loaded from a different query. Let's fetch them inline
        return [];
      }).catch(() => []);

      // Fetch starbases from systems data
      for (const sys of galaxyData.systems) {
        // Check if any starbase exists in this system from ships/starbases
        sys.starbase = null; // Will be populated from API if available
      }
    }

    updateRenderer();
    updateTopbar();
    updateSpeedButtons();
    updateSidebar();
  } catch (err) {
    console.error('Failed to refresh:', err);
  }
}

function updateRenderer() {
  if (!renderer || !galaxyData) return;
  renderer.setData(
    galaxyData.systems,
    galaxyData.hyperlanes,
    ships,
    empires,
    exploredSystems
  );
}

function updateTopbar() {
  document.getElementById('tick-display').textContent = `Tick: ${gameState.tick}`;

  if (playerEmpire) {
    const r = playerEmpire.resources;
    document.getElementById('res-energy').textContent = Math.floor(r.energy);
    document.getElementById('res-minerals').textContent = Math.floor(r.minerals);
    document.getElementById('res-science').textContent = Math.floor(r.science);
    document.getElementById('res-alloys').textContent = Math.floor(r.alloys);
  }
}

function updateSpeedButtons() {
  document.querySelectorAll('#speed-controls button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.speed === gameState.speed);
  });
}

async function setSpeed(speed) {
  await API.setSpeed(speed);
  gameState.speed = speed;
  updateSpeedButtons();
}

function updateSidebar() {
  const sidebar = document.getElementById('sidebar');

  let html = '';

  // Selected system info
  if (selectedSystem) {
    const explored = exploredSystems.includes(selectedSystem.id);
    html += `<div class="sidebar-section">
      <h2>System</h2>
      <div class="system-info">
        <div><span class="label">Name:</span> <span class="value">${selectedSystem.name}</span></div>
        <div><span class="label">Star:</span> <span class="value">${selectedSystem.starType}</span></div>
        ${explored ? `<div><span class="label">Planets:</span> <span class="value">${selectedSystem.planets.length}</span></div>` : '<div><span class="label">Status:</span> <span class="value">Unexplored</span></div>'}
      </div>
    </div>`;

    // Ships in system
    const systemShips = ships.filter(s => s.systemId === selectedSystem.id && s.isAlive);
    if (systemShips.length > 0) {
      html += `<div class="sidebar-section"><h3>Ships</h3><ul class="ship-list">`;
      for (const ship of systemShips) {
        const isOwn = ship.ownerId === playerEmpire?.id;
        const selected = selectedShip?.id === ship.id;
        html += `<li class="ship-item ${selected ? 'selected' : ''}" data-ship-id="${ship.id}" ${isOwn ? 'style="cursor:pointer"' : ''}>
          <span class="ship-class">${ship.shipClass}</span> ${ship.name}
          <span class="ship-hp">${Math.floor(ship.hp)}/${ship.maxHp} HP</span>
        </li>`;
      }
      html += `</ul></div>`;
    }

    // Planets (if explored)
    if (explored && selectedSystem.planets.length > 0) {
      html += `<div class="sidebar-section"><h3>Planets</h3><ul class="planet-list">`;
      for (const planet of selectedSystem.planets) {
        html += `<li class="planet-item" data-planet-id="${planet.id}">
          ${planet.name} <span class="ship-class">${planet.planetType} (${planet.size})</span>
          ${planet.isColonized ? `<span class="ship-hp">${planet.role || 'none'}</span>` : ''}
        </li>`;
      }
      html += `</ul></div>`;
    }

    // Actions
    if (selectedShip && selectedShip.ownerId === playerEmpire?.id) {
      html += `<div class="sidebar-section"><h3>Ship Actions</h3>`;
      if (selectedShip.shipClass === 'science') {
        html += `<button class="action-btn" onclick="window.gameActions.scanSystem()">Scan System</button>`;
      }
      if (selectedShip.shipClass === 'constructor') {
        html += `<button class="action-btn" onclick="window.gameActions.buildStarbase()">Build Starbase</button>`;
      }
      html += `<div style="margin-top:8px;font-size:0.75rem;color:#6666aa">Right-click a system to move</div>`;
      html += `</div>`;
    }
  } else {
    html += `<div class="sidebar-section"><h2>Galaxy Game</h2><p style="font-size:0.8rem;color:#6666aa">Click a star system to inspect it.<br>Select your ships and right-click to move.</p></div>`;
  }

  sidebar.innerHTML = html;

  // Attach ship click handlers
  sidebar.querySelectorAll('.ship-item').forEach(el => {
    el.addEventListener('click', () => {
      const shipId = el.dataset.shipId;
      const ship = ships.find(s => s.id === shipId);
      if (ship && ship.ownerId === playerEmpire?.id) {
        selectedShip = ship;
        renderer.selectedShip = ship;
        updateSidebar();
        renderer.render();
      }
    });
  });
}

function updateBottomPanel() {
  const panel = document.getElementById('bottom-panel');
  let html = '';

  // Empire overview
  if (playerEmpire) {
    html += `<div class="panel-section">
      <h3>Empire: ${playerEmpire.name}</h3>
      <div style="font-size:0.8rem">
        <div>Systems explored: ${exploredSystems.length}</div>
        <div>Ships: ${ships.filter(s => s.ownerId === playerEmpire.id && s.isAlive).length}</div>
      </div>
    </div>`;
  }

  // Build ships
  if (selectedSystem) {
    html += `<div class="panel-section">
      <h3>Build Ships</h3>
      <button class="action-btn" onclick="window.gameActions.buildShip('science')">Science Ship</button>
      <button class="action-btn" onclick="window.gameActions.buildShip('constructor')">Constructor</button>
      <button class="action-btn" onclick="window.gameActions.buildShip('military')">Military</button>
      <button class="action-btn" onclick="window.gameActions.buildShip('colony')">Colony Ship</button>
    </div>`;
  }

  // Research
  if (researchState) {
    html += `<div class="panel-section"><h3>Research</h3>`;
    if (researchState.currentTech) {
      const pct = Math.floor((researchState.accumulated / researchState.currentTech.cost) * 100);
      html += `<div style="font-size:0.8rem">Researching: <strong>${researchState.currentTech.name}</strong> (${pct}%)</div>`;
    } else {
      html += `<div style="font-size:0.8rem;margin-bottom:8px">Choose research:</div>`;
      // Load choices dynamically
      loadResearchChoices().then(choices => {
        const container = document.getElementById('research-choices');
        if (!container) return;
        container.innerHTML = choices.map(t => `
          <div class="tech-card" onclick="window.gameActions.researchTech('${t.id}')">
            <span class="tech-name">${t.name}</span>
            <span class="tech-cost">${t.cost} sci</span>
            <div class="tech-desc">${t.description}</div>
          </div>
        `).join('');
      });
      html += `<div id="research-choices">Loading...</div>`;
    }
    html += `</div>`;
  }

  panel.innerHTML = html;
}

async function loadResearchChoices() {
  try {
    return await API.getResearchChoices();
  } catch {
    return [];
  }
}

// Game actions (exposed globally for onclick handlers)
window.gameActions = {
  async scanSystem() {
    if (!selectedShip) return;
    const result = await API.sendAction({ type: 'SCAN_SYSTEM', shipId: selectedShip.id });
    if (result.ok) {
      showToast('System scanned!');
      await refreshData();
    } else {
      showToast(result.error || 'Cannot scan', true);
    }
  },

  async buildStarbase() {
    if (!selectedShip) return;
    const result = await API.sendAction({ type: 'BUILD_STARBASE', shipId: selectedShip.id });
    if (result.ok) {
      showToast('Starbase built!');
      selectedShip = null;
      renderer.selectedShip = null;
      await refreshData();
    } else {
      showToast(result.error || 'Cannot build', true);
    }
  },

  async buildShip(shipClass) {
    if (!selectedSystem) return;
    const result = await API.sendAction({
      type: 'BUILD_SHIP',
      systemId: selectedSystem.id,
      shipClass,
    });
    if (result.ok) {
      showToast(`${shipClass} ship built!`);
      await refreshData();
    } else {
      showToast(result.error || 'Cannot build ship', true);
    }
  },

  async researchTech(techId) {
    const result = await API.sendAction({ type: 'RESEARCH_TECH', techId });
    if (result.ok) {
      showToast('Research started!');
      await refreshData();
      updateBottomPanel();
    } else {
      showToast(result.error || 'Cannot research', true);
    }
  },
};

// Toast notifications
function showToast(message, isError = false) {
  const container = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Start
init();
