'use strict';
/*
 * Graph generation + Dijkstra / A* solver (no DOM code in here).
 * generate(seed, algo) is deterministic: the same seed and algo always give the same graph.
 */

const COLS = 5, ROWS = 4;      // grid that node positions are picked from
const SCALE = 2;               // A*: edge weight >= SCALE * straight-line length, h = floor(SCALE * straight-line to goal)

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const euclid = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
function properCross(p1, p2, p3, p4) {
  const d1 = orient(p3, p4, p1), d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3), d4 = orient(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
function onSegment(p, q, r) {
  if (orient(p, q, r) !== 0) return false;
  return Math.min(p.x, q.x) <= r.x && r.x <= Math.max(p.x, q.x) &&
         Math.min(p.y, q.y) <= r.y && r.y <= Math.max(p.y, q.y);
}

/** One attempt at building a graph. Returns null if it fails any rule. */
function tryBuild(rng, algo) {
  const n = 6 + Math.floor(rng() * 3);               // 6..8 nodes
  const cells = [];
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) cells.push({ x, y });
  const pts = shuffle(cells, rng).slice(0, n);

  const cand = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = euclid(pts[i], pts[j]);
    if (d <= 2.3) cand.push({ i, j, d, key: d * (0.6 + rng()) });
  }
  cand.sort((a, b) => a.key - b.key);

  const edges = [];
  const has = new Set();
  const parent = [...Array(n).keys()];
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const ok = (i, j) => {
    for (let k = 0; k < n; k++) if (k !== i && k !== j && onSegment(pts[i], pts[j], pts[k])) return false;
    for (const e of edges) {
      if (e.i === i || e.i === j || e.j === i || e.j === j) continue;
      if (properCross(pts[i], pts[j], pts[e.i], pts[e.j])) return false;
    }
    return true;
  };
  const add = c => { edges.push({ i: c.i, j: c.j, d: c.d }); has.add(c.i + ',' + c.j); };

  for (const c of cand) {
    if (find(c.i) !== find(c.j) && ok(c.i, c.j)) { add(c); parent[find(c.i)] = find(c.j); }
  }
  if (edges.length !== n - 1) return null;            // not connected

  let extra = 1 + Math.floor(rng() * 3);               // 1..3 extra edges (gives cycles)
  for (const c of cand) {
    if (!extra) break;
    if (has.has(c.i + ',' + c.j)) continue;
    if (ok(c.i, c.j)) { add(c); extra--; }
  }

  for (const e of edges) {
    e.w = algo === 'astar'
      ? Math.ceil(SCALE * e.d - 1e-9) + Math.floor(rng() * 3)
      : 1 + Math.floor(rng() * 9);
  }

  // start = random node, goal = farthest node (plain Dijkstra on indices)
  const start = Math.floor(rng() * n);
  const dd = Array(n).fill(Infinity), seen = Array(n).fill(false);
  dd[start] = 0;
  for (let r = 0; r < n; r++) {
    let u = -1;
    for (let k = 0; k < n; k++) if (!seen[k] && (u < 0 || dd[k] < dd[u])) u = k;
    seen[u] = true;
    for (const e of edges) {
      const v = e.i === u ? e.j : e.j === u ? e.i : -1;
      if (v >= 0 && dd[u] + e.w < dd[v]) dd[v] = dd[u] + e.w;
    }
  }
  let goal = start;
  for (let k = 0; k < n; k++) if (dd[k] > dd[goal]) goal = k;
  if (edges.some(e => (e.i === start && e.j === goal) || (e.i === goal && e.j === start))) return null;

  // labels: start = A, goal = last letter, others shuffled in between
  const labels = Array(n);
  labels[start] = 'A';
  labels[goal] = String.fromCharCode(65 + n - 1);
  const others = shuffle([...Array(n).keys()].filter(k => k !== start && k !== goal), rng);
  others.forEach((k, idx) => { labels[k] = String.fromCharCode(66 + idx); });

  const nodes = pts.map((p, k) => ({
    id: labels[k], x: p.x, y: p.y,
    h: algo === 'astar' ? Math.floor(SCALE * euclid(p, pts[goal]) + 1e-9) : 0,
  })).sort((a, b) => (a.id < b.id ? -1 : 1));
  const es = edges.map(e => {
    const a = labels[e.i], b = labels[e.j];
    return a < b ? { a, b, w: e.w } : { a: b, b: a, w: e.w };
  });
  const adj = {};
  nodes.forEach(nd => { adj[nd.id] = []; });
  es.forEach(e => { adj[e.a].push({ to: e.b, w: e.w }); adj[e.b].push({ to: e.a, w: e.w }); });
  Object.values(adj).forEach(l => l.sort((p, q) => (p.to < q.to ? -1 : 1)));

  return { algo, nodes, edges: es, adj, start: labels[start], goal: labels[goal] };
}

/**
 * Run the algorithm. Returns null if there is ANY tie (equal working values on update,
 * or two nodes sharing the lowest key), so every step has exactly one correct answer.
 */
function solve(graph) {
  const { adj, start, goal, algo } = graph;
  const hOf = {};
  graph.nodes.forEach(n => { hOf[n.id] = n.h; });
  const g = { [start]: 0 }, prev = {}, done = new Set(), steps = [];
  const key = id => (algo === 'astar' ? g[id] + hOf[id] : g[id]);
  let cur = start;
  for (;;) {
    done.add(cur);
    const step = { node: cur, g: g[cur], h: hOf[cur], f: g[cur] + hOf[cur], updates: [] };
    steps.push(step);
    if (cur === goal) break;
    for (const { to, w } of adj[cur]) {
      if (done.has(to)) continue;
      const ng = g[cur] + w;
      if (g[to] === undefined || ng < g[to]) { g[to] = ng; prev[to] = cur; }
      else if (ng === g[to]) return null;              // tie on update
      step.updates.push({ node: to, g: g[to], h: hOf[to], f: g[to] + hOf[to], w });
    }
    const open = Object.keys(g).filter(id => !done.has(id)).sort((p, q) => key(p) - key(q));
    if (!open.length) return null;
    if (open.length > 1 && key(open[0]) === key(open[1])) return null;   // tie on selection
    cur = open[0];
  }
  const path = [goal];
  while (path[0] !== start) path.unshift(prev[path[0]]);
  return { steps, prev, path, cost: g[goal] };
}

function generate(seed, algo) {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const graph = tryBuild(rng, algo);
    if (!graph) continue;
    const sol = solve(graph);
    if (sol && sol.steps.length >= 4) return { graph, sol };
  }
  throw new Error('Could not generate a graph for seed ' + seed);
}

if (typeof module !== 'undefined') module.exports = { generate, solve, SCALE };
