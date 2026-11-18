// Sunset Harbor — seeded city generation, roads, buildings, collision.
'use strict';

var World = {
  buildings: [],   // {x,y,w,h,color,roof}
  trees: [],       // {x,y,r}
  piers: [],       // {x,y,w,h} wooden piers over the marina water
  lamps: [],       // {x,y} street lamps (visual)

  build: function (seed) {
    var rng = makeRng(hashSeed('sunset-harbor-world-' + seed));
    this.buildings = [];
    this.trees = [];
    this.piers = [];
    this.lamps = [];
    var vRoads = CFG.ROADS_V, hRoads = CFG.ROADS_H, hw = CFG.ROAD_W / 2;

    // Block x-ranges between vertical roads (plus the two edge strips).
    var xBlocks = [];
    xBlocks.push([0, vRoads[0] - hw]);
    for (var i = 0; i < vRoads.length - 1; i++) xBlocks.push([vRoads[i] + hw, vRoads[i + 1] - hw]);
    xBlocks.push([vRoads[vRoads.length - 1] + hw, CFG.MARINA_X]);
    // Block y-ranges between horizontal roads.
    var yBlocks = [];
    yBlocks.push([0, hRoads[0] - hw]);
    for (var j = 0; j < hRoads.length - 1; j++) yBlocks.push([hRoads[j] + hw, hRoads[j + 1] - hw]);
    yBlocks.push([hRoads[hRoads.length - 1] + hw, CFG.BEACH_Y]);

    for (var bx = 0; bx < xBlocks.length; bx++) {
      for (var by = 0; by < yBlocks.length; by++) {
        var xb = xBlocks[bx], yb = yBlocks[by];
        // Central park block (between roads 960-1600, 900-1500): trees only.
        var isPark = (xb[0] >= 960 && xb[1] <= 1600 && yb[0] >= 900 && yb[1] <= 1500);
        if (isPark) {
          for (var t = 0; t < 26; t++) {
            this.trees.push({
              x: rng.range(xb[0] + 30, xb[1] - 30),
              y: rng.range(yb[0] + 30, yb[1] - 30),
              r: rng.range(13, 22),
            });
          }
          continue;
        }
        // Marina strip (east edge) and beach strip: no buildings.
        if (xb[0] >= CFG.MARINA_X - 1 || yb[0] >= CFG.BEACH_Y - 1) continue;
        var bw = xb[1] - xb[0], bh = yb[1] - yb[0];
        if (bw < 90 || bh < 90) continue;
        // 1-3 buildings per block, placed on a rough grid with jitter.
        var cols = bw > 380 ? 2 : 1;
        var rows = bh > 380 ? 2 : 1;
        for (var cx = 0; cx < cols; cx++) {
          for (var cy = 0; cy < rows; cy++) {
            if (rng.chance(0.18)) continue; // occasional plaza / empty lot
            var cellW = bw / cols, cellH = bh / rows;
            var w = rng.range(cellW * 0.45, cellW * 0.78);
            var h = rng.range(cellH * 0.45, cellH * 0.78);
            var x = xb[0] + cx * cellW + (cellW - w) / 2 + rng.range(-8, 8);
            var y = yb[0] + cy * cellH + (cellH - h) / 2 + rng.range(-8, 8);
            this.buildings.push({
              x: x, y: y, w: w, h: h,
              color: rng.pick(PAL.buildingWall),
              roof: rng.pick(PAL.buildingRoof),
              shade: rng.range(0.85, 1.05),
            });
          }
        }
        // A few trees on the block corners.
        for (var k = 0; k < 3; k++) {
          if (rng.chance(0.6)) {
            this.trees.push({
              x: rng.range(xb[0] + 15, xb[1] - 15),
              y: rng.range(yb[0] + 15, yb[1] - 15),
              r: rng.range(10, 16),
            });
          }
        }
      }
    }

    // Marina piers: 4 wooden walkways east of x=3020.
    var pierYs = [500, 1000, 1500, 1900];
    for (var p = 0; p < pierYs.length; p++) {
      this.piers.push({ x: CFG.MARINA_X, y: pierYs[p] - 12, w: 150, h: 24 });
    }

    // Street lamps along the roads (visual only).
    for (var vi = 0; vi < vRoads.length; vi++) {
      for (var y = 140; y < CFG.BEACH_Y; y += 260) {
        this.lamps.push({ x: vRoads[vi] + hw + 8, y: y });
      }
    }
    for (var hi = 0; hi < hRoads.length; hi++) {
      for (var x = 140; x < CFG.MARINA_X; x += 260) {
        this.lamps.push({ x: x, y: hRoads[hi] + hw + 8 });
      }
    }
  },

  // Is a point on a road (including intersections)?
  isOnRoad: function (x, y) {
    var hw = CFG.ROAD_W / 2;
    for (var i = 0; i < CFG.ROADS_V.length; i++) {
      if (Math.abs(x - CFG.ROADS_V[i]) <= hw) return true;
    }
    for (var j = 0; j < CFG.ROADS_H.length; j++) {
      if (Math.abs(y - CFG.ROADS_H[j]) <= hw) return true;
    }
    return false;
  },

  // Is a point on the sidewalk strip beside a road?
  isSidewalk: function (x, y) {
    var hw = CFG.ROAD_W / 2, sw = 26;
    for (var i = 0; i < CFG.ROADS_V.length; i++) {
      var d = Math.abs(x - CFG.ROADS_V[i]);
      if (d > hw && d <= hw + sw) return true;
    }
    for (var j = 0; j < CFG.ROADS_H.length; j++) {
      var d2 = Math.abs(y - CFG.ROADS_H[j]);
      if (d2 > hw && d2 <= hw + sw) return true;
    }
    return false;
  },

  isWater: function (x, y) {
    if (y >= CFG.SEA_Y) return true;
    if (x >= CFG.MARINA_X && y < CFG.BEACH_Y) {
      // Piers are walkable over the marina water.
      for (var i = 0; i < this.piers.length; i++) {
        var p = this.piers[i];
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return false;
      }
      return true;
    }
    return false;
  },

  isBeach: function (x, y) { return y >= CFG.BEACH_Y && y < CFG.SEA_Y && x < CFG.MARINA_X; },

  // Nearest road centre point to (x,y) — used for police spawns.
  nearestRoadPoint: function (x, y) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < CFG.ROADS_V.length; i++) {
      var d = Math.abs(x - CFG.ROADS_V[i]);
      if (d < bestD) { bestD = d; best = { x: CFG.ROADS_V[i], y: clamp(y, 80, CFG.BEACH_Y - 60) }; }
    }
    for (var j = 0; j < CFG.ROADS_H.length; j++) {
      var d2 = Math.abs(y - CFG.ROADS_H[j]);
      if (d2 < bestD) { bestD = d2; best = { x: clamp(x, 80, CFG.MARINA_X - 60), y: CFG.ROADS_H[j] }; }
    }
    return best || { x: 1600, y: 900 };
  },

  // Circle vs building rects: returns true if the circle overlaps a building.
  hitsBuilding: function (x, y, r) {
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      var cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
      if (dist2(x, y, cx, cy) < r * r) return true;
    }
    return false;
  },

  // Move a circle by (dx,dy) with axis-separated sliding against buildings,
  // water and the world bounds. Mutates and returns the position object.
  moveCircle: function (pos, dx, dy, r, canSwim) {
    var nx = pos.x + dx;
    if (!this._blocked(nx, pos.y, r, canSwim)) pos.x = nx;
    var ny = pos.y + dy;
    if (!this._blocked(pos.x, ny, r, canSwim)) pos.y = ny;
    pos.x = clamp(pos.x, r, CFG.WORLD_W - r);
    pos.y = clamp(pos.y, r, CFG.WORLD_H - r);
    return pos;
  },

  _blocked: function (x, y, r, canSwim) {
    if (x < r || x > CFG.WORLD_W - r || y < r || y > CFG.WORLD_H - r) return true;
    if (!canSwim && this.isWater(x, y)) return true;
    return this.hitsBuilding(x, y, r);
  },

  // Random point on a road (for spawns).
  randomRoadPoint: function (rng) {
    if (rng.chance(0.5)) {
      return { x: rng.pick(CFG.ROADS_V), y: rng.range(120, CFG.BEACH_Y - 80) };
    }
    return { x: rng.range(120, CFG.MARINA_X - 80), y: rng.pick(CFG.ROADS_H) };
  },

  // Random sidewalk point (for pedestrians).
  randomSidewalkPoint: function (rng) {
    if (rng.chance(0.5)) {
      var vx = rng.pick(CFG.ROADS_V);
      return { x: vx + (rng.chance(0.5) ? 1 : -1) * (CFG.ROAD_W / 2 + 14), y: rng.range(120, CFG.BEACH_Y - 80) };
    }
    var hy = rng.pick(CFG.ROADS_H);
    return { x: rng.range(120, CFG.MARINA_X - 80), y: hy + (rng.chance(0.5) ? 1 : -1) * (CFG.ROAD_W / 2 + 14) };
  },
};
