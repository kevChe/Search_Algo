'use strict';
/* UI + interaction state machine. Graph generation / solving lives in logic.js. */

const CELL = 120, PAD = 60, R = 24;
const SVGNS = 'http://www.w3.org/2000/svg';
const $ = sel => document.querySelector(sel);

// S.phase: 'choose' -> click next node | 'update' -> type neighbour values | 'path' -> trace path | 'cost' -> type cost | 'done'
let S = null;
const isAstar = () => S.algo === 'astar';
// Random graphs sit on a grid; fixed past-paper questions give x, y directly in a 660 x 400 viewBox.
const px = n => (S.fixed ? n.x : PAD + n.x * CELL);
const py = n => (S.fixed ? n.y : PAD + n.y * CELL);
const nodeById = id => S.graph.nodes.find(n => n.id === id);

/* ---------- game setup ---------- */

/** `fixed` (optional) = { graph, sol, num, text } for a past-paper style question (see questions.js). */
function newGame(algo, seed, fixed) {
  const { graph, sol } = fixed || generate(seed, algo);
  algo = graph.algo;
  S = { algo, seed, graph, sol, fixed: !!fixed, num: fixed ? fixed.num : 0, phase: 'choose', idx: -1, done: new Set(), work: {}, prev: {}, order: {},
        mistakes: 0, trace: [], revealed: false };
  finalise(0);                                   // the start node is finalised automatically
  history.replaceState(null, '', fixed ? `?q=${fixed.num}` : `?algo=${algo}&seed=${seed}`);
  if ($('#seedInput')) $('#seedInput').value = seed;
  $('#btnReveal').disabled = false;
  document.querySelectorAll('.tabs button').forEach(b =>
    b.setAttribute('aria-selected', fixed ? Number(b.dataset.q) === fixed.num : b.dataset.algo === algo));
  const goal = graph.goal, start = graph.start;
  $('#question').textContent = fixed
    ? fixed.text + (isAstar()
        ? ` The number beside each node (h) is an estimate of the cost from that node to ${goal}. Click on the graph to work through the algorithm, then trace the best path from ${start} to ${goal}.`
        : ` Click on the graph to work through the algorithm until ${goal}, the furthest node, is finalised, then trace the shortest path from ${start} to ${goal}. The working table gives the shortest distance to every node.`)
    : isAstar()
    ? `The graph shows the cost of travelling between points. The number beside each node (h) is an estimate of the cost from that node to ${goal}. Use the A* algorithm (f = g + h) to find the shortest path from ${start} to ${goal}.`
    : `The graph shows the distances between points. Use Dijkstra's algorithm to find the shortest path from ${start} to ${goal}.`;
  $('#legend').innerHTML = '<li><i></i>not reached</li><li><i class="w"></i>has a working value</li><li><i class="f"></i>finalised</li><li><i class="g"></i>goal</li>';
  setFeedback('info', `Node ${start} is finalised to start with. Fill in the values for its neighbours.`);
  render();
}

/** Step i has been chosen correctly: mark the node finalised and move to the next phase. */
function finalise(i) {
  const step = S.sol.steps[i];
  S.idx = i;
  S.done.add(step.node);
  S.work[step.node] = { g: step.g, f: step.f };
  S.order[step.node] = i + 1;
  if (step.node === S.graph.goal) { S.phase = 'path'; S.trace = [step.node]; }
  else if (step.updates.length) S.phase = 'update';
  else S.phase = 'choose';
}

/** Neighbour values for the current step were entered correctly. */
function applyUpdates(i) {
  const step = S.sol.steps[i];
  step.updates.forEach(u => {
    const old = S.work[u.node];
    if (!old || u.g < old.g) S.prev[u.node] = step.node;     // only a strictly better route changes the previous node
    S.work[u.node] = { g: u.g, f: u.f };
  });
  S.phase = 'choose';
}

/* ---------- feedback ---------- */

function setFeedback(kind, content) {
  const box = $('#feedback');
  box.className = 'feedback ' + kind;
  box.textContent = '';
  if (Array.isArray(content)) {
    const ul = document.createElement('ul');
    content.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    box.appendChild(ul);
  } else box.textContent = content;
  // Re-trigger a short entrance so repeated feedback (e.g. two wrong clicks in a row) still registers.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    box.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
      { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }
}
function mistake() { S.mistakes++; $('#mistakes').textContent = S.mistakes; }
const keyName = () => (isAstar() ? 'f value (g + h)' : 'working distance');

/* ---------- clicking nodes ---------- */

function onNodeClick(id) {
  if (S.revealed) return;
  if (S.phase === 'choose') {
    const expected = S.sol.steps[S.idx + 1].node;
    if (id === expected) {
      finalise(S.idx + 1);
      setFeedback('ok', `Correct: ${id} is the unfinalised node with the smallest ${keyName()}.` +
        (S.phase === 'path' ? ' The goal has been reached!' : ''));
      render();
      return;
    }
    mistake();
    let msg;
    if (S.done.has(id)) msg = `Wrong node: ${id} has already been finalised.`;
    else if (!S.work[id]) msg = `Wrong node: ${id} has not been reached yet, so it has no working value. Only nodes that have been given a value can be chosen.`;
    else msg = `Wrong node: ${id} is not the best choice. Another unfinalised node has a smaller ${keyName()}.`;
    setFeedback('bad', msg);
    flash(id);
  } else if (S.phase === 'update') {
    setFeedback('info', `Fill in the working values for the neighbours of ${S.sol.steps[S.idx].node} first.`);
  } else if (S.phase === 'path') {
    const last = S.trace[S.trace.length - 1];
    const expected = S.sol.prev[last];
    if (id === expected) {
      S.trace.push(id);
      if (id === S.graph.start) {
        S.phase = 'cost';
        setFeedback('ok', 'Correct: that is the whole path. Now enter its total cost.');
      } else setFeedback('ok', `Correct: ${id} came before ${last}. Keep going back towards A.`);
      render();
      return;
    }
    mistake();
    setFeedback('bad', S.trace.includes(id)
      ? `${id} is already in your path.`
      : `Wrong node: ${id} is not the node that ${last} was reached from. Check the Previous column of the table for ${last}.`);
    flash(id);
  } else if (S.phase === 'cost') {
    setFeedback('info', 'Enter the total cost of the path below.');
  }
}

function flash(id) {
  const el = document.querySelector(`.node[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 800);
}

/* ---------- checking typed values ---------- */

const parseNum = s => (/^\s*\d+\s*$/.test(s) ? parseInt(s, 10) : null);
function mark(input, ok) { input.classList.toggle('ok', ok); input.classList.toggle('bad', !ok); }

function checkUpdates(form) {
  const step = S.sol.steps[S.idx];
  const msgs = [];
  let allOk = true;
  for (const u of step.updates) {
    const existing = S.work[u.node];
    const gi = form.elements['g_' + u.node];
    const gv = parseNum(gi.value);
    const gOk = gv === u.g;
    mark(gi, gOk);
    if (!gOk) {
      allOk = false;
      msgs.push(gv === null
        ? `${u.node}: enter a whole number.`
        : `${u.node}: ${isAstar() ? 'g' : 'distance'} is not right. New value via ${step.node} = (${step.node}'s final value${isAstar() ? ' of g' : ''}) + (weight of edge ${step.node}–${u.node}). Keep the smaller of that and ${u.node}'s existing value (${existing ? existing.g : 'none yet'}).`);
    }
    if (isAstar()) {
      const fi = form.elements['f_' + u.node];
      const fv = parseNum(fi.value);
      const fOk = fv === u.f;
      mark(fi, fOk);
      if (!fOk) {
        allOk = false;
        msgs.push(fv === null ? `${u.node}: enter a whole number for f.` : `${u.node}: f is not right. f = g + h, and h(${u.node}) = ${u.h}.`);
      }
    }
  }
  if (allOk) {
    applyUpdates(S.idx);
    setFeedback('ok', 'All values correct. Now click the next node to finalise.');
    render();
  } else {
    mistake();
    setFeedback('bad', msgs);
  }
}

function checkCost(form) {
  const input = form.elements.cost;
  const v = parseNum(input.value);
  if (v === S.sol.cost) {
    mark(input, true);
    S.phase = 'done';
    setFeedback('ok', `Well done! Shortest path ${S.sol.path.join(' → ')} with cost ${S.sol.cost}. ` +
      (S.mistakes === 0 ? 'No mistakes!' : `You made ${S.mistakes} mistake${S.mistakes === 1 ? '' : 's'}. Try a new graph or retry this seed.`));
    $('#btnReveal').disabled = true;
    render();
  } else {
    mark(input, false);
    mistake();
    setFeedback('bad', v === null ? 'Enter a whole number.'
      : 'Not the right cost. Add up the edge weights along the path you traced' + (isAstar() ? ' (the cost is the total path length, not an f value).' : '.'));
  }
}

/* ---------- show answer ---------- */

function reveal() {
  if (S.phase === 'done') return;
  if (S.phase === 'update') applyUpdates(S.idx);
  while (S.phase === 'choose') {
    finalise(S.idx + 1);
    if (S.phase === 'update') applyUpdates(S.idx);
  }
  S.trace = [...S.sol.path].reverse();
  S.phase = 'done';
  S.revealed = true;
  setFeedback('info', `Solution: the nodes are finalised in the order shown in the table. The shortest path is ${S.sol.path.join(' → ')} with cost ${S.sol.cost}.`);
  $('#btnReveal').disabled = true;
  render();
}

/* ---------- rendering ---------- */

function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}

function badge(g, cx, cy, text, cls) {
  const w = text.length * 7.5 + 14;
  const b = svg('g', { class: 'badge ' + cls });
  b.appendChild(svg('rect', { x: cx - w / 2, y: cy - 10, width: w, height: 20, rx: 6 }));
  b.appendChild(svg('text', { x: cx, y: cy }, text));
  g.appendChild(b);
}

function renderGraph() {
  const el = $('#graph');
  el.textContent = '';
  const gr = S.graph;
  el.setAttribute('viewBox', S.fixed ? '0 0 660 400' : `0 0 ${(4) * CELL + 2 * PAD} ${(3) * CELL + 2 * PAD}`);
  const onPathEdge = (a, b) => {
    for (let i = 1; i < S.trace.length; i++) {
      const p = S.trace[i - 1], q = S.trace[i];
      if ((p === a && q === b) || (p === b && q === a)) return true;
    }
    return false;
  };
  gr.edges.forEach(e => {
    const A = nodeById(e.a), B = nodeById(e.b);
    el.appendChild(svg('line', { class: 'edge' + (onPathEdge(e.a, e.b) ? ' onpath' : ''), x1: px(A), y1: py(A), x2: px(B), y2: py(B) }));
  });
  gr.edges.forEach(e => {
    const A = nodeById(e.a), B = nodeById(e.b);
    el.appendChild(svg('text', { class: 'wlabel', x: (px(A) + px(B)) / 2, y: (py(A) + py(B)) / 2 }, e.w));
  });
  const clickable = !S.revealed && (S.phase === 'choose' || S.phase === 'path');
  const currentId = S.phase === 'update' || S.phase === 'choose' ? S.sol.steps[S.idx].node : null;
  gr.nodes.forEach(n => {
    const w = S.work[n.id];
    const cls = ['node'];
    if (S.done.has(n.id)) cls.push('final'); else if (w) cls.push('working');
    if (S.trace.includes(n.id)) cls.push('onpath');
    if (n.id === currentId) cls.push('current');
    if (clickable) cls.push('clickable');
    const g = svg('g', { class: cls.join(' '), 'data-id': n.id, tabindex: clickable ? 0 : -1, role: 'button',
      'aria-label': `Node ${n.id}` + (w ? `, ${S.done.has(n.id) ? 'finalised' : 'working'} ${isAstar() ? 'g ' + w.g + ' f ' + w.f : w.g}` : ', not reached') });
    if (n.id === gr.goal) g.appendChild(svg('circle', { class: 'goalring', cx: px(n), cy: py(n), r: R + 6 }));
    g.appendChild(svg('circle', { class: 'body', cx: px(n), cy: py(n), r: R }));
    g.appendChild(svg('text', { class: 'nlabel' + (n.id.length > 4 ? ' tiny' : n.id.length > 2 ? ' small' : ''), x: px(n), y: py(n) }, n.id));
    if (w) badge(g, px(n), py(n) - R - 16, isAstar() ? `g=${w.g} f=${w.f}` : String(w.g), S.done.has(n.id) ? 'final' : 'working');
    if (isAstar()) g.appendChild(svg('text', { class: 'hlabel', x: px(n), y: py(n) + R + 18 }, `h=${n.h}`));
    g.addEventListener('click', () => onNodeClick(n.id));
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onNodeClick(n.id); } });
    el.appendChild(g);
  });
}

function renderTask() {
  const box = $('#task');
  box.textContent = '';
  box.className = 'card task';
  const title = (t) => { const p = document.createElement('p'); p.className = 'task-title'; p.textContent = t; box.appendChild(p); };
  const para = (t) => { const p = document.createElement('p'); p.textContent = t; box.appendChild(p); };

  if (S.phase === 'choose') {
    title(`Step ${S.idx + 2}: choose the next node`);
    para(`Click the unfinalised node with the smallest ${keyName()}.`);
  } else if (S.phase === 'update') {
    const step = S.sol.steps[S.idx];
    title(`Node ${step.node} is finalised (${isAstar() ? 'g = ' + step.g + ', f = ' + step.f : 'distance ' + step.g})`);
    para(isAstar()
      ? `Enter g and f for each unfinalised neighbour of ${step.node}. If a node already had a smaller g, keep its old values.`
      : `Enter the working distance for each unfinalised neighbour of ${step.node}. If a node already had a smaller value, keep it.`);
    const form = document.createElement('form');
    form.className = 'upd';
    step.updates.forEach(u => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<b>${u.node}</b>`;
      const mk = (name, label) => {
        const l = document.createElement('label');
        l.textContent = label + ' ';
        const inp = document.createElement('input');
        inp.type = 'text'; inp.name = name; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
        l.appendChild(inp);
        row.appendChild(l);
      };
      mk('g_' + u.node, isAstar() ? 'g =' : 'distance =');
      if (isAstar()) {
        const h = document.createElement('span');
        h.textContent = `h = ${u.h}`;
        row.appendChild(h);
        mk('f_' + u.node, 'f =');
      }
      form.appendChild(row);
    });
    const btn = document.createElement('button');
    btn.type = 'submit'; btn.textContent = 'Check';
    form.appendChild(btn);
    form.addEventListener('submit', ev => { ev.preventDefault(); checkUpdates(form); });
    box.appendChild(form);
    const first = form.querySelector('input');
    if (first) setTimeout(() => first.focus(), 0);
  } else if (S.phase === 'path') {
    title('Goal reached: trace the shortest path');
    para(`Starting from ${S.graph.goal}, click the node it was reached from, and keep going back until you reach ${S.graph.start}.`);
    para('Path so far: ' + [...S.trace].reverse().join(' → '));
  } else if (S.phase === 'cost') {
    title('Total cost');
    para(`Path: ${S.trace.slice().reverse().join(' → ')}`);
    const form = document.createElement('form');
    form.className = 'costform';
    form.innerHTML = '<label>Total cost = <input type="text" name="cost" inputmode="numeric" autocomplete="off"></label> ';
    const btn = document.createElement('button');
    btn.type = 'submit'; btn.textContent = 'Check';
    form.appendChild(btn);
    form.addEventListener('submit', ev => { ev.preventDefault(); checkCost(form); });
    box.appendChild(form);
    setTimeout(() => form.elements.cost.focus(), 0);
  } else {
    title(S.revealed ? 'Answer shown' : 'Complete!');
    para(`Shortest path: ${S.sol.path.join(' → ')}, cost ${S.sol.cost}.`);
  }
}

function renderTable() {
  const box = $('#tableWrap');
  box.textContent = '';
  const t = document.createElement('table');
  const cap = document.createElement('caption');
  cap.textContent = 'Working table';
  t.appendChild(cap);
  const head = isAstar() ? ['Node', 'g', 'h', 'f', 'Previous'] : ['Node', 'Distance', 'Previous'];
  const thead = document.createElement('tr');
  head.forEach(h => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
  t.appendChild(thead);
  S.graph.nodes.forEach(n => {
    const w = S.work[n.id];
    const g = w ? w.g : '∞';
    const prev = S.prev[n.id] || '–';
    const cells = isAstar() ? [n.id, g, n.h, w ? w.f : '∞', prev] : [n.id, g, prev];
    const tr = document.createElement('tr');
    if (S.done.has(n.id)) tr.className = 'finalised';
    cells.forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
    t.appendChild(tr);
  });
  box.appendChild(t);
}

function render() {
  renderGraph();
  renderTask();
  renderTable();
  $('#mistakes').textContent = S.mistakes;
}

/* ---------- wiring ---------- */

const randomSeed = () => 1 + Math.floor(Math.random() * 99999);

document.querySelectorAll('.tabs button').forEach(b =>
  b.addEventListener('click', () => {
    if (b.dataset.q) { if (Number(b.dataset.q) !== S.num) newGame(null, null, fixedGame(Number(b.dataset.q) - 1)); }
    else if (b.dataset.algo !== S.algo) newGame(b.dataset.algo, S.seed);
  }));
$('#btnNew')?.addEventListener('click', () => newGame(S.algo, randomSeed()));
$('#btnReveal').addEventListener('click', reveal);
$('#seedForm')?.addEventListener('submit', ev => {
  ev.preventDefault();
  const v = parseNum($('#seedInput').value);
  if (v === null) { setFeedback('bad', 'The seed must be a whole number.'); return; }
  newGame(S.algo, v);
});

(function init() {
  const p = new URLSearchParams(location.search);
  if (typeof QUESTIONS !== 'undefined') {                      // questions.html: the fixed past-paper style questions
    const n = parseInt(p.get('q'), 10);
    newGame(null, null, fixedGame(n >= 1 && n <= QUESTIONS.length ? n - 1 : 0));
    return;
  }
  const algo = p.get('algo') === 'astar' ? 'astar' : 'dijkstra';
  const seed = parseNum(p.get('seed') || '') ?? 2438;
  newGame(algo, seed);
})();
