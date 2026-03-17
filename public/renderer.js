// Galaxy map renderer using Canvas 2D

const STAR_COLORS = {
  yellow: '#ffdd44',
  red: '#ff4444',
  blue: '#4488ff',
  white: '#eeeeff',
  orange: '#ff8844',
  binary: '#ff88ff',
};

const EMPIRE_COLORS_FALLBACK = ['#4488ff', '#ff4444', '#44ff44', '#ffaa00', '#ff44ff', '#44ffff'];

export class GalaxyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.systems = [];
    this.hyperlanes = [];
    this.ships = [];
    this.empires = [];
    this.exploredSystems = new Set();
    this.selectedSystem = null;
    this.selectedShip = null;
    this.hoveredSystem = null;

    // Camera
    this.camX = 0;
    this.camY = 0;
    this.zoom = 0.8;

    // Interaction
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.camDragStart = { x: 0, y: 0 };

    this.setupEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.render();
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.camDragStart = { x: this.camX, y: this.camY };
        this.canvas.classList.add('dragging');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.camX = this.camDragStart.x + (e.clientX - this.dragStart.x) / this.zoom;
        this.camY = this.camDragStart.y + (e.clientY - this.dragStart.y) / this.zoom;
        this.render();
      } else {
        this.updateHover(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.classList.remove('dragging');
      }
    });

    this.canvas.addEventListener('click', (e) => {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      const system = this.findSystemAt(worldPos.x, worldPos.y);
      if (system) {
        this.selectedSystem = system;
        if (this.onSystemSelect) this.onSystemSelect(system);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.selectedShip) {
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        const system = this.findSystemAt(worldPos.x, worldPos.y);
        if (system && this.onShipMove) {
          this.onShipMove(this.selectedShip, system);
        }
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoom = Math.max(0.2, Math.min(3, this.zoom * zoomFactor));
      this.render();
    });
  }

  screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: (sx - rect.left - cx) / this.zoom - this.camX,
      y: (sy - rect.top - cy) / this.zoom - this.camY,
    };
  }

  worldToScreen(wx, wy) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    return {
      x: (wx + this.camX) * this.zoom + cx,
      y: (wy + this.camY) * this.zoom + cy,
    };
  }

  findSystemAt(wx, wy) {
    const threshold = 15 / this.zoom;
    for (const sys of this.systems) {
      const dx = sys.x - wx;
      const dy = sys.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) return sys;
    }
    return null;
  }

  updateHover(e) {
    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    const system = this.findSystemAt(worldPos.x, worldPos.y);
    if (system !== this.hoveredSystem) {
      this.hoveredSystem = system;
      this.canvas.style.cursor = system ? 'pointer' : 'grab';
      this.render();
    }
  }

  setData(systems, hyperlanes, ships, empires, exploredSystems) {
    this.systems = systems;
    this.hyperlanes = hyperlanes;
    this.ships = ships;
    this.empires = empires;
    this.exploredSystems = new Set(exploredSystems);
    this.render();
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background stars
    this.drawBackgroundStars();

    // Hyperlanes
    this.drawHyperlanes();

    // Systems
    this.drawSystems();

    // Ships
    this.drawShips();

    // Hover tooltip
    this.drawTooltip();
  }

  drawBackgroundStars() {
    const { ctx, canvas } = this;
    // Seed-based static stars for background
    const rng = mulberry32(42);
    ctx.fillStyle = '#ffffff08';
    for (let i = 0; i < 200; i++) {
      const x = rng() * canvas.width;
      const y = rng() * canvas.height;
      const r = rng() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHyperlanes() {
    const { ctx } = this;

    for (const lane of this.hyperlanes) {
      const sysA = this.systems.find(s => s.id === lane.systemA);
      const sysB = this.systems.find(s => s.id === lane.systemB);
      if (!sysA || !sysB) continue;

      const a = this.worldToScreen(sysA.x, sysA.y);
      const b = this.worldToScreen(sysB.x, sysB.y);

      const aExplored = this.exploredSystems.has(sysA.id);
      const bExplored = this.exploredSystems.has(sysB.id);

      if (!aExplored && !bExplored) continue; // Fog of war

      ctx.strokeStyle = (aExplored && bExplored) ? '#1a1a4a' : '#0d0d2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawSystems() {
    const { ctx } = this;

    for (const sys of this.systems) {
      const explored = this.exploredSystems.has(sys.id);
      if (!explored) {
        // Show as dim dot if adjacent to explored
        const adjacent = this.hyperlanes.some(
          l => (l.systemA === sys.id || l.systemB === sys.id) &&
               (this.exploredSystems.has(l.systemA) || this.exploredSystems.has(l.systemB))
        );
        if (!adjacent) continue;
      }

      const pos = this.worldToScreen(sys.x, sys.y);
      const isSelected = this.selectedSystem?.id === sys.id;
      const isHovered = this.hoveredSystem?.id === sys.id;

      // Star glow
      const starColor = explored ? (STAR_COLORS[sys.starType] || '#ffffff') : '#333355';
      const baseRadius = explored ? 5 : 3;
      const radius = (baseRadius + (isSelected ? 3 : 0) + (isHovered ? 2 : 0)) * this.zoom;

      if (explored) {
        // Glow
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 3);
        gradient.addColorStop(0, starColor + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Star dot
      ctx.fillStyle = starColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#5577cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Starbase indicator
      if (explored && sys.starbase) {
        const ownerColor = this.getEmpireColor(sys.starbase.ownerId);
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Draw diamond
        const d = radius + 8;
        ctx.moveTo(pos.x, pos.y - d);
        ctx.lineTo(pos.x + d, pos.y);
        ctx.lineTo(pos.x, pos.y + d);
        ctx.lineTo(pos.x - d, pos.y);
        ctx.closePath();
        ctx.stroke();
      }

      // System name (only when zoomed in)
      if (explored && this.zoom > 0.6) {
        ctx.fillStyle = '#6666aa';
        ctx.font = `${Math.max(9, 11 * this.zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(sys.name, pos.x, pos.y + radius + 14);
      }
    }
  }

  drawShips() {
    const { ctx } = this;

    // Group ships by system
    const shipsBySystem = new Map();
    for (const ship of this.ships) {
      if (!ship.isAlive) continue;
      const sysId = ship.targetSystemId || ship.systemId;
      const list = shipsBySystem.get(ship.systemId) || [];
      list.push(ship);
      shipsBySystem.set(ship.systemId, list);
    }

    for (const [systemId, ships] of shipsBySystem) {
      const system = this.systems.find(s => s.id === systemId);
      if (!system) continue;
      if (!this.exploredSystems.has(systemId)) continue;

      const pos = this.worldToScreen(system.x, system.y);

      ships.forEach((ship, i) => {
        const angle = (i / ships.length) * Math.PI * 2 - Math.PI / 2;
        const orbitRadius = 12 * this.zoom;
        const sx = pos.x + Math.cos(angle) * orbitRadius;
        const sy = pos.y + Math.sin(angle) * orbitRadius;

        const color = this.getEmpireColor(ship.ownerId);
        const isSelected = this.selectedShip?.id === ship.id;

        // Ship triangle
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = color;
        ctx.strokeStyle = isSelected ? '#ffffff' : 'transparent';
        ctx.lineWidth = 1;

        const size = 4 * this.zoom;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.7, size * 0.5);
        ctx.lineTo(-size * 0.7, size * 0.5);
        ctx.closePath();
        ctx.fill();
        if (isSelected) ctx.stroke();

        ctx.restore();
      });

      // Ship count badge (when zoomed out)
      if (this.zoom < 0.8 && ships.length > 1) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `${9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ships.length.toString(), pos.x + 15, pos.y - 10);
      }
    }

    // Draw ships in transit
    for (const ship of this.ships) {
      if (!ship.isAlive || !ship.targetSystemId || ship.travelProgress <= 0) continue;

      const from = this.systems.find(s => s.id === ship.systemId);
      const to = this.systems.find(s => s.id === ship.targetSystemId);
      if (!from || !to) continue;

      const fromPos = this.worldToScreen(from.x, from.y);
      const toPos = this.worldToScreen(to.x, to.y);
      const p = ship.travelProgress;
      const x = fromPos.x + (toPos.x - fromPos.x) * p;
      const y = fromPos.y + (toPos.y - fromPos.y) * p;

      const color = this.getEmpireColor(ship.ownerId);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3 * this.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTooltip() {
    if (!this.hoveredSystem || this.isDragging) return;

    const { ctx } = this;
    const sys = this.hoveredSystem;
    const pos = this.worldToScreen(sys.x, sys.y);

    const explored = this.exploredSystems.has(sys.id);
    const text = explored
      ? `${sys.name} (${sys.starType}) - ${sys.planets.length} planets`
      : 'Unknown System';

    ctx.fillStyle = '#0a0a1aee';
    ctx.strokeStyle = '#2a2a5a';
    const metrics = ctx.measureText(text);
    const padding = 8;
    const w = metrics.width + padding * 2;
    const h = 24;
    const tx = pos.x - w / 2;
    const ty = pos.y - 35;

    ctx.fillRect(tx, ty, w, h);
    ctx.strokeRect(tx, ty, w, h);

    ctx.fillStyle = '#c8c8e0';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, pos.x, ty + 16);
  }

  getEmpireColor(empireId) {
    const empire = this.empires.find(e => e.id === empireId);
    return empire?.color || '#888888';
  }

  centerOnSystem(system) {
    this.camX = -system.x;
    this.camY = -system.y;
    this.render();
  }
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
