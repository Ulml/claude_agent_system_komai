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
  cumulativeCurve,
  earliestFinish,
  latestStart,
  propagateValue,
  totalQuantities,
  validateMatrixModel,
  type MatrixModel,
  type ProductModel,
  type TensorLayer,
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

/* ---- step 1: planning général (nb1 cellule 1 : chaîne d'étapes) ---- */

interface PlanJson { steps: string[]; adjacency: number[][] }

const GENERIC_PHASES = [
  'Idée',
  'Étude de faisabilité',
  'Conception architecturale',
  'Permis / autorisations',
  'Appel d’offres',
  'Choix des fournisseurs',
  'Planification détaillée',
  'Préparation de la fabrication',
  'Lancement de la fabrication',
];

async function stepPlanning(deps: LlmDeps, request: string): Promise<{ m: MatrixModel; simulated: boolean }> {
  const json = await askJson<PlanJson>(
    deps,
    'Tu es un planificateur de développement produit. Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Planning général en JSON : {"steps": ["…"], "adjacency": [[0|1]]} (adjacency[i][j]=1 si i précède j), de l'idée au lancement de la fabrication, 8-11 étapes, en français.`
  );
  const steps = json?.steps?.length ? json.steps : GENERIC_PHASES;
  const adjacency = json?.adjacency?.length === steps.length ? json.adjacency : chain(steps.length);
  return {
    m: { id: nextId('mm-plan'), kind: 'planning', title: 'Planning général', rows: steps, cols: steps, adjacency, units: unitFill(steps.length, steps.length, 'précédence (0/1)'), directed: true },
    simulated: !json,
  };
}

/* ---- step 2: planning détaillé (nb1 cellule 3 : HIÉRARCHIE
        étape ← détail ← sous-détail, le MÊME planificateur raffine) ---- */

interface DetailJson { details: { phase: string; items: { name: string; subs: string[] }[] }[] }

async function stepPlanningDetail(deps: LlmDeps, request: string, planning: MatrixModel): Promise<{ m: MatrixModel; simulated: boolean }> {
  const json = await askJson<DetailJson>(
    deps,
    'Tu es un planificateur de développement produit. Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Étapes : ${JSON.stringify(planning.rows)}. Pour CHAQUE étape, 2-4 éléments nécessaires (détails), chacun avec 2 sous-éléments, en JSON : {"details":[{"phase":"…","items":[{"name":"…","subs":["…","…"]}]}]} dans l'ordre, en français.`
  );
  const groups =
    json?.details?.length === planning.rows.length
      ? json.details
      : planning.rows.map((phase) => ({
          phase,
          items: [
            { name: `Préparer — ${phase}`, subs: ['Collecte des données', 'Parties prenantes'] },
            { name: `Produire — ${phase}`, subs: ['Réalisation', 'Contrôle qualité'] },
          ],
        }));
  const rows: string[] = [...planning.rows];
  const types: string[] = planning.rows.map(() => 'étape');
  groups.forEach((g) => g.items.forEach((it) => {
    rows.push(it.name); types.push('détail');
    it.subs.forEach((sd) => { rows.push(`${sd} (${it.name})`); types.push('sous-détail'); });
  }));
  const n = rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  // chaîne des étapes (planning général)
  planning.adjacency.forEach((row, i) => row.forEach((w, j) => { if (w !== 0) adjacency[i][j] = 1; }));
  // détail → étape et sous-détail → détail (l'élément nécessaire ALIMENTE)
  const idx = new Map(rows.map((r, i) => [r, i]));
  groups.forEach((g) => {
    const pi = idx.get(g.phase);
    g.items.forEach((it) => {
      const di = idx.get(it.name)!;
      if (pi !== undefined) adjacency[di][pi] = 1;
      it.subs.forEach((sd) => { adjacency[idx.get(`${sd} (${it.name})`)!][di] = 1; });
    });
  });
  return {
    m: { id: nextId('mm-det'), kind: 'planning-detail', title: 'Planning détaillé', rows, cols: rows, adjacency, units: unitFill(n, n, 'précédence (0/1)'), directed: true, nodeTypes: types },
    simulated: !json,
  };
}

/* ---- step 3: recherche → PRD/TRD (tout ce que contiennent les graphes) ---- */

export interface TrdJson {
  prd: string;
  components: { name: string; inputs: string[]; stage: string; qty: number; unit: string; price: number; priceUnit: string; massKg: number; distanceKm: number }[];
  stages: { name: string; sub: string; days: number; dailyRate: number }[];
  subs: string[];
}

function fallbackTrd(request: string): TrdJson {
  const h = hash(request);
  const v = (i: number, f: number) => Math.round((((h >> (i % 24)) % 89) + 5) * f * 10) / 10;
  const stages = [
    { name: 'Préparation de la base', sub: 'Structure de base', days: v(1, 0.08), dailyRate: v(2, 8) },
    { name: 'Assemblage principal', sub: 'Superstructure', days: v(3, 0.1), dailyRate: v(4, 8) },
    { name: 'Équipements & finitions', sub: 'Intérieur / systèmes', days: v(5, 0.06), dailyRate: v(6, 8) },
  ];
  const names = ['Structure porteuse', 'Enveloppe / carter', 'Module fonctionnel principal', 'Module fonctionnel secondaire', 'Alimentation / énergie', 'Commande & contrôle', 'Interface utilisateur', 'Visserie & liaisons'];
  const components = names.map((name, i) => ({
    name,
    inputs: [`Matière première — ${name}`, 'Plan de fabrication', i % 2 ? 'Outillage' : 'Traitement de surface'],
    stage: stages[i % 3].name,
    qty: v(i + 7, i % 3 === 0 ? 0.5 : 0.2),
    unit: ['kg', 'unité', 'm'][i % 3],
    price: v(i + 9, 6),
    priceUnit: ['€/kg', '€/unité', '€/m'][i % 3],
    massKg: v(i + 11, 0.15),
    distanceKm: v(i + 13, 18),
  }));
  const prd = `# PRD/TRD — ${request}\n\n> **Démo hors-ligne** : structure générique (pas de clé API). Configurez une clé (Réglages) pour une recherche réelle du produit.\n\n## Composants\n${components.map((c) => `- **${c.name}** — ${c.qty} ${c.unit}, ${c.price} ${c.priceUnit}, ${c.massKg} kg/u, appro ${c.distanceKm} km · entrées : ${c.inputs.join(', ')}`).join('\n')}\n\n## Étapes d'assemblage\n${stages.map((s) => `- ${s.name} → ${s.sub} (${s.days} j, ${s.dailyRate} €/j)`).join('\n')}`;
  return { prd, components, stages, subs: [...new Set(stages.map((s) => s.sub))] };
}

async function stepTrd(deps: LlmDeps, request: string): Promise<{ trd: TrdJson; simulated: boolean }> {
  const json = await askJson<TrdJson>(
    deps,
    'Tu es un agent de recherche produit. Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Recherche ses composants RÉELS et rédige la TRD (tout ce que les graphes contiendront) en JSON :\n{"prd":"markdown PRD/TRD","components":[{"name":"…","inputs":["entrées nécessaires"],"stage":"étape d'assemblage","qty":n,"unit":"kg|m|L|unité","price":n,"priceUnit":"€/…","massKg":n,"distanceKm":n}],"stages":[{"name":"…","sub":"sous-ensemble","days":n,"dailyRate":n}],"subs":["sous-ensembles"]}\n8-16 composants, 4-8 étapes, 2-4 sous-ensembles, valeurs réalistes, en français.`
  );
  const ok = json?.components?.length && json.stages?.length && json.subs?.length &&
    json.components.every((c) => c.name && c.stage && c.inputs) &&
    json.components.every((c) => json.stages.some((s) => s.name === c.stage));
  return { trd: ok ? json! : fallbackTrd(request), simulated: !ok };
}

/* ---- step 4: conception (nb1 cellule 5 : inputs → composant → atelier) ---- */

function stepConception(trd: TrdJson): MatrixModel {
  const comps = trd.components.map((c) => c.name);
  const inputs = [...new Set(trd.components.flatMap((c) => c.inputs))];
  const atelier = 'Atelier de fabrication';
  const rows = [...inputs, ...comps, atelier];
  const types = [...inputs.map(() => 'input'), ...comps.map(() => 'composant'), 'atelier'];
  const idx = new Map(rows.map((r, i) => [r, i]));
  const n = rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  trd.components.forEach((c) => {
    c.inputs.forEach((inp) => { adjacency[idx.get(inp)!][idx.get(c.name)!] = 1; });
    adjacency[idx.get(c.name)!][idx.get(atelier)!] = 1;
  });
  return { id: nextId('mm-con'), kind: 'product', title: 'Conception des composants', rows, cols: rows, adjacency, units: unitFill(n, n, 'alimente (0/1)'), directed: true, nodeTypes: types };
}

/* ---- step 5: assemblage (nb1 cellule 7-10 : composants → étapes →
        sous-ensembles → produit, quantités + unités sur les arêtes) ---- */

function stepAssembly(trd: TrdJson, request: string): MatrixModel {
  const final = `Produit final — ${request}`;
  const comps = trd.components.map((c) => c.name);
  const stages = trd.stages.map((s) => s.name);
  const rows = [...comps, ...stages, ...trd.subs, final];
  const types = [...comps.map(() => 'composant'), ...stages.map(() => 'étape'), ...trd.subs.map(() => 'sous-ensemble'), 'produit'];
  const idx = new Map(rows.map((r, i) => [r, i]));
  const n = rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const values = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const units = unitFill(n, n, '');
  trd.components.forEach((c) => {
    const i = idx.get(c.name)!; const j = idx.get(c.stage)!;
    adjacency[i][j] = 1; values[i][j] = c.qty; units[i][j] = c.unit;
  });
  trd.stages.forEach((s) => {
    const i = idx.get(s.name)!; const j = idx.get(s.sub)!;
    adjacency[i][j] = 1; values[i][j] = s.days; units[i][j] = 'jours';
  });
  trd.subs.forEach((sub) => {
    const i = idx.get(sub)!; const j = idx.get(final)!;
    adjacency[i][j] = 1; values[i][j] = 1; units[i][j] = 'unité';
  });
  return { id: nextId('mm-asm'), kind: 'assembly', title: 'Graphe d’assemblage', rows, cols: rows, adjacency, values, units, directed: true, nodeTypes: types };
}

/* ---- step 6: matrices des grandeurs — prix unitaires (diagonale, nb1
        cellule 11-12) + couches du tenseur (nb2) ---- */

function stepPrices(trd: TrdJson, assembly: MatrixModel): MatrixModel {
  const n = assembly.rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const units = unitFill(n, n, '');
  assembly.rows.forEach((r, i) => {
    const c = trd.components.find((x) => x.name === r);
    const s = trd.stages.find((x) => x.name === r);
    if (c) { adjacency[i][i] = c.price; units[i][i] = c.priceUnit; }
    if (s) { adjacency[i][i] = s.dailyRate; units[i][i] = '€/jour'; }
  });
  return { id: nextId('mm-prc'), kind: 'quantities', title: 'Prix unitaires (diagonale)', rows: assembly.rows, cols: assembly.cols, adjacency, units, directed: false, nodeTypes: assembly.nodeTypes };
}

/* ---- step 7: recyclage (nb1 cellule 13 : démontage → retour matériaux) ---- */

async function stepRecycling(deps: LlmDeps, request: string, comps: string[]): Promise<{ m: MatrixModel; simulated: boolean }> {
  interface RecJson { steps: string[]; materials: string[] }
  const json = await askJson<RecJson>(
    deps,
    'Tu es un agent d’économie circulaire. Réponds UNIQUEMENT en JSON strict.',
    `Produit : « ${request} ». Étapes de démontage/recyclage en JSON {"steps":["…5-6 étapes du produit au retour aux matériaux d'origine"],"materials":["matériaux d'origine récupérés"]}, en français.`
  );
  const steps = json?.steps?.length ? json.steps : [`Produit en fin de vie — ${request}`, 'Démontage des composants', 'Tri des matériaux', 'Traitement des matériaux', 'Recyclage', 'Retour aux matériaux d’origine'];
  const mats = json?.materials?.length ? json.materials : ['Métaux', 'Minéraux', 'Polymères'];
  const rows = [...steps, ...comps, ...mats];
  const types = [...steps.map(() => 'étape'), ...comps.map(() => 'composant'), ...mats.map(() => 'matériau')];
  const n = rows.length;
  const adjacency = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < steps.length - 1; i++) adjacency[i][i + 1] = 1;
  comps.forEach((_, k) => { adjacency[1][steps.length + k] = 1; adjacency[steps.length + k][2] = 1; });
  mats.forEach((_, k) => { adjacency[steps.length - 2][steps.length + comps.length + k] = 1; });
  return {
    m: { id: nextId('mm-rec'), kind: 'planning', title: 'Démontage & recyclage', rows, cols: rows, adjacency, units: unitFill(n, n, 'flux (0/1)'), directed: true, nodeTypes: types },
    simulated: !json,
  };
}

/* ------------------------------------------------------------------ */
/* The pipeline runner                                                  */
/* ------------------------------------------------------------------ */

export interface PipelineProgress {
  step: number; // 1..7
  label: string;
  agentName: string;
}

/** Exécute le pipeline de bout en bout — construit le ProductModel complet
 *  (graphes nb1 + calcul Leontief/CPM/cumul temporel nb2). */
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
  onProgress({ step: 4, label: 'Graphe de conception des composants', agentName: 'Conception' });
  const conception = stepConception(p3.trd);
  onProgress({ step: 5, label: 'Graphe d’assemblage (quantités + unités)', agentName: 'Fabrication' });
  const assembly = stepAssembly(p3.trd, request);
  onProgress({ step: 6, label: 'Matrices des grandeurs (prix, masse, distance)', agentName: 'Grandeurs' });
  const prices = stepPrices(p3.trd, assembly);
  const rec = await stepRecycling(deps, request, p3.trd.components.map((c) => c.name));

  onProgress({ step: 7, label: 'Calcul : quantités totales, chemin critique, cumuls temporels', agentName: 'Calcul' });
  // --- Le calcul RÉEL du notebook Canopy ---
  const n = assembly.rows.length;
  const T = assembly.values!;
  const qReq = assembly.rows.map((r) => (r.startsWith('Produit final') ? 1 : 0));
  const qTotal = totalQuantities(T, qReq);
  // durées par nœud : composants ~0.5 j, étapes = jours TRD, ensembles 1 j
  const nodeDelays = assembly.rows.map((r) => {
    const s = p3.trd.stages.find((x) => x.name === r);
    if (s) return Math.max(0.5, s.days);
    return assembly.nodeTypes?.[assembly.rows.indexOf(r)] === 'composant' ? 0.5 : 1;
  });
  const transfer = T.map((row) => row.map((v) => (v > 0 ? 0.1 : 0)));
  const ef = earliestFinish(nodeDelays, transfer, T);
  const deadline = Math.max(...ef); // = fin au plus tôt du projet → le chemin le plus long a une marge nulle (critique)
  const ls = latestStart(nodeDelays, transfer, T, deadline);
  // couches : prix (diagonale), masse propagée, distance cumulée par unité
  const pFinal = assembly.rows.map((_, i) => prices.adjacency[i][i]);
  const mBase = assembly.rows.map((r) => p3.trd.components.find((c) => c.name === r)?.massKg ?? 0);
  const mFinal = propagateValue(mBase, null, T);
  const distDirect = T.map((row, i) =>
    row.map((v) => (v > 0 ? (p3.trd.components.find((c) => c.name === assembly.rows[i])?.distanceKm ?? 0) : 0))
  );
  const dFinal = propagateValue(new Array<number>(n).fill(0), distDirect, T);
  const layers: TensorLayer[] = [
    { id: 'cout', name: 'Coût', unit: '€', final: pFinal },
    { id: 'masse', name: 'Masse', unit: 'kg', final: mFinal },
    { id: 'distance', name: 'Distance', unit: 'km', final: dFinal },
  ];
  const curves = layers.map((l) => ({ layerId: l.id, ...cumulativeCurve(l.final, qTotal, nodeDelays, ef) }));

  const model: ProductModel = {
    request,
    prd: p3.trd.prd,
    planning: p1.m,
    planningDetail: p2.m,
    conception,
    assembly,
    prices,
    recycling: rec.m,
    qTotal,
    schedule: { nodeDelays, ef, ls, deadline },
    layers,
    curves,
    simulated: p1.simulated || p3.simulated,
  };
  const problems = [model.planning, model.planningDetail, model.conception, model.assembly, model.prices, model.recycling]
    .flatMap((m) => validateMatrixModel(m).map((p) => `${m.title}: ${p}`));
  if (problems.length > 0) throw new Error(`Modèle incohérent — ${problems.join(' · ')}`);
  return model;
}
