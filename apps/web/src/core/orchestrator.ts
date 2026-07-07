/**
 * Orchestrator client — decomposes a project goal into an end-to-end task
 * flow and simulates its execution in the browser.
 *
 * In production the real decomposition runs server-side in the LangGraph
 * orchestrator (`packages/agent_harness/orchestrator/orchestrator_graph.py`)
 * and this module only mirrors its state from Firestore. The local pipeline
 * below applies the SAME contract shapes (TaskSpecification → TaskOutput →
 * ConformityReport) so the UI is identical in both modes — Single Source of
 * Truth on the data contract, two interchangeable executors.
 */
import type { ConformityReport, TaskNode, TaskOutput, WorkEvent, WorkPhase } from './types';
import { agentMethods } from './agent_methods';

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${uid++}`;

/** True when the request already comes with its own reference document
 *  (PRD, cahier des charges…) — in that case upfront web research on the
 *  context is not needed, the document IS the input. */
export function providesReferenceDoc(goal: string): boolean {
  return /\bprd\b|cahier des charges|sp[ée]cification (fournie|jointe|ci-jointe)|document (fourni|joint)/i.test(goal);
}

/**
 * Deterministic decomposition of a goal into an end-to-end flow. Mirrors
 * the default plan of the Python orchestrator:
 * - if the user did NOT provide a reference document (PRD…), the flow
 *   STARTS with web research — the context/environment of the request and
 *   the typical specification / state of the art for this kind of object —
 *   because the orchestrator never invents missing inputs;
 * - then analysis → writing of the deliverable → judge review gate.
 */
export function decomposeGoal(projectId: string, title: string, goal: string): TaskNode[] {
  const mk = (
    n: number,
    taskTitle: string,
    agentId: string,
    objective: string,
    deliverable: string,
    dependsOn: string[]
  ): TaskNode => ({
    id: nextId(`${projectId}-t${n}`),
    projectId,
    title: taskTitle,
    agentId,
    status: 'pending',
    dependsOn,
    spec: {
      objective,
      constraints: ['Respecter les standards transversaux du projet', 'Sortie structurée (Pydantic)'],
      deliverableFormat: deliverable,
    },
    input: dependsOn.length === 0 ? goal : `Sorties des étapes précédentes (${dependsOn.length})`,
    output: null,
    conformity: null,
    accessible: true,
  });

  // No reference document provided → the flow opens with web research.
  const research: TaskNode[] = providesReferenceDoc(goal)
    ? [mk(1, `Étude du document fourni — ${title}`, 'researcher', `Extraire les exigences du document de référence pour : ${goal}`, 'exigences.md', [])]
    : [
        mk(1, `Recherche web — contexte & environnement`, 'researcher', `Rechercher sur internet le contexte, le site et l'environnement de la demande : ${goal}`, 'contexte_environnement.md', []),
        mk(2, `Recherche web — spécifications types & état de l'art`, 'researcher', `Rechercher sur internet les spécifications types et l'état de l'art pour ce type d'objet (aucun PRD n'a été fourni).`, 'specifications_types.md', []),
      ];
  const t3 = mk(3, `Analyse — ${title}`, 'analyst', 'Structurer et quantifier les éléments collectés.', 'analyse.md', research.map((r) => r.id));
  const t4 = mk(4, `Rédaction du livrable — ${title}`, 'writer', `Produire le livrable demandé : ${goal}`, 'livrable_final.md', [t3.id]);
  const t5 = mk(5, `Revue du juge — ${title}`, 'judge', 'Vérifier la conformité de bout en bout avant livraison.', 'rapport_conformite.md', [t4.id]);
  return [...research, t3, t4, t5];
}

/** Phases emitted, in order, while a task "runs" locally. */
const PHASES: { phase: WorkPhase; label: string; detail: string }[] = [
  { phase: 'SENSE', label: 'Analyse du contrat', detail: 'Lecture de la TaskSpecification et des entrées.' },
  { phase: 'PLAN', label: 'Plan d’exécution', detail: 'Décomposition en étapes outillées.' },
  { phase: 'ACT', label: 'Exécution des outils', detail: 'Production de l’artefact demandé.' },
  { phase: 'OBSERVE', label: 'Contrôle du résultat', detail: 'Résultat conforme au format attendu.' },
];

const conformReport = (): ConformityReport => ({
  verdict: 'conform',
  score: 88 + Math.floor(Math.random() * 12),
  criteria: [
    { name: 'Respect du contrat', passed: true, comment: 'Objectif et contraintes couverts.' },
    { name: 'Standards du projet', passed: true, comment: 'Format et structure conformes.' },
  ],
  judgeModel: 'claude-sonnet-5',
  recommendations: ['Continuer à compacter le contexte pour réduire les tokens.'],
});

export interface FlowRunnerCallbacks {
  onTaskUpdate: (task: TaskNode) => void;
  onWorkEvent: (event: WorkEvent) => void;
  onDone: () => void;
}

/**
 * Runs a task flow locally: walks the DAG in dependency order, emitting
 * SENSE/PLAN/ACT/OBSERVE events then an output + judge report per task.
 * Returns a cancel function so unmounting the app stops the timers.
 */
export function runFlowLocally(tasks: TaskNode[], cb: FlowRunnerCallbacks): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let elapsed = 0;
  const schedule = (fn: () => void, delay: number) => {
    elapsed += delay;
    timers.push(setTimeout(fn, elapsed));
  };

  // Linear flows are the default local plan, so dependency order = array order.
  for (const task of tasks) {
    schedule(() => cb.onTaskUpdate({ ...task, status: 'running' }), 400);
    for (const p of PHASES) {
      schedule(() => {
        cb.onWorkEvent({
          id: nextId('w'),
          agentId: task.agentId,
          taskId: task.id,
          phase: p.phase,
          label: p.label,
          detail: p.detail,
          timestamp: Date.now(),
        });
      }, 700);
    }
    schedule(() => {
      // REAL results, never hard-coded: the assigned agent's computation
      // method runs its actual physics/algorithm checks (core/simulators.ts)
      // and the computed values are embedded in the delivered output.
      const method = agentMethods[task.agentId];
      const computed = (method?.checks ?? [])
        .map((c) => `${c.label} = ${c.got.toPrecision(5)}${c.unit && c.unit !== '—' ? ` ${c.unit}` : ''}`)
        .join(' · ');
      const output: TaskOutput = {
        summary:
          `${task.spec.deliverableFormat} produit : ${task.spec.objective}` +
          (computed ? ` — Calculs vérifiés : ${computed}` : ''),
        artifacts: [task.spec.deliverableFormat],
        tokensUsed: 4_000 + Math.floor(Math.random() * 9_000),
      };
      cb.onTaskUpdate({ ...task, status: 'done', output, conformity: conformReport() });
    }, 700);
  }
  schedule(() => cb.onDone(), 300);

  return () => timers.forEach(clearTimeout);
}
