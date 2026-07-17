/**
 * PIPELINE PRODUIT — l'orchestrateur crée le SYSTÈME AGENTIQUE capable de
 * modéliser n'importe quel produit demandé par l'utilisateur, selon le modèle
 * systématique des notebooks de référence (voir core/tensor.ts) :
 *
 *   1. AGENT PLANIFICATEUR       → planning général du projet
 *   2. (le MÊME planificateur,   → planning détaillé : chaque étape du
 *      réutilisé — pas un clone)   planning général raffinée en sous-étapes
 *   3. AGENT DE RECHERCHE        → PRD/TRD du produit (recherche des
 *                                  composants, liaisons, grandeurs, unités)
 *   4. AGENT DE CONCEPTION       → graphe des COMPOSANTS depuis la TRD
 *   5. AGENT DE FABRICATION      → graphe de l'ASSEMBLAGE du produit
 *   6. AGENT DES GRANDEURS       → matrices de valeurs (couches du tenseur :
 *                                  coût, masse, …) + matrice des unités
 *   7. AGENT DE CALCUL           → cumul des couches le long de l'assemblage
 *                                  (calcul RÉEL, local — cumulateLayer)
 *
 * AGNOSTIQUE PAR CONSTRUCTION : le contenu (étapes, composants, valeurs)
 * vient du LLM lié (prompts JSON stricts ci-dessous) pour N'IMPORTE QUEL
 * produit. Sans clé API, un repli hors-ligne GÉNÉRIQUE (gabarits de phases de
 * développement produit + architecture générique paramétrée par le nom du
 * produit, valeurs pseudo-aléatoires déterministes) garde le pipeline
 * testable — rien d'un produit particulier n'est codé en dur ici.
 */
import { Boxes, Calculator, ClipboardList, Factory, Ruler, Search } from 'lucide-react';
import type { AgentProfile, LLMProvider, TaskNode } from './types';
import { generateText } from '@/services/llm';
import {
  cumulateLayer,
  validateMatrixModel,
  type MatrixModel,
  type ProductModel,
  type QuantityLayer,
} from './tensor';

let uid = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${uid++}`;

/* ------------------------------------------------------------------ */
/* Trigger                                                              */
/* ------------------------------------------------------------------ */

/** Demandes reconnues comme CONCEPTION D'UN PRODUIT (pipeline tenseur). */
export const PRODUCT_TRIGGER =
  /concevoir|conception|con[cç]ois|fabriquer|produit|construire|d[ée]velopper (un|une)|designer (un|une)|mod[ée]liser/i;

/* ------------------------------------------------------------------ */
/* The agents the orchestrator CREATES (standard harness, conform)      */
/* ------------------------------------------------------------------ */

const SRC = {
  pert: { covers: 'Planification par précédence', label: 'Program evaluation and review technique (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Program_evaluation_and_review_technique' },
  wbs: { covers: 'Décomposition du travail', label: 'Work breakdown structure (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Work_breakdown_structure' },
  prd: { covers: 'Document d’exigences produit', label: 'Product requirements document (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Product_requirements_document' },
  dsm: { covers: 'Matrice d’adjacence des composants', label: 'Design structure matrix (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Design_structure_matrix' },
  bom: { covers: 'Nomenclature & assemblage', label: 'Bill of materials (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Bill_of_materials' },
  graph: { covers: 'Graphes & matrices d’adjacence', label: 'Adjacency matrix (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Adjacency_matrix' },
  rollup: { covers: 'Cumul des grandeurs (roll-up)', label: 'Cost breakdown / roll-up (Wikipedia — Cost breakdown analysis)', url: 'https://en.wikipedia.org/wiki/Cost_breakdown_analysis' },
};

/** Les profils des agents créés par l'orchestrateur. `binding` est la liaison
 *  LLM du projet (agnostique du fournisseur). */
export function buildPipelineAgents(binding: AgentProfile['llmBinding']): AgentProfile[] {
  const mk = (
    slug: string,
    name: string,
    icon: AgentProfile['icon'],
    tagline: string,
    readme: string,
    graph: string,
    formulas: { name: string; formula: string; explanation: string }[],
    sources: (typeof SRC)[keyof typeof SRC][],
    skills: string[]
  ): AgentProfile => ({
    id: nextId(`ppl-${slug}`),
    name,
    kind: 'worker',
    icon,
    tagline,
    readme,
    mermaidAlgorithm: graph,
    skills,
    llmBinding: binding,
    status: 'idle',
    method: { graph, formulas, sources },
  });

  return [
    mk(
      'planner',
      'Planificateur',
      ClipboardList,
      'Planning général PUIS planning détaillé (le même agent raffine ses propres étapes)',
      `# Planificateur\n\nProduit le **planning général** du projet (étapes de développement produit reliées par précédence), puis est **réutilisé** pour le **planning détaillé** : chaque étape du planning général est raffinée en sous-étapes.\n\nChaque niveau est livré sous la forme systématique : **matrice d'adjacence + graphe + matrice des unités + listes de désignations**.`,
      `flowchart TD\n  IN[Produit demandé] --> P1[Étapes du planning général]\n  P1 --> M1[Matrice d'adjacence + unités + désignations]\n  M1 --> P2[Raffinage de CHAQUE étape en sous-étapes]\n  P2 --> M2[Matrice détaillée + unités + désignations]`,
      [{ name: 'Précédence', formula: 'A[i][j] = 1 ⇔ l’étape i précède j', explanation: 'La matrice d’adjacence encode le graphe de précédence du planning (PERT) ; le graphe en est DÉRIVÉ, jamais stocké à part.' }],
      [SRC.pert, SRC.wbs],
      ['Planning par précédence', 'Raffinage WBS', 'Matrices d’adjacence']
    ),
    mk(
      'researcher',
      'Recherche produit (PRD/TRD)',
      Search,
      'Recherche les informations du produit demandé et rédige la PRD/TRD',
      `# Recherche produit\n\nRecherche les informations du produit demandé par l'utilisateur (composants, liaisons, grandeurs physiques et économiques, unités) et rédige la **PRD/TRD** : tout ce que le graphe produit devra contenir.`,
      `flowchart TD\n  IN[Produit demandé] --> S[Recherche d'informations]\n  S --> TRD[TRD : composants + liaisons + grandeurs + unités]\n  TRD --> OUT[Entrée de l'agent de conception]`,
      [{ name: 'Complétude TRD', formula: 'TRD ⊇ {composants, liaisons, grandeurs, unités}', explanation: 'La TRD doit contenir tout ce que le graphe produit contient : chaque composant, ses liaisons et ses grandeurs avec unités.' }],
      [SRC.prd],
      ['Recherche produit', 'Rédaction PRD/TRD']
    ),
    mk(
      'designer',
      'Conception (graphe produit)',
      Boxes,
      'Crée le graphe de TOUS les composants du produit depuis la TRD',
      `# Conception\n\nConstruit le **graphe des composants** du produit sur la base de la TRD : désignations des composants, matrice d'adjacence des liaisons, matrice des unités.`,
      `flowchart TD\n  IN[TRD] --> C[Liste des composants]\n  C --> A[Matrice d'adjacence des liaisons]\n  A --> OUT[Graphe produit + unités + désignations]`,
      [{ name: 'Liaison', formula: 'A[i][j] = 1 ⇔ composants i et j liés', explanation: 'Matrice de structure de conception (DSM) : chaque liaison physique/fonctionnelle entre composants devient une arête du graphe.' }],
      [SRC.dsm, SRC.graph],
      ['Architecture produit', 'DSM']
    ),
    mk(
      'manufacturing',
      'Fabrication (graphe d’assemblage)',
      Factory,
      'Crée le graphe de l’assemblage du produit (ordre de montage)',
      `# Fabrication\n\nConstruit le **graphe d'assemblage** : quels composants entrent dans quels sous-ensembles, jusqu'au produit final (arêtes orientées enfant → parent).`,
      `flowchart TD\n  IN[Graphe produit] --> S[Sous-ensembles de montage]\n  S --> A[Matrice d'adjacence orientée enfant→parent]\n  A --> OUT[Graphe d'assemblage]`,
      [{ name: 'Assemblage', formula: 'A[i][j] = 1 ⇔ i entre dans j', explanation: 'La nomenclature (BOM) orientée : chaque arête « entre dans » relie un composant à son sous-ensemble, jusqu’au produit final.' }],
      [SRC.bom],
      ['Gammes de montage', 'Nomenclature']
    ),
    mk(
      'quantifier',
      'Grandeurs (couches du tenseur)',
      Ruler,
      'Crée les matrices de valeurs des grandeurs liées à chaque composant',
      `# Grandeurs\n\nConstruit les **matrices de valeurs** : une COUCHE du tenseur par grandeur (coût, masse, distance…), une valeur par composant, avec la **matrice des unités**.`,
      `flowchart TD\n  IN[TRD : grandeurs par composant] --> V[Matrice composants × couches]\n  V --> U[Matrice des unités]\n  U --> OUT[Couches du tenseur]`,
      [{ name: 'Couche', formula: 'T[c][ℓ] = valeur de la grandeur ℓ pour le composant c', explanation: 'Le tenseur de grandeurs empile une couche par grandeur ; chaque cellule porte sa valeur ET son unité (matrice des unités).' }],
      [SRC.dsm, SRC.graph],
      ['Tenseur de grandeurs', 'Unités']
    ),
    mk(
      'calculator',
      'Calcul (grandeurs cumulées)',
      Calculator,
      'Calcule les matrices et aboutit au graphe des grandeurs cumulées',
      `# Calcul\n\nPropage chaque couche du tenseur le long du graphe d'assemblage : **cumul = valeur propre + somme des enfants** (roll-up), jusqu'au produit final. Calcul réel exécuté localement (core/tensor.ts, cumulateLayer).`,
      `flowchart TD\n  IN[Couches + graphe d'assemblage] --> R[cumul i = propre i + somme enfants]\n  R --> OUT[Graphe des grandeurs cumulées par couche]`,
      [{ name: 'Cumul (roll-up)', formula: 'cumul(i) = propre(i) + Σ cumul(enfants de i)', explanation: 'La grandeur cumulée d’un nœud d’assemblage est sa valeur propre plus la somme des grandeurs cumulées de tout ce qui entre dedans — ex. la masse du produit final = somme des masses de tous les composants.' }],
      [SRC.rollup, SRC.graph],
      ['Roll-up de grandeurs', 'Calcul matriciel']
    ),
  ];
}

/* ------------------------------------------------------------------ */
/* Task flow (contracted, visible in « Flux »)                          */
/* ------------------------------------------------------------------ */

export function buildPipelineTasks(projectId: string, request: string, agents: AgentProfile[]): TaskNode[] {
  const byName = (n: string) => agents.find((a) => a.name.startsWith(n))?.id ?? agents[0].id;
  const mk = (title: string, agentId: string, objective: string, deliverable: string, dependsOn: string[], input: string): TaskNode => ({
    id: nextId(`${projectId}-pt`),
    projectId,
    title,
    agentId,
    status: 'pending',
    dependsOn,
    spec: { objective, constraints: ['Modèle systématique : adjacence + graphe + unités + désignations', 'Sortie JSON stricte'], deliverableFormat: deliverable },
    input,
    output: null,
    conformity: null,
    accessible: true,
  });
  const t1 = mk('Planning général', byName('Planificateur'), `Planning général du projet : ${request}`, 'planning_general.json', [], request);
  const t2 = mk('Planning détaillé (raffinage)', byName('Planificateur'), 'Raffiner CHAQUE étape du planning général en sous-étapes.', 'planning_detaille.json', [t1.id], 'Planning général');
  const t3 = mk('PRD/TRD du produit', byName('Recherche'), `Rechercher les informations du produit et rédiger la PRD/TRD : ${request}`, 'trd.md', [t1.id], request);
  const t4 = mk('Graphe des composants', byName('Conception'), 'Créer le graphe de tous les composants depuis la TRD.', 'graphe_produit.json', [t3.id], 'TRD');
  const t5 = mk('Graphe d’assemblage', byName('Fabrication'), 'Créer le graphe de l’assemblage du produit.', 'graphe_assemblage.json', [t4.id], 'Graphe produit');
  const t6 = mk('Matrices des grandeurs', byName('Grandeurs'), 'Créer les matrices de valeurs des grandeurs par composant (+ unités).', 'tenseur_grandeurs.json', [t3.id, t4.id], 'TRD + graphe produit');
  const t7 = mk('Cumul des grandeurs', byName('Calcul'), 'Calculer les matrices et produire le graphe des grandeurs cumulées.', 'grandeurs_cumulees.json', [t5.id, t6.id], 'Assemblage + couches');
  return [t1, t2, t3, t4, t5, t6, t7];
}

/* ------------------------------------------------------------------ */
/* LLM prompts (strict JSON) + parsing + offline fallbacks              */
/* ------------------------------------------------------------------ */

interface LlmDeps {
  provider: LLMProvider | undefined;
  model: string;
}

async function askJson<T>(deps: LlmDeps, system: string, prompt: string): Promise<T | null> {
  if (!deps.provider) return null;
  try {
    const res = await generateText({ provider: deps.provider, model: deps.model, system, prompt });
    if (res.simulated) return null;
    const jsonText = res.text.replace(/```json|```/g, '').trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    return JSON.parse(jsonText.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Hash déterministe (repli hors-ligne : valeurs stables par produit). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const chain = (n: number): number[][] =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j === i + 1 ? 1 : 0)));

const unitFill = (rows: number, cols: number, unit: string): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => unit));

/* ---- step 1: planning général ---- */

interface PlanJson { steps: string[]; adjacency: number[][] }

const GENERIC_PHASES = [
  'Cahier des charges (PRD)',
  'Recherche & TRD',
  'Conception architecturale',
  'Conception détaillée',
  'Prototypage',
  'Tests & validation',
  'Lancement de fabrication',
  'Livraison',
];

async function stepPlanning(deps: LlmDeps, request: string): Promise<{ m: MatrixModel; simulated: boolean }> {
  const json = await askJson<PlanJson>(
    deps,
    'Tu es un planificateur de développement produit. Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Donne le planning général du projet en JSON : {"steps": ["…"], "adjacency": [[0|1,…],…]} où adjacency[i][j]=1 si l'étape i précède directement l'étape j. 6 à 10 étapes, de l'expression du besoin à la livraison, en français.`
  );
  const steps = json?.steps?.length ? json.steps : GENERIC_PHASES;
  const adjacency = json?.adjacency?.length === steps.length ? json.adjacency : chain(steps.length);
  const m: MatrixModel = {
    id: nextId('mm-plan'),
    kind: 'planning',
    title: 'Planning général',
    rows: steps,
    cols: steps,
    adjacency,
    units: unitFill(steps.length, steps.length, 'précédence (0/1)'),
    directed: true,
  };
  return { m, simulated: !json };
}

/* ---- step 2: planning détaillé (raffinage de CHAQUE étape) ---- */

interface DetailJson { substeps: { phase: string; steps: string[] }[] }

async function stepPlanningDetail(deps: LlmDeps, request: string, planning: MatrixModel): Promise<{ m: MatrixModel; simulated: boolean }> {
  const json = await askJson<DetailJson>(
    deps,
    'Tu es un planificateur de développement produit. Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Planning général : ${JSON.stringify(planning.rows)}. Raffine CHAQUE étape en 2 à 4 sous-étapes concrètes, en JSON : {"substeps": [{"phase": "…", "steps": ["…"]}]} dans l'ordre des phases, en français.`
  );
  const groups: { phase: string; steps: string[] }[] =
    json?.substeps?.length === planning.rows.length
      ? json.substeps
      : planning.rows.map((phase) => ({
          phase,
          steps: [`${phase} — préparation`, `${phase} — exécution`, `${phase} — revue & validation`],
        }));
  const rows = groups.flatMap((g) => g.steps.map((s) => `${g.phase} · ${s.replace(`${g.phase} — `, '')}`));
  const n = rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  // Chaîne à l'intérieur de chaque phase + liaison inter-phases selon le
  // planning général (dernière sous-étape → première de la phase suivante).
  let offset = 0;
  const phaseStart: number[] = [];
  const phaseEnd: number[] = [];
  groups.forEach((g) => {
    phaseStart.push(offset);
    for (let i = 0; i < g.steps.length - 1; i++) adjacency[offset + i][offset + i + 1] = 1;
    offset += g.steps.length;
    phaseEnd.push(offset - 1);
  });
  planning.adjacency.forEach((row, i) =>
    row.forEach((w, j) => {
      if (w !== 0) adjacency[phaseEnd[i]][phaseStart[j]] = 1;
    })
  );
  const m: MatrixModel = {
    id: nextId('mm-detail'),
    kind: 'planning-detail',
    title: 'Planning détaillé',
    rows,
    cols: rows,
    adjacency,
    units: unitFill(n, n, 'précédence (0/1)'),
    directed: true,
  };
  return { m, simulated: !json };
}

/* ---- step 3: recherche → PRD/TRD (composants + liaisons + grandeurs) ---- */

export interface TrdJson {
  prd: string;
  components: { name: string; connections: string[]; quantities: Record<string, { value: number; unit: string }> }[];
  layers: { id: string; name: string; unit: string }[];
}

function fallbackTrd(request: string): TrdJson {
  const h = hash(request);
  // Architecture GÉNÉRIQUE de produit (agnostique) ; les valeurs sont
  // pseudo-aléatoires déterministes — clairement étiquetées « démo ».
  const names = [
    'Structure porteuse',
    'Enveloppe / carter',
    'Module fonctionnel principal',
    'Module fonctionnel secondaire',
    'Alimentation / énergie',
    'Commande & contrôle',
    'Interface utilisateur',
  ];
  const layers = [
    { id: 'cout', name: 'Coût', unit: '€' },
    { id: 'masse', name: 'Masse', unit: 'kg' },
    { id: 'distance', name: 'Distance d’approvisionnement', unit: 'km' },
  ];
  const val = (i: number, l: number) => Math.round((((h >> (i + l * 3)) % 97) + 3) * (l === 0 ? 12 : l === 1 ? 0.8 : 25) * 10) / 10;
  const components = names.map((name, i) => ({
    name,
    connections: i === 0 ? [] : [names[Math.max(0, Math.floor(i / 2) - (i % 2))]],
    quantities: Object.fromEntries(layers.map((l, li) => [l.id, { value: val(i, li), unit: l.unit }])),
  }));
  const prd = `# PRD/TRD — ${request}\n\n> **Démo hors-ligne** : aucune clé API configurée. Structure générique de produit ; configurez une clé (Réglages) pour une recherche réelle du produit demandé.\n\n## Composants\n${names.map((n) => `- ${n}`).join('\n')}\n\n## Grandeurs suivies (couches du tenseur)\n${layers.map((l) => `- ${l.name} (${l.unit})`).join('\n')}`;
  return { prd, components, layers };
}

async function stepTrd(deps: LlmDeps, request: string): Promise<{ trd: TrdJson; simulated: boolean }> {
  const json = await askJson<TrdJson>(
    deps,
    'Tu es un agent de recherche produit. Réponds UNIQUEMENT en JSON strict.',
    `Produit demandé : « ${request} ». Recherche ses composants réels et rédige la TRD en JSON :\n{"prd": "PRD/TRD en markdown (résumé, exigences, composants, grandeurs)",\n "components": [{"name": "…", "connections": ["noms des composants liés"], "quantities": {"cout": {"value": n, "unit": "€"}, "masse": {"value": n, "unit": "kg"}, "distance": {"value": n, "unit": "km"}}}],\n "layers": [{"id": "cout", "name": "Coût", "unit": "€"}, {"id": "masse", "name": "Masse", "unit": "kg"}, {"id": "distance", "name": "Distance d’approvisionnement", "unit": "km"}]}\n6 à 14 composants, valeurs réalistes, en français. La TRD doit contenir TOUT ce que le graphe produit contiendra.`
  );
  const ok =
    json?.components?.length &&
    json.layers?.length &&
    json.components.every((c) => c.name && c.quantities);
  return { trd: ok ? json! : fallbackTrd(request), simulated: !ok };
}

/* ---- step 4: conception → graphe produit (déduit de la TRD, code pur) ---- */

function stepProduct(trd: TrdJson): MatrixModel {
  const rows = trd.components.map((c) => c.name);
  const idx = new Map(rows.map((r, i) => [r, i]));
  const n = rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  trd.components.forEach((c, i) =>
    c.connections.forEach((other) => {
      const j = idx.get(other);
      if (j !== undefined && j !== i) {
        adjacency[i][j] = 1;
        adjacency[j][i] = 1; // liaison structurelle non orientée
      }
    })
  );
  return {
    id: nextId('mm-prod'),
    kind: 'product',
    title: 'Graphe des composants',
    rows,
    cols: rows,
    adjacency,
    units: unitFill(n, n, 'liaison (0/1)'),
    directed: false,
  };
}

/* ---- step 5: fabrication → graphe d'assemblage ---- */

interface AssemblyJson { nodes: string[]; edges: [string, string][] }

async function stepAssembly(deps: LlmDeps, request: string, product: MatrixModel): Promise<{ m: MatrixModel; simulated: boolean }> {
  const json = await askJson<AssemblyJson>(
    deps,
    'Tu es un agent de fabrication (gammes de montage). Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Composants : ${JSON.stringify(product.rows)}. Donne le graphe d'assemblage en JSON : {"nodes": ["…tous les composants + sous-ensembles + produit final"], "edges": [["enfant","parent"],…]} où chaque arête signifie « entre dans ». Chaque composant doit aboutir (directement ou via des sous-ensembles) au produit final, en français.`
  );
  let nodes: string[];
  let edges: [string, string][];
  const valid =
    json?.nodes?.length &&
    json.edges?.length &&
    product.rows.every((r) => json.nodes.includes(r)) &&
    json.edges.every((e) => json.nodes.includes(e[0]) && json.nodes.includes(e[1]));
  if (valid) {
    nodes = json!.nodes;
    edges = json!.edges;
  } else {
    // Repli générique : deux sous-ensembles équilibrés → produit final.
    const half = Math.ceil(product.rows.length / 2);
    const sub1 = 'Sous-ensemble A';
    const sub2 = 'Sous-ensemble B';
    const final = `Produit final — ${request}`;
    nodes = [...product.rows, sub1, sub2, final];
    edges = [
      ...product.rows.map((r, i): [string, string] => [r, i < half ? sub1 : sub2]),
      [sub1, final],
      [sub2, final],
    ];
  }
  const idx = new Map(nodes.map((r, i) => [r, i]));
  const n = nodes.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  edges.forEach(([a, b]) => {
    const i = idx.get(a)!;
    const j = idx.get(b)!;
    if (i !== j) adjacency[i][j] = 1;
  });
  return {
    m: {
      id: nextId('mm-asm'),
      kind: 'assembly',
      title: 'Graphe d’assemblage',
      rows: nodes,
      cols: nodes,
      adjacency,
      units: unitFill(n, n, 'entre dans (0/1)'),
      directed: true,
    },
    simulated: !valid,
  };
}

/* ---- step 6: grandeurs → couches + matrice valeurs/unités (code pur) ---- */

function stepQuantities(trd: TrdJson, product: MatrixModel): { layers: QuantityLayer[]; m: MatrixModel } {
  const layers: QuantityLayer[] = trd.layers.map((l) => ({
    id: l.id,
    name: l.name,
    unit: l.unit,
    values: product.rows.map((r) => trd.components.find((c) => c.name === r)?.quantities[l.id]?.value ?? 0),
  }));
  const m: MatrixModel = {
    id: nextId('mm-qty'),
    kind: 'quantities',
    title: 'Matrices des grandeurs (composants × couches)',
    rows: product.rows,
    cols: layers.map((l) => l.name),
    adjacency: product.rows.map((_, i) => layers.map((l) => l.values[i])),
    units: product.rows.map(() => layers.map((l) => l.unit)),
    directed: false,
  };
  return { layers, m };
}

/* ------------------------------------------------------------------ */
/* The pipeline runner                                                  */
/* ------------------------------------------------------------------ */

export interface PipelineProgress {
  step: number; // 1..7
  label: string;
  agentName: string;
}

/**
 * Exécute le pipeline de bout en bout et construit le ProductModel.
 * `onProgress` permet à l'UI de suivre chaque étape (agent au travail).
 */
export async function runProductPipeline(
  request: string,
  deps: LlmDeps,
  onProgress: (p: PipelineProgress) => void
): Promise<ProductModel> {
  onProgress({ step: 1, label: 'Planning général', agentName: 'Planificateur' });
  const p1 = await stepPlanning(deps, request);

  onProgress({ step: 2, label: 'Planning détaillé (raffinage par le même planificateur)', agentName: 'Planificateur' });
  const p2 = await stepPlanningDetail(deps, request, p1.m);

  onProgress({ step: 3, label: 'PRD/TRD du produit (recherche)', agentName: 'Recherche produit' });
  const p3 = await stepTrd(deps, request);

  onProgress({ step: 4, label: 'Graphe des composants', agentName: 'Conception' });
  const product = stepProduct(p3.trd);

  onProgress({ step: 5, label: 'Graphe d’assemblage', agentName: 'Fabrication' });
  const p5 = await stepAssembly(deps, request, product);

  onProgress({ step: 6, label: 'Matrices des grandeurs', agentName: 'Grandeurs' });
  const { layers, m: quantities } = stepQuantities(p3.trd, product);

  onProgress({ step: 7, label: 'Cumul des grandeurs (calcul réel)', agentName: 'Calcul' });
  const cumulated = layers.map((l) => cumulateLayer(p5.m, product.rows, l));

  const model: ProductModel = {
    request,
    prd: p3.trd.prd,
    planning: p1.m,
    planningDetail: p2.m,
    product,
    assembly: p5.m,
    quantities,
    layers,
    cumulated,
    simulated: p1.simulated || p3.simulated,
  };

  // Auto-contrôle : les 4 représentations de chaque étape sont cohérentes.
  const problems = [model.planning, model.planningDetail, model.product, model.assembly, model.quantities].flatMap(
    (m) => validateMatrixModel(m).map((p) => `${m.title}: ${p}`)
  );
  if (problems.length > 0) throw new Error(`Modèle incohérent — ${problems.join(' · ')}`);
  return model;
}
