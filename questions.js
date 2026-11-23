'use strict';
/* Past-paper style questions: same interactive game as the main page (app.js), but with fixed graphs. */

/**
 * Build question k (0-based) for app.js. Dijkstra questions ask for the distance to every node, so the game
 * runs until the furthest node is finalised (by then every node has its shortest distance in the table).
 */
function fixedGame(k) {
  const q = QUESTIONS[k];
  const graph = buildQuestion(q);
  if (!graph.goal) {
    const d = allDistances(graph);
    graph.goal = Object.keys(d).sort((a, b) => d[b] - d[a])[0];
  }
  return { graph, sol: solve(graph), num: k + 1, text: q.text };
}

QUESTIONS.forEach((q, k) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('role', 'tab');
  b.dataset.q = k + 1;
  b.textContent = `Question ${k + 1}`;
  b.title = q.algo === 'astar' ? 'A* algorithm' : 'Dijkstra’s algorithm';
  document.getElementById('qtabs').appendChild(b);
});
