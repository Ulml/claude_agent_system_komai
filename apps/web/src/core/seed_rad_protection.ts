/**
 * SINGLE SOURCE OF TRUTH — le sous-dossier « Protections Anti-Radiations »
 * (Technologies Spatiales → Protections Anti-Radiations).
 *
 * Quatre agents SIMULATEURS de protection contre les radiations spatiales,
 * distinguant la protection générale (vaisseau/habitat) et la protection
 * spécifique aux réacteurs nucléaires embarqués (NTP, NEP…). Tous sont des
 * instances de l'agent STANDARD ; ils réutilisent les gabarits README et
 * Mermaid des simulateurs (importés de seed_space_tech.ts — SSOT).
 */
import { HeartPulse, Magnet, Shield, ShieldAlert } from 'lucide-react';
import type { AgentFolder, AgentProfile } from './types';
import { mkSimReadme, mkSimulatorMermaid } from './seed_space_tech';
import { spaceTechFolder } from './seed_space_tech';

export const radProtectionAgents: AgentProfile[] = [
  {
    id: 'sim-shield-passive',
    name: 'Blindage Passif',
    kind: 'worker',
    icon: Shield,
    tagline: 'Simulateur de protection par matériaux',
    readme: mkSimReadme(
      'Protection passive (matériaux) — la plus mature',
      `## Fonctionnement
Atténuation des radiations (protons, GCR, neutrons secondaires) par
interposition de matériaux, en privilégiant les composés riches en
hydrogène.

## Matériaux riches en hydrogène (meilleurs contre protons et fragments)
- **Polyéthylène (PE)** : très efficace, léger — combinaisons et parois.
- **Eau** (stockée pour consommation) ou **hydrogène liquide** : excellent
  modérateur de neutrons.
- **Polymères avancés** (ex. nanotubes de nitrure de bore, BNNT) :
  réduisent la production de neutrons secondaires par rapport à l'aluminium.

## Multicouches et composites
- Alternance de matériaux légers (hydrogène) et denses : optimise contre
  primaires et secondaires.
- **Régolithe lunaire/martien (ISRU)** : empilé en sacs ou briques
  (50 cm+ avec couche PE interne) pour habitats de surface — réduction de
  dose significative combiné à l'hydrogène.
- **Z-Grade / stratification métallique** : couches de métaux alternés pour
  CubeSats et électronique (NASA Langley) — étend la durée de vie des
  composants.
- **Vestes corporelles** : AstroRad (StemRad), gilet composite testé sur
  Orion — protège les organes vitaux pendant les SPE.

## Limites
Le blindage passif seul est **lourd** et produit des secondaires pour les
GCR haute énergie. Idéal **en combinaison** avec les protections actives.

## État
Technologie **la plus mature** ; référence de toute architecture de mission.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('transport de particules dans les multicouches (PE/eau/régolithe)'),
    skills: ['Interactions particule-matière', 'Optimisation multicouches', 'ISRU régolithe'],
    llmBinding: { providerId: 'google', model: 'gemini-3-pro-preview' },
    status: 'idle',
  },
  {
    id: 'sim-shield-active',
    name: 'Blindage Actif',
    kind: 'worker',
    icon: Magnet,
    tagline: 'Simulateur de déflexion par champs',
    readme: mkSimReadme(
      'Protection active (champs) — émergente et prometteuse',
      `## Fonctionnement
Déflexion des particules chargées par des champs électriques ou
magnétiques, au lieu de les absorber par de la masse.

## Blindage électrostatique
Champs électriques portés par des membranes gonflables chargées qui
défléchissent les particules chargées. Concepts NASA NIAC : **>70% plus
efficace** que les meilleurs matériaux hydrogénés pour les GCR dans
certaines configurations.

## Blindage magnétique
Champs magnétiques supraconducteurs ou permanents déviant les ions chargés
(inspiré de la magnétosphère terrestre). Défis : énergie, masse, effet d'un
champ fort sur l'équipage et l'électronique.

## Hybrides
Combinaison passive + active pour optimiser masse et efficacité.

## État
**Émergent** : concepts avancés (NIAC), pas encore déployé en mission.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('trajectoires de particules chargées dans les champs E/B'),
    skills: ['Électromagnétisme appliqué', 'Supraconducteurs', 'Dimensionnement hybride'],
    llmBinding: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    status: 'idle',
  },
  {
    id: 'sim-bio-ops',
    name: 'Protections Bio & Ops',
    kind: 'worker',
    icon: HeartPulse,
    tagline: 'Simulateur d’approches biologiques et opérationnelles',
    readme: mkSimReadme(
      'Approches biologiques et opérationnelles',
      `## Fonctionnement
Réduction du RISQUE biologique plutôt que du flux de particules : agir sur
l'organisme, la surveillance et le profil de mission.

## Approches
- **Pharmacologiques** : antioxydants, radioprotecteurs (en développement).
- **Cellules souches modifiées** : ingénierie pour résistance à la
  radiation (recherche ASU).
- **Hibernation synthétique** : réduit le métabolisme et potentiellement
  les dommages.
- **Surveillance et modélisation** : détecteurs Timepix avancés, limites
  d'exposition mises à jour (NASA : *effective dose-based*).
- **Réduction du temps d'exposition** : propulsion plus rapide
  (ex. nucléaire) pour diminuer la dose cumulée.

## État
Mixte : surveillance **opérationnelle** (ISS) ; pharmacologie et biologie
**en recherche** ; incertitudes biologiques (risques cancer, SNC).`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('dose cumulée ↔ profil mission ↔ contre-mesures biologiques'),
    skills: ['Radiobiologie', 'Dosimétrie Timepix', 'Profils de mission'],
    llmBinding: { providerId: 'openai', model: 'gpt-5.2' },
    status: 'idle',
  },
  {
    id: 'sim-reactor-shield',
    name: 'Blindage Réacteur',
    kind: 'worker',
    icon: ShieldAlert,
    tagline: 'Simulateur de protection réacteur embarqué',
    readme: mkSimReadme(
      'Protection spécifique — réacteur nucléaire embarqué (NTP/NEP)',
      `## Fonctionnement
Un réacteur à fission (propulsion thermique/électrique ou puissance) émet
**neutrons et gamma** en fonctionnement. La protection doit être LOCALE
(autour du réacteur) tout en minimisant la masse globale du vaisseau.

## Blindage local dédié
- **Riches en hydrogène** (eau, polyéthylène, hydrures) : excellents contre
  les neutrons (modération + absorption).
- **Matériaux denses** : tungstène, plomb, bore (ex. carbure de bore) pour
  gamma et neutrons.
- **Multicouches** : hydrure de lithium (LiH) ou composites avancés pour
  neutrons thermiques.

## Conception du réacteur
- Réacteurs lancés **« froids »** (non activés avant orbite haute sécurisée).
- **Shadow shield** : ombre conique, réacteur éloigné de l'habitat.
- Matériaux haute température (ex. combustibles **HALEU** testés pour NTP).

## Distance et géométrie
Réacteur placé à l'opposé de l'habitat + structure intermédiaire servant de
bouclier.

## Actif + passif
Champs magnétiques/électrostatiques locaux autour du réacteur.

## Gestion des accidents
Orbites à longue durée de vie pour décroissance radioactive ; systèmes de
sécurité (arrêt automatique).

## Avantages des systèmes nucléaires
Réduisent le temps de transit (Mars plus rapide → moins d'exposition GCR).

## Défis généraux
- Masse vs efficacité (compromis critique pour missions longues).
- Neutrons secondaires produits par interactions.
- Incertitudes biologiques (cancer, SNC).
- Réglementations et tests (ISS, Artemis, simulations).`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('atténuation neutrons/gamma : shadow shield + multicouches LiH/W/B4C'),
    skills: ['Neutronique de blindage', 'Shadow shielding', 'Sûreté nucléaire spatiale'],
    llmBinding: { providerId: 'local-lmlite', model: 'qwen3-coder' },
    status: 'idle',
  },
];

/** Sous-dossier « Protections Anti-Radiations » de Technologies Spatiales. */
export const radProtectionFolder: AgentFolder = {
  id: 'folder-rad-protection',
  name: 'Protections Anti-Radiations',
  agentIds: radProtectionAgents.map((a) => a.id),
  parentId: spaceTechFolder.id,
};
