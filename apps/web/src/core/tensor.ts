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
}

/** Une COUCHE du tenseur de grandeurs : une valeur par composant. */
export interface QuantityLayer {
  id: string;
  name: string;   // « Coût », « Masse », « Distance d'approvisionnement »…
  unit: string;   // « € », « kg », « km »…
  /** Valeur par composant — alignée sur productModel.product.rows. */
  values: number[];
}

/** Le cumul d'une couche le long du graphe d'assemblage. */
export interface CumulatedLayer {
  layerId: string;
  /** Valeur cumulée par nœud du graphe d'assemblage (alignée sur assembly.rows). */
  values: number[];
}

/** Le modèle produit complet — la sortie de bout en bout du pipeline. */
export interface ProductModel {
  request: string;           // le produit demandé par l'utilisateur (libre)
  prd: string;               // PRD/TRD markdown (recherche sourcée ou démo)
  planning: MatrixModel;
  planningDetail: MatrixModel;
  product: MatrixModel;
  assembly: MatrixModel;
  quantities: MatrixModel;   // composants × couches (valeurs), units = unités
  layers: QuantityLayer[];
  cumulated: CumulatedLayer[];
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

/**
 * CUMUL d'une couche le long du graphe d'assemblage : chaque nœud vaut sa
 * valeur propre (si c'est un composant du produit) + la somme des valeurs
 * cumulées de ses ENFANTS (arête enfant → parent = « entre dans »).
 */
export function cumulateLayer(assembly: MatrixModel, productRows: string[], layer: QuantityLayer): CumulatedLayer {
  const n = assembly.rows.length;
  const own = assembly.rows.map((name) => {
    const idx = productRows.indexOf(name);
    return idx >= 0 ? layer.values[idx] ?? 0 : 0;
  });
  const edges = edgesOf(assembly);
  const childrenOf = (i: number) => edges.filter((e) => e.to === i).map((e) => e.from);
  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const total = (i: number): number => {
    if (memo.has(i)) return memo.get(i)!;
    if (visiting.has(i)) return own[i]; // garde-fou anti-cycle
    visiting.add(i);
    const value = own[i] + childrenOf(i).reduce((s, c) => s + total(c), 0);
    visiting.delete(i);
    memo.set(i, value);
    return value;
  };
  return { layerId: layer.id, values: Array.from({ length: n }, (_, i) => total(i)) };
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
