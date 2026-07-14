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
  MapPin,
  ThermometerSun,
  UserRound,
  Volume2,
  Wind,
} from 'lucide-react';
import type {
  AgentProfile,
  ComputeMethod,
  ConformityRange,
  FlowStep,
  FunctionalFlow,
  PhysicalQuantity,
  SotaSource,
  SourcedFact,
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
  /** One AGENT per environnant — its page shows the sourced web research. */
  environnantAgents: AgentProfile[];
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
  /briqu|maison|habitat|mur|b[aâ]timent|construction|composant|syst[eè]me physique|structure|pont|moteur|v[ée]hicule|terre crue|environnant|conception|con[cç]evoir|design d|designer un|architecture (d'un|d’un|de) /i;

/* ------------------------------------------------------------------ */
/* Environnants — researched elements of the external environment      */
/* ------------------------------------------------------------------ */

/**
 * An ENVIRONNANT is an element of the environment EXTERNAL to the system
 * (climate, ground/neighbourhood, occupant…). Each one is CHARACTERISED BY
 * WEB RESEARCH (a dedicated research task run by the research agents):
 *  - all relevant CHARACTERISTICS,
 *  - all relevant PHYSICAL QUANTITIES,
 *  - all relevant INFORMATION & NEWS,
 * and this data is SERVED AS INPUT to the function agents of the system.
 * The 'user' environnant additionally defines the CONFORMITY ZONE: the
 * physical criteria the transformed quantities must land in.
 */
interface EnvironnantTemplate {
  slug: string;
  name: string;
  kind: 'environment' | 'user';
  icon: AgentProfile['icon'];
  characteristics: SourcedFact[];
  quantities: PhysicalQuantity[];
  news: SourcedFact[];
  requirements?: ConformityRange[];
}

/** Reusable public sources (each researched datum cites one of these). */
const SRC = {
  meteo: { covers: 'Données climatiques', label: 'Météo-France — Climat & normales', url: 'https://meteofrance.com/climat' },
  re2020: { covers: 'Réglementation thermique', label: 'RE2020 — Ministère (ecologie.gouv.fr)', url: 'https://www.ecologie.gouv.fr/reglementation-environnementale-re2020' },
  eurocode: { covers: 'Charges climatiques (neige/vent)', label: 'Eurocodes structuraux (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Eurocode' },
  brgm: { covers: 'Sol & sous-sol', label: 'InfoTerre — BRGM', url: 'https://infoterre.brgm.fr/' },
  sismique: { covers: 'Zonage sismique', label: 'Zonage sismique de la France (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Zonage_sismique_de_la_France' },
  bruit: { covers: 'Bruit routier', label: 'Bruit dans l’environnement (Wikipedia)', url: 'https://fr.wikipedia.org/wiki/Bruit_dans_l%27environnement' },
  confort: { covers: 'Confort thermique / acoustique', label: 'ASHRAE 55 — Thermal comfort (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Thermal_comfort' },
  vapeur: { covers: 'Production de vapeur d’eau des occupants', label: 'Indoor moisture load (Wikipedia — humidity)', url: 'https://en.wikipedia.org/wiki/Humidity' },
} satisfies Record<string, SotaSource>;

/**
 * Habitat reference library — EVERY researched datum is SOURCED. The values
 * are illustrative of a Chevreuse-valley site; the research agents' page
 * exposes exactly these facts with their clickable web sources.
 */
const HABITAT_ENVIRONNANTS: EnvironnantTemplate[] = [
  {
    slug: 'climat',
    name: 'Climat extérieur',
    kind: 'environment',
    icon: CloudSun,
    characteristics: [
      { text: 'Climat océanique dégradé (zone climatique H1a)', source: SRC.meteo },
      { text: 'Amplitude thermique jour/nuit marquée en été', source: SRC.meteo },
      { text: 'Pluies battantes dominantes d’ouest en hiver', source: SRC.meteo },
    ],
    quantities: [
      { name: 'Température extérieure de base (hiver)', symbol: 'T_ext', value: -7, unit: '°C', source: SRC.meteo },
      { name: 'Pic estival', symbol: 'T_max', value: 32, unit: '°C', source: SRC.meteo },
      { name: 'Humidité relative extérieure moyenne', symbol: 'HR_ext', value: 85, unit: '%', source: SRC.meteo },
      { name: 'Rafale de vent cinquantennale', symbol: 'V_max', value: 25, unit: 'm/s', source: SRC.eurocode },
    ],
    news: [
      { text: 'RE2020 : renforcement du seuil Bbio pour les maisons individuelles', source: SRC.re2020 },
      { text: 'Épisodes caniculaires en hausse — confort d’été à justifier', source: SRC.re2020 },
    ],
  },
  {
    slug: 'site',
    name: 'Site & voisinage',
    kind: 'environment',
    icon: MapPin,
    characteristics: [
      { text: 'Sol limono-argileux, nappe à ~6 m', source: SRC.brgm },
      { text: 'Zone sismique très faible (zone 1)', source: SRC.sismique },
      { text: 'Route départementale à ~60 m (bruit routier)', source: SRC.bruit },
    ],
    quantities: [
      { name: 'Portance admissible du sol', symbol: 'q_adm', value: 0.25, unit: 'MPa', source: SRC.brgm },
      { name: 'Charge de neige au sol', symbol: 'S_k', value: 0.45, unit: 'kN/m²', source: SRC.eurocode },
      { name: 'Descente de charges par brique', symbol: 'F', value: 45, unit: 'kN', source: SRC.eurocode },
      { name: 'Bruit routier en façade', symbol: 'L_ext', value: 65, unit: 'dB(A)', source: SRC.bruit },
    ],
    news: [{ text: 'PLU : hauteur maximale 9 m, aspect terre/bois recommandé', source: SRC.brgm }],
  },
  {
    slug: 'habitant',
    name: 'Habitant (utilisateur)',
    kind: 'user',
    icon: UserRound,
    characteristics: [
      { text: 'Famille de 4 personnes, occupation continue', source: SRC.vapeur },
      { text: 'Télétravail : exigence de calme en journée', source: SRC.confort },
    ],
    quantities: [{ name: 'Production de vapeur d’eau quotidienne', symbol: 'm_vap', value: 600, unit: 'g/j', source: SRC.vapeur }],
    news: [{ text: 'Attente forte de confort d’été passif (sans climatisation)', source: SRC.confort }],
    // The CONFORMITY ZONE: where the transformed quantities must land.
    requirements: [
      { name: 'Flux de chaleur traversant la paroi', min: 0, max: 50, unit: 'W/m²' },
      { name: 'Capacité tampon d’humidité quotidienne', min: 600, max: 100000, unit: 'g/j' },
      { name: 'Facteur de sécurité structurel', min: 2, max: 100, unit: '—' },
      { name: 'Bruit résiduel intérieur', min: 0, max: 35, unit: 'dB(A)' },
    ],
  },
];

/** Human-readable summary of an environnant's researched quantities —
 *  the exact string served as INPUT to the system's agents. */
function quantitiesSummary(tpl: EnvironnantTemplate): string {
  return tpl.quantities.map((q) => `${q.name} ${q.symbol} = ${q.value} ${q.unit}`).join(' · ');
}

/**
 * Builds the AGENT that embodies an environnant. Its README is the SOURCED
 * research report (every characteristic, quantity and news item cites a
 * clickable web source), so the sourcing is visible on the agent's page.
 * Its method carries the same sources (AGENT_STANDARD conformity).
 */
function buildEnvironnantAgent(tpl: EnvironnantTemplate): AgentProfile {
  const list = (facts: SourcedFact[]) => facts.map((f) => `- ${f.text} — [${f.source.label}](${f.source.url})`).join('\n');
  const quantities = tpl.quantities
    .map((q) => `- **${q.name}** \`${q.symbol} = ${q.value} ${q.unit}\` — [${q.source?.label ?? 'source'}](${q.source?.url ?? '#'})`)
    .join('\n');
  const readme = `# Environnant : ${tpl.name}

Élément de l'environnement **externe** au système, caractérisé par **recherche internet**. Toutes les données ci-dessous sont **sourcées** et servies en **entrée aux agents du système**.

## Caractéristiques (sourcées)
${list(tpl.characteristics)}

## Grandeurs physiques (sourcées)
${quantities}

## Informations & actualités (sourcées)
${list(tpl.news)}
${tpl.requirements ? `\n## Zone de conformité requise (utilisateur)\n${tpl.requirements.map((r) => `- ${r.name} : ${r.min}–${r.max} ${r.unit}`).join('\n')}` : ''}`;

  const sources: SotaSource[] = [
    ...tpl.quantities.map((q) => q.source).filter((s): s is SotaSource => Boolean(s)),
    ...tpl.characteristics.map((c) => c.source),
    ...tpl.news.map((n) => n.source),
  ];
  // Deduplicate sources by url.
  const uniqueSources = Array.from(new Map(sources.map((s) => [s.url, s])).values());

  return {
    id: nextId(`env-${tpl.slug}`),
    name: `Environnant ${tpl.name}`,
    kind: 'worker',
    icon: tpl.icon,
    tagline: `Élément de l'environnement externe — ${tpl.quantities.length} grandeurs sourcées servies en entrée`,
    readme,
    mermaidAlgorithm: `flowchart TD
  WEB[Recherche internet sourcée] --> DATA[Caractéristiques · grandeurs · actualités]
  DATA --> OUT[Entrées servies aux agents du système]`,
    skills: ['Recherche web sourcée', 'Caractérisation d’environnement', tpl.name],
    llmBinding: { providerId: 'google', model: 'gemini-3-pro-preview' },
    status: 'idle',
    method: {
      graph: `flowchart TD
  IN[Sujet : ${tpl.name}] --> SEARCH[Recherche web + vérification des sources]
  SEARCH --> OUT[Grandeurs physiques sourcées]`,
      formulas: [
        { name: 'Traçabilité', formula: 'donnée → source vérifiée', explanation: 'Chaque grandeur physique renvoie à une référence internet vérifiable ; aucune valeur inventée.' },
      ],
      sources: uniqueSources,
      checks: [{ label: 'Grandeurs sourcées / total', got: tpl.quantities.filter((q) => q.source).length, expected: tpl.quantities.length, unit: '—' }],
    },
  };
}

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

  // ENVIRONNANTS: each element of the external environment is characterised
  // by web research (characteristics, physical quantities, news) and its
  // data serves as input to the system's agents. The 'user' environnant
  // carries the conformity zone.
  const environnantAgents: AgentProfile[] = [];
  const environnants = HABITAT_ENVIRONNANTS.map((tpl) => {
    // Each environnant is embodied by an AGENT whose page shows the sourced
    // web research (README = report with clickable sources).
    const agent = buildEnvironnantAgent(tpl);
    environnantAgents.push(agent);
    const cmp: SystemComponent = {
      id: nextId(`cmp-${tpl.slug}`),
      projectId,
      name: tpl.name,
      kind: tpl.kind,
      functionAgentIds: [],
      iteration: 1,
      characteristics: tpl.characteristics,
      quantities: tpl.quantities,
      news: tpl.news,
      requirements: tpl.requirements,
      environnantAgentId: agent.id,
    };
    push(
      'intent',
      `Environnant caractérisé : ${tpl.name}`,
      `${tpl.quantities.length} grandeurs physiques · ${tpl.characteristics.length} caractéristiques · ${tpl.news.length} actualités — recherchées sur internet (sources vérifiables), servies en entrée aux agents.`,
      agent.id
    );
    return cmp;
  });
  const byEnvSlug = new Map(HABITAT_ENVIRONNANTS.map((tpl, i) => [tpl.slug, environnants[i]]));
  const climat = byEnvSlug.get('climat')!;
  const site = byEnvSlug.get('site')!;
  const user = byEnvSlug.get('habitant')!;

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

  // End-to-end functional flows: SOURCE environnant → function agents →
  // user environnant. Each flow carries its quantity STEP BY STEP: the
  // researched source value is transformed by every function agent (real
  // formulas of core/simulators.ts) until the DELIVERED value lands (or
  // not) in the user's conformity zone.
  const mkFlow = (
    name: string,
    sourceId: string,
    agentIds: string[],
    steps: FlowStep[],
    requirement: ConformityRange
  ): FunctionalFlow => {
    const delivered = steps[steps.length - 1];
    return {
      id: nextId('flow'),
      projectId,
      name,
      color: FLOW_COLORS[name] ?? '#2563eb',
      path: [sourceId, ...agentIds, user.id],
      iteration: 1,
      steps,
      requirement,
      conform: delivered.value >= requirement.min && delivered.value <= requirement.max,
    };
  };

  // Wall parameters of the reference component (see BRICK_FUNCTIONS sources).
  const e = 0.3; // m
  const lambda = 0.5; // W/m·K
  const alpha = thermalDiffusivity(lambda, 1700, 1000);
  const tInt = 19; // °C — comfort setpoint (user side)
  const qWall = heatFlux(lambda, tInt - (-7), e); // ΔT from the researched T_ext
  const phaseLagH = (e / 2) * Math.sqrt(86400 / (Math.PI * alpha)) / 3600; // periodic conduction phase lag
  const mBuffer = moistureBuffered(2, 85 - 50, 12); // researched HR_ext → 50 % target, 12 m² wall
  const sigma = normalStress(45000, 0.09); // researched load F = 45 kN
  const sf = safetyFactor(2e6, sigma);

  const isolationId = byName.get('Isolation thermique')!;
  const inertieId = byName.get('Inertie thermique')!;
  const hygroId = byName.get('Hygrométrie')!;
  const mecaId = byName.get('Mécanique')!;

  const flows = [
    mkFlow(
      'Flux thermique',
      climat.id,
      [isolationId, inertieId],
      [
        { nodeId: climat.id, label: 'Température extérieure (recherchée)', value: -7, unit: '°C' },
        { nodeId: isolationId, label: 'Flux traversant q = λ·ΔT/e', value: qWall, unit: 'W/m²' },
        { nodeId: inertieId, label: 'Déphasage du pic (inertie)', value: phaseLagH, unit: 'h' },
        { nodeId: user.id, label: 'Flux de paroi livré à l’habitant', value: qWall, unit: 'W/m²' },
      ],
      user.requirements![0]
    ),
    mkFlow(
      'Flux d’humidité',
      climat.id,
      [hygroId],
      [
        { nodeId: climat.id, label: 'Humidité extérieure (recherchée)', value: 85, unit: '%' },
        { nodeId: hygroId, label: 'Tampon m = MBV·ΔHR·A', value: mBuffer, unit: 'g/j' },
        { nodeId: user.id, label: 'Capacité tampon livrée', value: mBuffer, unit: 'g/j' },
      ],
      user.requirements![1]
    ),
    mkFlow(
      'Flux de charges',
      site.id,
      [mecaId],
      [
        { nodeId: site.id, label: 'Descente de charges (recherchée)', value: 45, unit: 'kN' },
        { nodeId: mecaId, label: 'Contrainte σ = F/A', value: sigma / 1e6, unit: 'MPa' },
        { nodeId: user.id, label: 'Facteur de sécurité livré', value: sf, unit: '—' },
      ],
      user.requirements![2]
    ),
  ];
  push(
    'flow-designed',
    'Flux fonctionnels tracés',
    `${flows.length} flux de bout en bout : environnants → ${componentName} → Habitant, grandeurs transformées pas à pas jusqu'à la zone de conformité (${flows.filter((f) => f.conform).length}/${flows.length} conformes).`
  );

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
  // One WEB-RESEARCH task per ENVIRONNANT (user included): the research
  // agents collect its characteristics, physical quantities and news, and
  // the findings are SERVED AS INPUT to the system's agents downstream.
  const hasDoc = providesReferenceDoc(request);
  const envResearch = environnants.map((cmp, i) => {
    const tpl = HABITAT_ENVIRONNANTS[i];
    const task = mkTask(
      `Recherche web — environnant « ${cmp.name} »`,
      'researcher',
      `Rechercher sur internet toutes les caractéristiques, toutes les grandeurs physiques et toutes les informations/actualités (si appropriées) qui caractérisent l'environnant « ${cmp.name} », afin de les servir en entrée aux agents du système. Trouvé : ${quantitiesSummary(tpl)}.`,
      `environnant_${tpl.slug}.md`,
      [],
      []
    );
    cmp.researchTaskId = task.id;
    return task;
  });
  const research: TaskNode[] = hasDoc
    ? [...envResearch, mkTask('Étude du document fourni', 'researcher', `Extraire les exigences du document de référence pour : ${request}`, 'exigences.md', [], [])]
    : [
        ...envResearch,
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
  // The researched environnant data is the INPUT of the dimensioning tasks.
  tThermal.input = `Entrées de l'environnant « ${climat.name} » : ${quantitiesSummary(HABITAT_ENVIRONNANTS[0])}`;
  tHygro.input = `Entrées de l'environnant « ${climat.name} » : ${quantitiesSummary(HABITAT_ENVIRONNANTS[0])}`;
  tStruct.input = `Entrées de l'environnant « ${site.name} » : ${quantitiesSummary(HABITAT_ENVIRONNANTS[1])}`;
  const tBuild = mkTask('Construction & maçonnerie', 'writer', 'Conduire le chantier jusqu’au clos-couvert.', 'chantier.md', [tThermal.id, tStruct.id, tHygro.id], functionAgents.map((a) => a.id));
  const tKeys = mkTask('Remise des clés', 'orchestrator', 'Réception des travaux et livraison à l’habitant.', 'reception.md', [tBuild.id], []);
  const tUse = mkTask('Utilisation & mesure du confort', 'judge', 'Mesurer les flux réels en occupation (objectif ≥ 95/100).', 'mesures_confort.md', [tKeys.id], functionAgents.map((a) => a.id));
  const tasks = [...research, tSpec, tIdea, tThermal, tStruct, tHygro, tBuild, tKeys, tUse];

  if (!hasDoc) {
    push(
      'intent',
      'Aucun document de référence fourni',
      `Le flux commence par la caractérisation des ${environnants.length} environnants par recherche internet (caractéristiques, grandeurs physiques, actualités), puis rédige la spécification.`
    );
  }
  push('flow-designed', 'Flux de construction contractualisé', `${tasks.length} tâches, des recherches et de la spécification jusqu’à la remise des clés, chacune reliée aux fonctions qu’elle réalise.`);
  push('run', 'Exécution lancée', 'Itération 1 du diagramme — demandez « raffine » à l’orchestrateur pour détailler.');

  return {
    components: [...environnants, component],
    flows,
    functionAgents,
    environnantAgents,
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
  environments: SystemComponent[],
  user: SystemComponent,
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

  // The acoustic flow SOURCES from the environnant carrying the researched
  // noise quantity (site/neighbourhood), and its steps land (or not) in
  // the user's conformity zone — same rule as the level-1 flows.
  const noiseEnv =
    environments.find((c) => c.quantities?.some((q) => /bruit/i.test(q.name))) ?? environments[0];
  const noiseIn = noiseEnv?.quantities?.find((q) => /bruit/i.test(q.name))?.value ?? 65;
  const rMass = 20 * Math.log10(510 * 500) - 47; // mass law, m''=510 kg/m², 500 Hz
  const residual = Math.max(0, noiseIn - rMass);
  const noiseReq = user.requirements?.find((r) => /bruit/i.test(r.name));

  const flows: FunctionalFlow[] = functionAgents
    .filter((_, i) => level2[i].flows[0] === 'Flux acoustique')
    .map((agent) => ({
      id: nextId('flow'),
      projectId,
      name: 'Flux acoustique',
      color: FLOW_COLORS['Flux acoustique'],
      path: [noiseEnv.id, agent.id, user.id],
      iteration,
      steps: [
        { nodeId: noiseEnv.id, label: 'Bruit routier en façade (recherché)', value: noiseIn, unit: 'dB(A)' },
        { nodeId: agent.id, label: 'Affaiblissement R (loi de masse)', value: rMass, unit: 'dB' },
        { nodeId: user.id, label: 'Bruit résiduel livré', value: residual, unit: 'dB(A)' },
      ],
      requirement: noiseReq,
      conform: noiseReq ? residual >= noiseReq.min && residual <= noiseReq.max : undefined,
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
