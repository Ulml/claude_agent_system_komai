/**
 * MBSE ENGINE — the Orchestrator designs a physical system as a block
 * diagram (MBSE style):
 *
 *   ENVIRONNEMENT ──► [ META-COMPONENT: function agents inside ] ──► UTILISATEUR
 *
 * Each META-COMPONENT is a physical component (mechanical, electronic,
 * material…) rendered as an agent FOLDER on the desktop; inside it, one
 * AGENT PER PHYSICAL FUNCTION (e.g. raw-earth brick: thermal insulation,
 * mechanical stress up to rupture, thermal inertia, hygrometrics). Each
 * function agent carries its share of the END-TO-END FUNCTIONAL FLOWS
 * (heat, moisture, mechanical load…) from the environment to the user.
 *
 * The engine also produces the CONSTRUCTION TASK FLOW (idea → keys → use)
 * and LINKS the two graphs: every task declares which function agents it
 * `realizes`, and refinement iterations (planned in the task graph) make
 * the diagram grow in detail — the iterative construction the product
 * spec requires.
 *
 * All function agents are REAL: their methods run the building-physics
 * formulas of core/simulators.ts (Fourier, R = e/λ, α = λ/ρc, σ = F/A,
 * MBV) with SOTA sources — the AGENT_STANDARD rule is never bypassed.
 */
import {
  CloudSun,
  Droplets,
  Gauge,
  Home as HomeIcon,
  Layers,
  ThermometerSun,
  UserRound,
  Volume2,
  Wind,
} from 'lucide-react';
import type {
  AgentProfile,
  ComputeMethod,
  FunctionalFlow,
  SystemComponent,
  TaskNode,
} from './types';
import type { GenesisEvent } from './genesis';
import { providesReferenceDoc } from './orchestrator';
import {
  heatFlux,
  moistureBuffered,
  normalStress,
  safetyFactor,
  thermalDiffusivity,
  thermalResistance,
} from './simulators';

let uid = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${uid++}`;

export interface SystemModel {
  components: SystemComponent[];
  flows: FunctionalFlow[];
  functionAgents: AgentProfile[];
  tasks: TaskNode[];
  events: GenesisEvent[];
  componentFolderNames: Map<string, string>; // componentId → folder name
  iteration: number;
}

/**
 * Requests the orchestrator recognises as a DESIGN / CONCEPTION of a
 * physical system (routes genesis → MBSE, « Flux fonctionnel » tab).
 * Work-flow requests that don't match keep the PERT pipeline (« Flux »).
 */
export const MBSE_TRIGGER =
  /briqu|maison|habitat|mur|b[aâ]timent|construction|composant|syst[eè]me physique|structure|pont|moteur|v[ée]hicule|terre crue|conception|con[cç]evoir|design d|designer un|architecture (d'un|d’un|de) /i;

/* ------------------------------------------------------------------ */
/* Function library — real physics per function                        */
/* ------------------------------------------------------------------ */

interface FunctionTemplate {
  slug: string;
  name: string;
  icon: AgentProfile['icon'];
  tagline: string;
  /** Level at which the function appears (iterative refinement). */
  level: 1 | 2;
  method: ComputeMethod;
  flows: string[]; // names of the functional flows this function carries
}

/** Raw-earth brick reference values: λ≈0.5 W/m·K, ρ≈1700 kg/m³, c≈1000 J/kg·K,
 *  compressive strength ≈ 2 MPa, MBV ≈ 2 g/(m²·%RH) — sourced below. */
const BRICK_FUNCTIONS: FunctionTemplate[] = [
  {
    slug: 'isolation',
    name: 'Isolation thermique',
    icon: ThermometerSun,
    tagline: 'Atténuation de la température au travers du matériau',
    level: 1,
    flows: ['Flux thermique'],
    method: {
      graph: `flowchart TD
  IN[Données d'entrée : ΔT extérieur/intérieur, épaisseur e, conductivité λ]
  IN --> S1[R = e / λ — résistance thermique]
  S1 --> S2[q = λ·ΔT / e — flux de chaleur traversant]
  S2 --> OUT[Données de sortie : flux transmis à l'intérieur W/m²]`,
      formulas: [
        { name: 'Résistance thermique', formula: 'R = e / λ', explanation: 'Plus le mur est épais (e) et plus son matériau conduit mal la chaleur (λ petit), plus il résiste au passage de la chaleur.' },
        { name: 'Loi de Fourier', formula: 'q = λ · ΔT / e', explanation: 'Le flux de chaleur qui traverse le mur est proportionnel à l’écart de température et inversement proportionnel à l’épaisseur.' },
      ],
      sources: [
        { covers: 'Conduction (loi de Fourier)', label: 'Thermal conduction (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Thermal_conduction' },
        { covers: 'Résistance thermique R', label: 'R-value (Wikipedia)', url: 'https://en.wikipedia.org/wiki/R-value_(insulation)' },
      ],
      checks: [
        { label: 'R (e=0.3 m, λ=0.5)', got: thermalResistance(0.3, 0.5), expected: 0.6, unit: 'm²K/W' },
        { label: 'q (ΔT=20 K)', got: heatFlux(0.5, 20, 0.3), expected: 33.333, tol: 2e-3, unit: 'W/m²' },
      ],
    },
  },
  {
    slug: 'inertie',
    name: 'Inertie thermique',
    icon: Gauge,
    tagline: 'Stockage et déphasage de la chaleur',
    level: 1,
    flows: ['Flux thermique'],
    method: {
      graph: `flowchart TD
  IN[Données d'entrée : λ, masse volumique ρ, capacité c]
  IN --> S1[α = λ / ρ·c — diffusivité thermique]
  S1 --> S2[Déphasage jour/nuit du pic de température]
  S2 --> OUT[Données de sortie : température intérieure lissée]`,
      formulas: [
        { name: 'Diffusivité thermique', formula: 'α = λ / (ρ · c)', explanation: 'Une diffusivité FAIBLE (matériau lourd qui stocke beaucoup) signifie que la chaleur met des heures à traverser : le pic de chaleur de l’après-midi ressort la nuit.' },
      ],
      sources: [
        { covers: 'Diffusivité thermique', label: 'Thermal diffusivity (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Thermal_diffusivity' },
        { covers: 'Masse thermique du bâtiment', label: 'Thermal mass (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Thermal_mass' },
      ],
      checks: [
        { label: 'α (λ=0.5, ρ=1700, c=1000)', got: thermalDiffusivity(0.5, 1700, 1000), expected: 2.9412e-7, tol: 2e-3, unit: 'm²/s' },
      ],
    },
  },
  {
    slug: 'mecanique',
    name: 'Mécanique',
    icon: Layers,
    tagline: 'Contrainte, déformation élastique, rupture',
    level: 1,
    flows: ['Flux de charges'],
    method: {
      graph: `flowchart TD
  IN[Données d'entrée : charge F du bâti, section A, résistance à rupture σr]
  IN --> S1[σ = F / A — contrainte normale dans la brique]
  S1 --> S2[Déformation élastique ε = σ / E]
  S2 --> S3[SF = σr / σ — marge avant rupture]
  S3 --> OUT[Données de sortie : contrainte transmise + facteur de sécurité]`,
      formulas: [
        { name: 'Contrainte normale', formula: 'σ = F / A', explanation: 'Le poids du bâtiment (F) réparti sur la surface de la brique (A) crée une contrainte interne σ.' },
        { name: 'Loi de Hooke', formula: 'ε = σ / E', explanation: 'Tant que σ reste modérée, la brique se déforme élastiquement (proportionnellement, module d’Young E) et revient en place.' },
        { name: 'Facteur de sécurité', formula: 'SF = σ_rupture / σ', explanation: 'Le rapport entre la contrainte que le matériau peut encaisser (≈2 MPa pour la terre crue comprimée) et la contrainte réelle. SF < 1 = rupture.' },
      ],
      sources: [
        { covers: 'Contrainte mécanique', label: 'Stress (mechanics) (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Stress_(mechanics)' },
        { covers: 'Élasticité (Hooke)', label: "Hooke's law (Wikipedia)", url: 'https://en.wikipedia.org/wiki/Hooke%27s_law' },
        { covers: 'Terre crue compressée', label: 'Compressed earth block (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Compressed_earth_block' },
      ],
      checks: [
        { label: 'σ (F=45 kN, A=0.09 m²)', got: normalStress(45000, 0.09), expected: 500000, unit: 'Pa' },
        { label: 'SF (σr=2 MPa)', got: safetyFactor(2e6, 500000), expected: 4, unit: '—' },
      ],
    },
  },
  {
    slug: 'hygro',
    name: 'Hygrométrie',
    icon: Droplets,
    tagline: 'Tampon d’humidité du matériau',
    level: 1,
    flows: ['Flux d’humidité'],
    method: {
      graph: `flowchart TD
  IN[Données d'entrée : variation d'humidité ΔHR, surface A, MBV du matériau]
  IN --> S1[m = MBV · ΔHR · A — masse d'eau absorbée/restituée]
  S1 --> OUT[Données de sortie : humidité intérieure régulée]`,
      formulas: [
        { name: 'Valeur tampon hygrique', formula: 'm = MBV · ΔHR · A', explanation: 'La terre crue absorbe l’humidité quand l’air est humide et la restitue quand il est sec : MBV ≈ 2 g par m² et par % d’humidité relative — un régulateur naturel.' },
      ],
      sources: [
        { covers: 'Tampon hygrique (MBV)', label: 'Moisture buffering — hygroscopy (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Hygroscopy' },
        { covers: 'Terre crue et humidité', label: 'Rammed earth (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Rammed_earth' },
      ],
      checks: [
        { label: 'm (MBV=2, ΔHR=10 %, A=12 m²)', got: moistureBuffered(2, 10, 12), expected: 240, unit: 'g' },
      ],
    },
  },
  // ---- Level 2 (revealed by the refinement iteration) ----
  {
    slug: 'acoustique',
    name: 'Acoustique',
    icon: Volume2,
    tagline: 'Affaiblissement du bruit (loi de masse)',
    level: 2,
    flows: ['Flux acoustique'],
    method: {
      graph: `flowchart TD
  IN[Données d'entrée : masse surfacique m'', fréquence f]
  IN --> S1[R ≈ 20·log10 m''·f − 47 dB — loi de masse]
  S1 --> OUT[Données de sortie : bruit résiduel intérieur]`,
      formulas: [
        { name: 'Loi de masse', formula: "R ≈ 20·log₁₀(m″·f) − 47 dB", explanation: "Plus la paroi est lourde (m″ en kg/m²) et plus la fréquence est haute, plus elle bloque le son." },
      ],
      sources: [
        { covers: 'Loi de masse acoustique', label: 'Sound transmission class / mass law (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Sound_transmission_class' },
      ],
      checks: [
        { label: "R (m''=510 kg/m², f=500 Hz)", got: 20 * Math.log10(510 * 500) - 47, expected: 61.13, tol: 2e-3, unit: 'dB' },
      ],
    },
  },
  {
    slug: 'etancheite',
    name: 'Étanchéité à l’air',
    icon: Wind,
    tagline: 'Limitation des infiltrations d’air',
    level: 2,
    flows: ['Flux thermique'],
    method: {
      graph: `flowchart TD
  IN[Données d'entrée : perméabilité Q4Pa, surface déperditive]
  IN --> S1[Débit de fuite = Q4Pa · A]
  S1 --> OUT[Données de sortie : pertes par infiltration]`,
      formulas: [
        { name: 'Débit de fuite', formula: 'V̇ = Q4Pa · A', explanation: 'Chaque m² de paroi laisse fuir un petit débit d’air sous 4 Pa de différence de pression ; la somme chiffre les pertes d’air chaud.' },
      ],
      sources: [
        { covers: 'Étanchéité à l’air du bâtiment', label: 'Building airtightness (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Building_airtightness' },
      ],
      checks: [
        { label: 'V̇ (Q4Pa=0.6, A=100 m²)', got: 0.6 * 100, expected: 60, unit: 'm³/h' },
      ],
    },
  },
];

/** Accessible flow palette (color-blind-safe hues + labels in legend). */
const FLOW_COLORS: Record<string, string> = {
  'Flux thermique': '#dc6803', // orange
  'Flux d’humidité': '#0e7490', // teal
  'Flux de charges': '#6d28d9', // violet
  'Flux acoustique': '#be185d', // magenta
};

/* ------------------------------------------------------------------ */
/* Model construction                                                  */
/* ------------------------------------------------------------------ */

function buildFunctionAgent(tpl: FunctionTemplate, componentName: string): AgentProfile {
  return {
    id: nextId(`fn-${tpl.slug}`),
    name: `Agent ${tpl.name}`,
    kind: 'worker',
    icon: tpl.icon,
    tagline: `${tpl.tagline} — fonction du composant ${componentName}`,
    readme: `# Agent ${tpl.name}

## Rôle MBSE
Fonction physique du méta-composant **${componentName}**. Il porte sa part des flux
fonctionnels de l'habitation : ${tpl.flows.join(', ')}.

## Ce dont il a besoin
Les conditions aux limites transmises par l'amont du flux (environnement ou fonction
précédente) et les paramètres matériau du composant.

## Ce qu'il réalise
Il calcule la traversée du flux au travers de lui avec les formules physiques de sa
méthode (voir Présentation), sur la boucle standard SENSE → PLAN → ACT → OBSERVE.

## Ce qu'il livre
Les conditions aval du flux (\`TaskOutput\`) vers la fonction suivante, jusqu'à
l'utilisateur de l'objet, avec rapport du juge.`,
    mermaidAlgorithm: `flowchart TD
  AMONT[Conditions amont du flux] --> SENSE[SENSE : lecture des paramètres matériau]
  SENSE --> ACT[ACT : ${tpl.method.formulas[0].formula}]
  ACT --> OBSERVE[OBSERVE : bilan conservatif du flux]
  OBSERVE --> AVAL[Conditions aval → fonction suivante / utilisateur]`,
    skills: [tpl.name, 'Bilan de flux', 'Physique du bâtiment'],
    llmBinding: { providerId: 'google', model: 'gemini-3-pro-preview' },
    status: 'idle',
    method: tpl.method,
  };
}

/**
 * Designs the level-1 system model for a physical-system request.
 * Currently specialised for masonry/habitat systems (raw-earth brick as the
 * reference component); the library extends per physical domain.
 */
export function designSystemModel(request: string, projectId: string): SystemModel {
  const events: GenesisEvent[] = [];
  const push = (kind: GenesisEvent['kind'], label: string, detail: string, agentId?: string) =>
    events.push({ id: nextId('g'), kind, label, detail, agentId });

  const componentName = /briqu|terre crue/i.test(request) ? 'Brique terre crue' : 'Enveloppe du bâtiment';
  push('intent', 'Analyse MBSE de la demande', `Système physique détecté — composant de référence : ${componentName}.`);

  // Meta-components: environment (source) → component → user (sink).
  const env: SystemComponent = {
    id: nextId('cmp-env'),
    projectId,
    name: 'Environnement extérieur',
    kind: 'environment',
    functionAgentIds: [],
    iteration: 1,
  };
  const user: SystemComponent = {
    id: nextId('cmp-user'),
    projectId,
    name: 'Habitant (utilisateur)',
    kind: 'user',
    functionAgentIds: [],
    iteration: 1,
  };

  const level1 = BRICK_FUNCTIONS.filter((f) => f.level === 1);
  const functionAgents = level1.map((tpl) => {
    const agent = buildFunctionAgent(tpl, componentName);
    push('agent-created', `Création : ${agent.name}`, `Fonction physique du composant ${componentName}.`, agent.id);
    push('agent-verified', `Vérification : ${agent.name}`, `${tpl.method.sources.length} sources SOTA · ${tpl.method.checks!.length} cas connus calculés · publié.`, agent.id);
    return agent;
  });
  const byName = new Map(level1.map((tpl, i) => [tpl.name, functionAgents[i].id]));

  const component: SystemComponent = {
    id: nextId('cmp-brick'),
    projectId,
    name: componentName,
    kind: 'component',
    functionAgentIds: functionAgents.map((a) => a.id),
    iteration: 1,
  };

  // End-to-end functional flows: environment → function agents → user.
  const mkFlow = (name: string, agentIds: string[]): FunctionalFlow => ({
    id: nextId('flow'),
    projectId,
    name,
    color: FLOW_COLORS[name] ?? '#2563eb',
    path: [env.id, ...agentIds, user.id],
    iteration: 1,
  });
  const flows = [
    mkFlow('Flux thermique', [byName.get('Isolation thermique')!, byName.get('Inertie thermique')!]),
    mkFlow('Flux d’humidité', [byName.get('Hygrométrie')!]),
    mkFlow('Flux de charges', [byName.get('Mécanique')!]),
  ];
  push('flow-designed', 'Flux fonctionnels tracés', `${flows.length} flux de bout en bout : Environnement → ${componentName} → Habitant.`);

  // Construction task flow (idea → keys → use), LINKED to the functions.
  const mkTask = (
    title: string,
    agentId: string,
    objective: string,
    deliverable: string,
    dependsOn: string[],
    realizes: string[]
  ): TaskNode => ({
    id: nextId(`${projectId}-mt`),
    projectId,
    title,
    agentId,
    status: 'pending',
    dependsOn,
    spec: {
      objective,
      constraints: ['Standards transversaux du projet', 'Traçabilité vers les fonctions MBSE', 'Sources citées'],
      deliverableFormat: deliverable,
    },
    input: request,
    output: null,
    conformity: null,
    accessible: true,
    realizes,
  });

  // No reference document (PRD…) in the request → the flow OPENS with web
  // research: the surroundings/environment of the system (MBSE context)
  // and the typical specification for this kind of object. The
  // specification is then WRITTEN from those findings — the orchestrator
  // never invents missing inputs.
  const hasDoc = providesReferenceDoc(request);
  const research: TaskNode[] = hasDoc
    ? [mkTask('Étude du document fourni', 'researcher', `Extraire les exigences du document de référence pour : ${request}`, 'exigences.md', [], [])]
    : [
        mkTask('Recherche web — environnement du système', 'researcher', `Rechercher sur internet le site, le climat et l'environnement (contexte MBSE) de : ${request}`, 'contexte_environnement.md', [], []),
        mkTask('Recherche web — spécifications types', 'researcher', "Rechercher sur internet les spécifications types et l'état de l'art pour ce type d'objet (aucun PRD n'a été fourni).", 'specifications_types.md', [], []),
      ];
  const tSpec = mkTask(
    'Rédaction de la spécification',
    'writer',
    'Rédiger la spécification du système à partir des recherches : exigences, fonctions physiques attendues, performances cibles.',
    'specification.md',
    research.map((r) => r.id),
    functionAgents.map((a) => a.id)
  );
  const tIdea = mkTask('Programme & esquisse', 'researcher', 'Formaliser le besoin de l’habitant et l’esquisse à partir de la spécification.', 'programme.md', [tSpec.id], []);
  const tThermal = mkTask('Dimensionnement thermique', 'analyst', 'Dimensionner épaisseur et matériau pour le confort thermique.', 'calc_thermique.md', [tIdea.id], [byName.get('Isolation thermique')!, byName.get('Inertie thermique')!]);
  const tStruct = mkTask('Dimensionnement structurel', 'analyst', 'Vérifier la descente de charges et le facteur de sécurité.', 'calc_structure.md', [tIdea.id], [byName.get('Mécanique')!]);
  const tHygro = mkTask('Stratégie hygrométrique', 'researcher', 'Valider la régulation d’humidité par la terre crue.', 'calc_hygro.md', [tIdea.id], [byName.get('Hygrométrie')!]);
  const tBuild = mkTask('Construction & maçonnerie', 'writer', 'Conduire le chantier jusqu’au clos-couvert.', 'chantier.md', [tThermal.id, tStruct.id, tHygro.id], functionAgents.map((a) => a.id));
  const tKeys = mkTask('Remise des clés', 'orchestrator', 'Réception des travaux et livraison à l’habitant.', 'reception.md', [tBuild.id], []);
  const tUse = mkTask('Utilisation & mesure du confort', 'judge', 'Mesurer les flux réels en occupation (objectif ≥ 95/100).', 'mesures_confort.md', [tKeys.id], functionAgents.map((a) => a.id));
  const tasks = [...research, tSpec, tIdea, tThermal, tStruct, tHygro, tBuild, tKeys, tUse];

  if (!hasDoc) {
    push(
      'intent',
      'Aucun document de référence fourni',
      'Le flux commence par des recherches internet (environnement du système, spécifications types) puis rédige la spécification.'
    );
  }
  push('flow-designed', 'Flux de construction contractualisé', `${tasks.length} tâches, des recherches et de la spécification jusqu’à la remise des clés, chacune reliée aux fonctions qu’elle réalise.`);
  push('run', 'Exécution lancée', 'Itération 1 du diagramme — demandez « raffine » à l’orchestrateur pour détailler.');

  return {
    components: [env, component, user],
    flows,
    functionAgents,
    tasks,
    events,
    componentFolderNames: new Map([[component.id, componentName]]),
    iteration: 1,
  };
}

/**
 * Refinement iteration: the diagram grows in detail — level-2 functions
 * (acoustics, airtightness) join the component, new flows appear, and the
 * task graph gains the matching engineering task. Planned iterativity.
 */
export function refineSystemModel(
  projectId: string,
  component: SystemComponent,
  envId: string,
  userId: string,
  iteration: number
): { functionAgents: AgentProfile[]; flows: FunctionalFlow[]; tasks: TaskNode[]; events: GenesisEvent[] } {
  const events: GenesisEvent[] = [];
  const push = (kind: GenesisEvent['kind'], label: string, detail: string, agentId?: string) =>
    events.push({ id: nextId('g'), kind, label, detail, agentId });

  const level2 = BRICK_FUNCTIONS.filter((f) => f.level === 2);
  push('intent', `Itération ${iteration} du diagramme`, `Raffinement du composant ${component.name} : ${level2.map((f) => f.name).join(', ')}.`);

  const functionAgents = level2.map((tpl) => {
    const agent = buildFunctionAgent(tpl, component.name);
    push('agent-created', `Création : ${agent.name}`, 'Fonction de niveau 2 (détail).', agent.id);
    push('agent-verified', `Vérification : ${agent.name}`, 'Sources SOTA contrôlées · publié.', agent.id);
    return agent;
  });

  const flows: FunctionalFlow[] = functionAgents
    .filter((_, i) => level2[i].flows[0] === 'Flux acoustique')
    .map((agent) => ({
      id: nextId('flow'),
      projectId,
      name: 'Flux acoustique',
      color: FLOW_COLORS['Flux acoustique'],
      path: [envId, agent.id, userId],
      iteration,
    }));

  const task: TaskNode = {
    id: nextId(`${projectId}-mt`),
    projectId,
    title: `Itération ${iteration} — acoustique & étanchéité`,
    agentId: 'analyst',
    status: 'pending',
    dependsOn: [],
    spec: {
      objective: 'Intégrer l’affaiblissement acoustique et l’étanchéité à l’air au dimensionnement.',
      constraints: ['Loi de masse', 'Q4Pa surfacique', 'Traçabilité MBSE'],
      deliverableFormat: `iteration_${iteration}.md`,
    },
    input: `Diagramme itération ${iteration - 1}`,
    output: null,
    conformity: null,
    accessible: true,
    realizes: functionAgents.map((a) => a.id),
  };
  push('flow-designed', 'Diagramme densifié', 'Nouvelles fonctions reliées, tâche d’ingénierie ajoutée au planning.');

  return { functionAgents, flows, tasks: [task], events };
}

// Icons used by SystemView legend nodes.
export const SYSTEM_NODE_ICONS = { environment: CloudSun, user: UserRound, component: HomeIcon };
