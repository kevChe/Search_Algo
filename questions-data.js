'use strict';
/*
 * Five fixed exam-style questions modelled on the CIE 9618 past-paper questions.
 * nodes: id -> [x, y, h]   (x, y are SVG coordinates in a 660 x 400 viewBox; h is used by A* only)
 * edges: [a, b, weight]
 * names: optional display names for nodes (the paper calls them Begin, Start, End, Home, School ...)
 */
const QUESTIONS = [
  { algo: 'dijkstra', start: 'Begin',
    text: 'Calculate the shortest distance between the Begin node and each of the nodes in the diagram using Dijkstra\u2019s algorithm.',
    nodes: { Begin: [70, 200], P: [200, 80], Q: [200, 320], S: [380, 80], R: [380, 320], U: [560, 80], T: [560, 320] },
    edges: [['Begin','P',5],['Begin','Q',6],['P','Q',2],['P','S',9],['Q','R',4],['R','S',3],['R','T',8],['S','U',6],['T','U',5]] },

  { algo: 'dijkstra', start: 'Start',
    text: 'Calculate the shortest distance between the Start node and each of the nodes in the graph using Dijkstra\u2019s algorithm.',
    nodes: { Start: [70, 200], T: [190, 80], V: [190, 320], W: [340, 80], X: [340, 320], Y: [490, 200], Z: [600, 320] },
    edges: [['Start','T',4],['Start','V',8],['T','W',3],['T','X',7],['V','X',2],['W','Y',6],['X','Y',4],['X','Z',9],['Y','Z',3]] },

  { algo: 'dijkstra', start: 'Start',
    text: 'Calculate the shortest distance between the Start and each of the destinations in the diagram using Dijkstra\u2019s algorithm.',
    nodes: { Start: [70, 200], A: [220, 80], B: [220, 320], C: [380, 80], D: [380, 320], E: [540, 80], F: [540, 320] },
    edges: [['Start','A',6],['Start','B',3],['A','B',2],['B','D',5],['A','C',4],['C','E',6],['D','E',3],['D','F',9],['E','F',2]] },

  { algo: 'astar', start: 'W', goal: 'E',
    text: 'The A* algorithm is used to perform searches on a graph. Calculate the best path between the W and E nodes on the following diagram using the A* algorithm.',
    nodes: { W: [60, 200, 17], N1: [190, 70, 13], N2: [190, 330, 13], N3: [340, 70, 8], N4: [340, 200, 6], N5: [340, 330, 6], N6: [490, 130, 4], E: [600, 250, 0] },
    edges: [['W','N1',6],['W','N2',4],['N1','N3',5],['N1','N4',8],['N2','N4',7],['N2','N5',6],['N3','N6',4],['N4','N6',3],['N5','E',9],['N6','E',4]] },

  { algo: 'astar', start: 'Home', goal: 'School',
    text: 'Find a path between the Home and School nodes using the A* algorithm.',
    nodes: { Home: [60, 200, 15], A: [190, 70, 12], B: [190, 330, 9], C: [340, 70, 8], D: [340, 200, 8], E: [340, 330, 7], F: [490, 200, 5], School: [610, 200, 0] },
    edges: [['Home','A',3],['Home','B',5],['A','C',4],['A','D',6],['B','D',3],['B','E',7],['C','F',5],['D','F',5],['E','F',2],['F','School',6]] },
];

/** Build the adjacency structure and solve it (solve() is defined in logic.js). */
function buildQuestion(q) {
  const ids = Object.keys(q.nodes);
  const nodes = ids.map(id => ({ id, x: q.nodes[id][0], y: q.nodes[id][1], h: q.algo === 'astar' ? q.nodes[id][2] : 0 }));
  const adj = {};
  ids.forEach(id => { adj[id] = []; });
  q.edges.forEach(([a, b, w]) => { adj[a].push({ to: b, w }); adj[b].push({ to: a, w }); });
  const graph = { algo: q.algo, nodes, edges: q.edges.map(([a, b, w]) => ({ a, b, w })), adj, start: q.start, goal: q.goal || null };
  return graph;
}
if (typeof module !== 'undefined') module.exports = { QUESTIONS, buildQuestion };
