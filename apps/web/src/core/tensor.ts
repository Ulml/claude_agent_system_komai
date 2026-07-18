/**
 * TENSEUR PRODUIT — le modèle systématique de chaque étape de modélisation.
 *
 * Règle (issue des notebooks de référence de l'utilisateur) : CHAQUE étape du
 * processus — planning général, planning détaillé, graphe des composants du
 * produit, graphe d'assemblage, matrices de grandeurs — est modélisée sous la
 * MÊME forme à 4 représentations :
 *   1. une MATRICE D'ADJACENCE            (adjacency)
 *   2. un GRAPHE                          (dérivé de l'adjacence — SSOT :
 *                                          jamais stocké séparément)
 *   3. une MATRICE DES UNITÉS             (units, même forme que adjacency)
 *   4. les LISTES DE DÉSIGNATIONS         (rows / cols des matrices)
 *
 * Le TENSEUR DE GRANDEURS empile ensuite des COUCHES (coût, masse, distance…)
 * — une valeur par composant et par couche — et le CUMUL propage chaque
 * couche le long du graphe d'assemblage (somme des descendants), donnant les
 * « graphes des grandeurs cumulées ».
 *
 * Ce fichier est 100 % agnostique du produit : uniquement des TYPES et des
 * FONCTIONS PURES (validation, propagation, extraction de graphe). Aucun nom
 * de composant, aucune valeur n'y est codée en dur.
 */

/* ------------------------------------------------------------------ */
/* The 4-representation step model                                      */
/* ------------------------------------------------------------------ */

export type StepKind =
  | 'planning'          // planning général du projet
  | 'planning-detail'   // raffinage de chaque étape du planning
  | 'product'           // graphe des composants du produit
  | 'assembly'          // graphe de l'assemblage
  | 'quantities';       // matrices de valeurs des grandeurs (composants × couches)

export interface MatrixModel {
  id: string;
  kind: StepKind;
  title: string;
  /** Désignations des lignes de la matrice (ex. composants, étapes). */
  rows: string[];
  /** Désignations des colonnes (souvent = rows ; couches pour 'quantities'). */
  cols: string[];
  /** Matrice d'adjacence (0/1 ou pondérée) — rows × cols. */
  adjacency: number[][];
  /** Matrice des unités — même forme que adjacency. */
  units: string[][];
  /** Graphe orienté ? (précédence/assemblage : oui ; liaisons : selon). */
  directed: boolean;
  /** Matrice de QUANTITÉS portée par les arêtes (même forme) — la matrice de
   *  contribution T des notebooks : T[i][j] = quantité de i par unité de j. */
  values?: number[][];
  /** Type de chaque nœud (étape/détail/sous-détail, composant/input/atelier,
   *  composant/étape/sous-ensemble/produit…) — légende du graphe. */
  nodeTypes?: string[];
}

/** Une COUCHE du tenseur : la grandeur FINALE (propagée) par nœud du graphe
 *  d'assemblage (prix €, masse kg, distance m — notebook Canopy). */
export interface TensorLayer {
  id: string;
  name: string;
  unit: string;
  /** Valeur finale par nœud — alignée sur assembly.rows. */
  final: number[];
}

/** Le modèle produit complet — la sortie de bout en bout du pipeline,
 *  conforme aux notebooks de référence (Eart_House + Canopy). */
export interface ProductModel {
  request: string;             // le produit demandé par l'utilisateur (libre)
  prd: string;                 // PRD/TRD markdown
  planning: MatrixModel;       // planning général (chaîne d'étapes)
  planningDetail: MatrixModel; // hiérarchie étape ← détail ← sous-détail
  conception: MatrixModel;     // inputs → composants → atelier de fabrication
  assembly: MatrixModel;       // composants → étapes → sous-ensembles → produit
                               //   values = matrice de QUANTITÉS (arêtes),
                               //   units  = matrice des UNITÉS (kg, m, L, jours)
  prices: MatrixModel;         // prix unitaires (diagonale) + unités €/…
  recycling: MatrixModel;      // démontage → tri → traitement → recyclage
  qTotal: number[];            // quantités totales (Q = Q_req + T·Q), par nœud
  schedule: ScheduleModel;     // durées, EF, LS (chemin critique)
  layers: TensorLayer[];       // coût / masse / distance (valeur finale par nœud)
  curves: { layerId: string; time: number[]; cum: number[] }[]; // cumul TEMPOREL
  /** true si généré par le repli hors-ligne (pas de clé API). */
  simulated: boolean;
}

/* ------------------------------------------------------------------ */
/* Pure functions                                                       */
/* ------------------------------------------------------------------ */

/** Les arêtes du graphe (représentation 2, DÉRIVÉE de la matrice — SSOT). */
export function edgesOf(m: MatrixModel): { from: number; to: number; weight: number }[] {
  const edges: { from: number; to: number; weight: number }[] = [];
  m.adjacency.forEach((row, i) =>
    row.forEach((w, j) => {
      if (w !== 0) edges.push({ from: i, to: j, weight: w });
    })
  );
  return edges;
}

/** Vérifie la cohérence des 4 représentations (formes alignées). */
export function validateMatrixModel(m: MatrixModel): string[] {
  const problems: string[] = [];
  if (m.adjacency.length !== m.rows.length) problems.push(`adjacency: ${m.adjacency.length} lignes ≠ ${m.rows.length} désignations`);
  m.adjacency.forEach((row, i) => {
    if (row.length !== m.cols.length) problems.push(`adjacency ligne ${i}: ${row.length} colonnes ≠ ${m.cols.length}`);
  });
  if (m.units.length !== m.rows.length) problems.push(`units: ${m.units.length} lignes ≠ ${m.rows.length}`);
  m.units.forEach((row, i) => {
    if (row.length !== m.cols.length) problems.push(`units ligne ${i}: ${row.length} colonnes ≠ ${m.cols.length}`);
  });
  return problems;
}

/** Rang de chaque nœud par plus long chemin (layout en couches du DAG). */
export function ranksOf(m: MatrixModel): number[] {
  const n = m.rows.length;
  const ranks = new Array<number>(n).fill(0);
  const edges = edgesOf(m);
  // Bellman-like relaxation (le graphe est petit ; les cycles sont bornés).
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    for (const e of edges) {
      if (ranks[e.to] < ranks[e.from] + 1) {
        ranks[e.to] = ranks[e.from] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return ranks;
}

/* ------------------------------------------------------------------ */
/* Le calcul du notebook de référence (Canopy) — Leontief + CPM         */
/* ------------------------------------------------------------------ */

/** Quantités totales par point fixe Q = Q_req + T·Q (demande finale +
 *  besoins intermédiaires). T[i][j] = quantité de i par unité de j.
 *  Cas connu (notebook 4×4) : T{A→B:1, B→D:1, C→B:4}, Q_req = D:1
 *  ⇒ Q_total = [A:1, B:1, C:4, D:1]. */
export function totalQuantities(T: number[][], qReq: number[]): number[] {
  const n = qReq.length;
  let Q = [...qReq];
  for (let k = 0; k < Math.ceil(n * 1.2) + 1; k++) {
    const next = qReq.map((r, i) => r + T[i].reduce((s, tij, j) => s + tij * Q[j], 0));
    if (next.every((v, i) => Math.abs(v - Q[i]) < 1e-9)) return next;
    Q = next;
  }
  return Q;
}

/** Propagation bottom-up V = c + V·T : la valeur d'un nœud inclut celle de
 *  tout ce qui y entre (masse propagée, distance cumulée par unité…).
 *  c = valeur de base par nœud, ou Σ_i T[i][j]·direct[i][j] (arêtes). */
export function propagateValue(base: number[], direct: number[][] | null, T: number[][]): number[] {
  const n = base.length;
  const constant = direct
    ? base.map((b, j) => b + T.reduce((s, row, i) => s + row[j] * direct[i][j], 0))
    : [...base];
  let V = new Array<number>(n).fill(0);
  // Convention du notebook : V_{k+1} = c + V_k @ T, soit V[i] = c[i] + Σ_j V[j]·T[j][i]
  // — chaque nœud hérite (pondéré par T) de la valeur de ses ENTRANTS.
  for (let k = 0; k < Math.ceil(n * 1.2) + 1; k++) {
    const nv = constant.map((c, i) => c + V.reduce((s, vj, j) => s + vj * T[j][i], 0));
    if (nv.every((v, i) => Math.abs(v - V[i]) < 1e-9)) return nv;
    V = nv;
  }
  return V;
}

export interface ScheduleModel {
  nodeDelays: number[]; // durée par nœud
  ef: number[];         // Earliest Finish (passe avant)
  ls: number[];         // Latest Start (passe arrière, deadline)
  deadline: number;
}

/** Passe avant CPM : EF[i] = max(EF[préd] + délai de transfert) + durée[i]. */
export function earliestFinish(nodeDelays: number[], transfer: number[][], T: number[][]): number[] {
  const n = nodeDelays.length;
  const EF = new Array<number>(n).fill(0);
  for (let k = 0; k < n; k++) {
    const prev = [...EF];
    for (let i = 0; i < n; i++) {
      let latest = 0;
      for (let j = 0; j < n; j++) if (T[j][i] > 0) latest = Math.max(latest, prev[j] + transfer[j][i]);
      EF[i] = latest + nodeDelays[i];
    }
    if (k > 0 && EF.every((v, i) => Math.abs(v - prev[i]) < 1e-9)) break;
  }
  return EF;
}

/** Passe arrière CPM : LS depuis la deadline (LS = ES au plus tard). */
export function latestStart(nodeDelays: number[], transfer: number[][], T: number[][], deadline: number): number[] {
  const n = nodeDelays.length;
  const LS = new Array<number>(n).fill(Infinity);
  const LF = new Array<number>(n).fill(Infinity);
  const isSink = (j: number) => T[j].every((v) => v === 0);
  for (let j = 0; j < n; j++) if (isSink(j)) { LF[j] = deadline; LS[j] = deadline - nodeDelays[j]; }
  for (let k = 0; k < n; k++) {
    const prev = [...LS];
    for (let j = n - 1; j >= 0; j--) {
      if (isSink(j)) continue;
      let req = Infinity;
      for (let i = 0; i < n; i++) if (T[j][i] > 0) req = Math.min(req, LS[i] - transfer[j][i]);
      LF[j] = req;
      LS[j] = LF[j] - nodeDelays[j];
    }
    if (LS.every((v, i) => Math.abs(v - prev[i]) < 1e-9 || (!isFinite(v) && !isFinite(prev[i])))) break;
  }
  return LS.map((v) => (isFinite(v) ? v : -999));
}

/** Courbe CUMULÉE d'une couche dans le TEMPS : chaque nœud contribue
 *  linéairement (valeur_finale × Q_total) entre son ES et son EF —
 *  la représentation « en cumulé » du notebook (superposée au Gantt). */
export function cumulativeCurve(
  valueFinal: number[],
  qTotal: number[],
  nodeDelays: number[],
  ef: number[],
  points = 160
): { time: number[]; cum: number[] } {
  const n = valueFinal.length;
  const es = ef.map((e, i) => e - nodeDelays[i]);
  const tMax = Math.max(...ef.filter((v) => isFinite(v)), 1);
  const acts = Array.from({ length: n }, (_, i) => ({
    s: es[i],
    e: ef[i],
    v: valueFinal[i] * qTotal[i],
    d: ef[i] - es[i],
  })).filter((a) => isFinite(a.v) && Math.abs(a.v) > 1e-9 && a.d > 1e-9);
  const time = Array.from({ length: points + 1 }, (_, k) => (tMax * k) / points);
  const cum = time.map((t) =>
    acts.reduce((s, a) => s + a.v * Math.max(0, Math.min(1, (t - a.s) / a.d)), 0)
  );
  return { time, cum };
}

/** Nombre lisible (partagé par toutes les vues quantitatives). */
export const fmtValue = (v: number): string =>
  Number.isInteger(v)
    ? v.toLocaleString('fr-FR')
    : Math.abs(v) >= 100
    ? v.toFixed(0)
    : Math.abs(v) >= 1
    ? v.toFixed(1)
    : v.toPrecision(3);
