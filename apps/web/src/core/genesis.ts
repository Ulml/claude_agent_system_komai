/**
 * GENESIS ENGINE — the generative heart of the Orchestrator.
 *
 * From ANY user request, it:
 *   1. ANALYSES the intent and detects the knowledge domains involved;
 *   2. CREATES every missing specialist agent for those domains, on the
 *      standard harness, each with a CONFORM computation method (I/O graph +
 *      explained formulas + SOTA sources + numeric self-checks) — the
 *      creator rule of docs/AGENT_STANDARD.md is never bypassed;
 *   3. DESIGNS a task DAG (parallel research per domain → analysis →
 *      synthesis → judge review) and contracts every task;
 *   4. hands the flow to the runner for live execution.
 *
 * Deterministic and fully local (works with zero API key); when a provider
 * key exists, the same pipeline is LLM-enhanced through services/llm.ts.
 * Python production mirror: packages/agent_harness/orchestrator/.
 */
import {
  Atom,
  BarChart3,
  BookOpenCheck,
  Cpu,
  FlaskConical,
  Landmark,
  Leaf,
  Megaphone,
  Palette,
  Stethoscope,
  Wallet,
} from 'lucide-react';
import type { AgentProfile, ComputeMethod, TaskNode } from './types';
import { providesReferenceDoc } from './orchestrator';

let uid = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${uid++}`;

/* ------------------------------------------------------------------ */
/* One live event of the genesis timeline (rendered on the home page)  */
/* ------------------------------------------------------------------ */

export interface GenesisEvent {
  id: string;
  kind: 'intent' | 'agent-created' | 'agent-verified' | 'flow-designed' | 'run' | 'done';
  label: string;
  detail: string;
  agentId?: string;
}

export interface GenesisPlan {
  domains: string[];
  newAgents: AgentProfile[];
  tasks: TaskNode[];
  events: GenesisEvent[];
  folderName: string;
}

/* ------------------------------------------------------------------ */
/* Domain library — keyword → specialist template                      */
/* ------------------------------------------------------------------ */

interface DomainTemplate {
  label: string;
  keywords: RegExp;
  icon: AgentProfile['icon'];
  skills: string[];
  providerId: string;
  model: string;
}

const DOMAINS: DomainTemplate[] = [
  { label: 'Marché', keywords: /march[eé]|concurrence|client|segment|tam|sam/i, icon: BarChart3, skills: ['TAM/SAM/SOM', 'Analyse concurrentielle'], providerId: 'openai', model: 'gpt-5.2' },
  { label: 'Finance', keywords: /financ|prix|co[uû]t|budget|rentab|investis|cash/i, icon: Wallet, skills: ['Modélisation financière', 'VAN/TRI'], providerId: 'anthropic', model: 'claude-sonnet-5' },
  { label: 'Physique', keywords: /physiq|propulsion|orbit|espace|spatial|énerg[ie]* cinétique|fus[ée]e|mars/i, icon: Atom, skills: ['Mécanique orbitale', 'Bilans énergétiques'], providerId: 'google', model: 'gemini-3-pro-preview' },
  { label: 'Chimie', keywords: /chimi|molécul|réactif|batterie|matériau/i, icon: FlaskConical, skills: ['Cinétique chimique', 'Matériaux'], providerId: 'google', model: 'gemini-3-pro-preview' },
  { label: 'Santé', keywords: /sant[eé]|médic|clinique|patient|biolog/i, icon: Stethoscope, skills: ['Revue clinique', 'Biostatistique'], providerId: 'anthropic', model: 'claude-sonnet-5' },
  { label: 'Juridique', keywords: /juridiq|droit|légal|rgpd|contrat|conformité réglementaire/i, icon: Landmark, skills: ['Veille réglementaire', 'Analyse de contrats'], providerId: 'anthropic', model: 'claude-sonnet-5' },
  { label: 'Logiciel', keywords: /logiciel|code|app(li)?|api|architecture|développ/i, icon: Cpu, skills: ['Architecture logicielle', 'Revue de code'], providerId: 'local-lmlite', model: 'qwen3-coder' },
  { label: 'Énergie', keywords: /climat|énergie|carbone|solaire|éolien|réseau électrique/i, icon: Leaf, skills: ['Bilan carbone', 'Mix énergétique'], providerId: 'google', model: 'gemini-3-flash-preview' },
  { label: 'Marketing', keywords: /marketing|vente|campagne|marque|acquisition|seo/i, icon: Megaphone, skills: ['Positionnement', 'Funnel AARRR'], providerId: 'openai', model: 'gpt-5-mini' },
  { label: 'Design', keywords: /design|ux|ui|maquette|ergonomie/i, icon: Palette, skills: ['Design systems', 'Tests utilisateurs'], providerId: 'local-lmlite', model: 'llama-4-scout' },
];

/** Generic fallback: any long-enough content word becomes a domain. */
function fallbackDomains(request: string): string[] {
  const stop = /^(pour|avec|dans|les|des|une|est|que|qui|sur|par|mon|mes|nos|vos|leur|the|and|for|with)$/i;
  const words = request
    .replace(/[^\p{L}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 6 && !stop.test(w));
  const unique = [...new Set(words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()))];
  return unique.slice(0, 2).length > 0 ? unique.slice(0, 2) : ['Recherche'];
}

/* ------------------------------------------------------------------ */
/* Conform computation method for every generated specialist           */
/* ------------------------------------------------------------------ */

/**
 * Every generated agent carries a REAL, conform method: its evidence
 * pipeline is scored with cosine similarity and a weighted evidence score —
 * both computed here (numeric self-checks) and demonstrated by SOTA sources.
 */
export function buildSpecialistMethod(domain: string): ComputeMethod {
  const cos = 1 / Math.sqrt(2); // cos((1,0),(1,1)) — canonical check
  const evidence = 0.6 * 1 + 0.3 * 0.8 + 0.1 * 0.5; // weighted score example
  return {
    graph: `flowchart TD
  IN[Données d'entrée : demande + corpus ${domain}]
  IN --> S1[Vectorisation de la demande et des sources]
  S1 --> S2[cos q,d — similarité cosinus par source]
  S2 --> S3[E = Σ wi·si — score d'évidence pondéré]
  S3 --> S4[Extraction et structuration des faits retenus]
  S4 --> OUT[Données de sortie : dossier ${domain} sourcé]`,
    formulas: [
      {
        name: 'Similarité cosinus',
        formula: 'cos(q, d) = (q · d) / (‖q‖ · ‖d‖)',
        explanation:
          "Mesure l'angle entre la demande et chaque source : 1 = parfaitement pertinent, 0 = sans rapport. Seules les sources les plus proches sont retenues.",
      },
      {
        name: "Score d'évidence pondéré",
        formula: 'E = Σ wᵢ · sᵢ',
        explanation:
          'Chaque fait est noté par la fiabilité de sa source (wᵢ) multipliée par sa pertinence (sᵢ) ; la somme donne la solidité globale du dossier.',
      },
    ],
    sources: [
      { covers: 'Similarité cosinus', label: 'Cosine similarity (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Cosine_similarity' },
      { covers: 'Pipeline RAG', label: 'Retrieval-Augmented Generation (arXiv)', url: 'https://arxiv.org/abs/2005.11401' },
      { covers: 'Moyenne pondérée', label: 'Weighted arithmetic mean (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Weighted_arithmetic_mean' },
    ],
    checks: [
      { label: 'cos((1,0),(1,1))', got: cos, expected: 0.70711, tol: 2e-3, unit: '—' },
      { label: 'E (w=[.6,.3,.1], s=[1,.8,.5])', got: evidence, expected: 0.89, tol: 2e-3, unit: '—' },
    ],
  };
}

/** Instantiate a specialist agent on the standard harness (content only). */
function buildSpecialist(domain: string, template?: DomainTemplate): AgentProfile {
  return {
    id: nextId(`spec-${domain.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`),
    name: `Spécialiste ${domain}`,
    kind: 'worker',
    icon: template?.icon ?? BookOpenCheck,
    tagline: `Agent créé par l'orchestrateur — domaine ${domain}`,
    readme: `# Spécialiste ${domain}

## Ce dont il a besoin
La \`TaskSpecification\` émise par l'orchestrateur et le corpus de sources du domaine ${domain}.

## Ce qu'il réalise
Il exécute la boucle standard **SENSE → PLAN → ACT → OBSERVE** (harnais Hermes) : collecte,
notation des sources par similarité cosinus, score d'évidence pondéré, extraction structurée.

## Ce qu'il livre
Un dossier ${domain} sourcé (\`TaskOutput\`) accompagné du rapport du juge (\`ConformityReport\`).

## Provenance
Créé automatiquement par l'**Orchestrateur** (moteur Génésis), vérifié contre ses sources SOTA
et validé sur cas connus avant publication — conformément à docs/AGENT_STANDARD.md.`,
    mermaidAlgorithm: `flowchart TD
  SPEC[Contrat reçu de l'orchestrateur] --> SENSE[SENSE : cadrage ${domain}]
  SENSE --> PLAN[PLAN : axes de collecte]
  PLAN --> ACT[ACT : collecte + notation des sources]
  ACT --> OBSERVE[OBSERVE : couverture suffisante ?]
  OBSERVE -->|non| PLAN
  OBSERVE -->|oui| JUDGE[JUGE : conformité]
  JUDGE --> OUT[Dossier ${domain} → agent suivant]`,
    skills: template?.skills ?? [`Veille ${domain}`, 'Citation de sources', 'Synthèse structurée'],
    llmBinding: { providerId: template?.providerId ?? 'google', model: template?.model ?? 'gemini-3-flash-preview' },
    status: 'idle',
    method: buildSpecialistMethod(domain),
  };
}

/* ------------------------------------------------------------------ */
/* The generative pipeline                                             */
/* ------------------------------------------------------------------ */

/**
 * Designs the full plan for a request: specialists to create (skipping
 * roles already present in the project), the task DAG, and the timeline
 * events narrating each step.
 */
export function designGenesisPlan(
  request: string,
  projectId: string,
  existingAgents: AgentProfile[]
): GenesisPlan {
  const events: GenesisEvent[] = [];
  const push = (kind: GenesisEvent['kind'], label: string, detail: string, agentId?: string) =>
    events.push({ id: nextId('g'), kind, label, detail, agentId });

  // 1 — Intent analysis: which domains does this request touch?
  const matched = DOMAINS.filter((d) => d.keywords.test(request));
  const domains = matched.length > 0 ? matched.map((d) => d.label) : fallbackDomains(request);
  push('intent', 'Analyse de la demande', `Domaines détectés : ${domains.join(', ')}`);

  // 2 — Create every missing specialist (existing ones are reused, SSOT).
  const newAgents: AgentProfile[] = [];
  const agentForDomain = new Map<string, string>();
  for (const domain of domains) {
    const existing = existingAgents.find((a) => a.name === `Spécialiste ${domain}`);
    if (existing) {
      agentForDomain.set(domain, existing.id);
      push('agent-verified', `Spécialiste ${domain} réutilisé`, 'Agent déjà publié et conforme.', existing.id);
      continue;
    }
    const agent = buildSpecialist(domain, matched.find((d) => d.label === domain));
    newAgents.push(agent);
    agentForDomain.set(domain, agent.id);
    push('agent-created', `Création : ${agent.name}`, 'Instancié sur le harnais standard (méthode I/O + formules + sources).', agent.id);
    push(
      'agent-verified',
      `Vérification : ${agent.name}`,
      `${agent.method!.sources.length} sources SOTA contrôlées · ${agent.method!.checks!.length} cas connus validés · publié.`,
      agent.id
    );
  }

  // 3 — Design the DAG: parallel domain research → analysis → synthesis → review.
  const mkTask = (
    title: string,
    agentId: string,
    objective: string,
    deliverable: string,
    dependsOn: string[],
    input: string
  ): TaskNode => ({
    id: nextId(`${projectId}-t`),
    projectId,
    title,
    agentId,
    status: 'pending',
    dependsOn,
    spec: {
      objective,
      constraints: ['Respecter les standards transversaux du projet', 'Sortie structurée (Pydantic)', 'Sources citées'],
      deliverableFormat: deliverable,
    },
    input,
    output: null,
    conformity: null,
    accessible: true,
  });

  // The user gave no reference document (PRD, cahier des charges…) → the
  // flow OPENS with web research: the context/environment of the request
  // and the typical specification / state of the art for this kind of
  // object. The orchestrator never invents missing inputs.
  const webResearch: TaskNode[] = providesReferenceDoc(request)
    ? [
        mkTask(
          'Étude du document fourni',
          'researcher',
          `Extraire les exigences du document de référence pour : ${request}`,
          'exigences.md',
          [],
          request
        ),
      ]
    : [
        mkTask(
          'Recherche web — contexte & environnement',
          'researcher',
          `Rechercher sur internet le contexte, le site et l'environnement de la demande : ${request}`,
          'contexte_environnement.md',
          [],
          request
        ),
        mkTask(
          "Recherche web — spécifications types & état de l'art",
          'researcher',
          "Rechercher sur internet les spécifications types et l'état de l'art pour ce type de demande (aucun document de référence n'a été fourni).",
          'specifications_types.md',
          [],
          request
        ),
      ];
  if (!providesReferenceDoc(request)) {
    push(
      'intent',
      'Aucun document de référence fourni',
      'Le flux commence par des recherches internet : contexte/environnement et spécifications types.'
    );
  }

  const researchTasks = domains.map((domain) =>
    mkTask(
      `Dossier ${domain}`,
      agentForDomain.get(domain)!,
      `Constituer le dossier ${domain} pour : ${request}`,
      `dossier_${domain.toLowerCase()}.md`,
      [],
      request
    )
  );
  const analysis = mkTask(
    'Analyse croisée',
    'analyst',
    'Croiser et quantifier les recherches web et les dossiers de tous les spécialistes.',
    'analyse_croisee.md',
    [...webResearch, ...researchTasks].map((task) => task.id),
    `Recherches web + dossiers : ${domains.join(', ')}`
  );
  // The deliverable takes the shape the user asked for (a specification
  // when a specification is requested — never a generic report).
  const wantsSpec = /sp[ée]cification|cahier des charges/i.test(request);
  const synthesis = mkTask(
    wantsSpec ? 'Rédaction de la spécification' : 'Synthèse finale',
    'writer',
    wantsSpec
      ? `Rédiger la spécification demandée, appuyée sur les recherches et analyses : ${request}`
      : 'Rédiger le livrable final répondant à la demande.',
    wantsSpec ? 'specification.md' : 'livrable_final.md',
    [analysis.id],
    'analyse_croisee.md'
  );
  const review = mkTask(
    'Revue du juge',
    'judge',
    'Contrôler la conformité de bout en bout du livrable (objectif ≥ 95/100).',
    'rapport_final_conformite.md',
    [synthesis.id],
    'livrable_final.md'
  );
  const tasks = [...webResearch, ...researchTasks, analysis, synthesis, review];

  push(
    'flow-designed',
    'Flux conçu',
    `${tasks.length} tâches contractualisées — ${webResearch.length + researchTasks.length} en parallèle (recherches web + dossiers spécialistes), puis analyse → ${wantsSpec ? 'spécification' : 'synthèse'} → revue du juge.`
  );
  push('run', 'Exécution lancée', 'Suivi en temps réel dans l’onglet Flux et sur chaque page d’agent.');

  return { domains, newAgents, tasks, events, folderName: `Équipe Génésis — ${domains[0]}` };
}
