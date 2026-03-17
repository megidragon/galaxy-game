// API client for Galaxy Game

const API = {
  async get(path) {
    const res = await fetch(`/api${path}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },

  // Game state
  getHealth: () => API.get('/health'),
  getGameState: () => API.get('/game/state'),
  setSpeed: (speed) => API.post('/game/speed', { speed }),
  sendAction: (action) => API.post('/game/action', action),

  // Galaxy
  getGalaxyMap: () => API.get('/galaxy/map'),
  getGalaxyStatus: () => API.get('/galaxy/status'),
  getSystem: (id) => API.get(`/galaxy/systems/${id}`),

  // Empires
  getEmpires: () => API.get('/empires'),
  getPlayerEmpire: () => API.get('/empires/player'),
  getEmpireShips: (id) => API.get(`/empires/${id}/ships`),
  getExploredSystems: (id) => API.get(`/empires/${id}/explored`),

  // Ships
  getAllShips: () => API.get('/ships'),
  getShipsInSystem: (systemId) => API.get(`/ships/system/${systemId}`),

  // Research
  getResearchChoices: () => API.get('/research/choices'),
  getResearchState: () => API.get('/research/state'),
};

export default API;
