# DESIGN — Système de design Template_LM

Synthèse des deux langages visuels des prototypes :
**glassmorphisme instrumental** (TemplateLM_1) pour les conteneurs et thèmes,
**borderless / zéro-clutter** (KOMAÏ Coding) pour la densité et les flux.

## Esthétique

- **Glassmorphisme** : conteneurs translucides `backdrop-blur-xl`,
  fonds `bg-white/50` (clair) / `bg-slate-950/40` (sombre), bordures
  `border-white/60` / `border-white/10`, ombre `0 8px 32px rgba(0,0,0,0.05)`.
  → Implémenté UNE FOIS dans `components/ui/Glass.tsx` (`Panel`).
- **Zéro-clutter** : pas de sous-titres verbeux sous les titres de sections ;
  micro-labels uppercase (`text-[11px] font-bold tracking-wider`).
- **Flux vertical descendant** : le DAG de tâches (vue Flux) se lit du haut
  vers le bas ; double-vue 1/3 flux + 2/3 détail sur desktop.

## Thèmes (7 préréglages)

| Nom | Hex | Type |
| --- | --- | --- |
| White | `#ffffff` | Clair |
| Cream | `#fef3c7` | Clair |
| Rose | `#fce7f3` | Clair |
| Mint | `#dcfce7` | Clair |
| Blue | `#3b82f6` | Clair |
| Midnight | `#172554` | Sombre |
| Black | `#000000` | Sombre |

Définis une seule fois dans `apps/web/src/core/themes.ts` ; chaque thème
embarque ses classes (texte, verre, bulle utilisateur, bouton d'accent) —
aucun composant ne code une couleur en dur.

## Typographie

- **Inter** : UI générale. Titres `text-xl font-bold tracking-tight` ;
  titres de cartes `text-sm font-bold uppercase tracking-wide` ;
  micro-labels `text-[11px] font-bold uppercase tracking-wider`.
- **JetBrains Mono** : code, logs, métriques, algorithmes Mermaid.

## Icônes

`lucide-react` exclusivement, trait `1.5`–`2`, style minimaliste.

## Blocs de layout

1. **TopBar** — fixe `h-16`, verre, z-50 ; marque, titre du projet actif,
   sélecteur d'utilisateur (démo périmètres), réglages.
2. **Sidebar** — auto-rétractable depuis le bord gauche (`w-5` → `w-72` au
   survol/focus, bouton d'épingle pour le tactile) ; liste des projets.
3. **Vue centrale** — bureau d'agents (grille bento 2→4 colonnes, tuiles
   agent et tuiles dossier de même carré arrondi ; un dossier montre ses
   agents en miniature 2×2 et s'ouvre en surcouche de verre), Flux,
   page Agent, KOMAÏ.
4. **MetaChatDock** — ancré en bas de CHAQUE page : pilule d'onglets de
   navigation **contextuels** + fenêtre de chat unique + surcouche
   d'historique. Sur l'accueil : « Accueil » / « Flux ». Dans un agent : les
   onglets de l'agent (Entrées, Travail en direct, Conformité, Apprentissage,
   Compétences, Logs, Présentation). Le chat parle à l'agent affiché (pas de
   liste déroulante de destinataire). KOMAÏ Coding est une icône d'agent,
   jamais un onglet.

### Pages d'agent (affichage sans cadre)
- Contenu affiché **sans encadré** (pas de cartes arrondies) : une page web
  classique. Les diagrammes (algorithme, méthode de calcul) sont rendus comme
  de **vrais diagrammes SVG** (`components/ui/MermaidFlow.tsx`), pas du texte
  dans une fenêtre noire.
- Ordre des onglets : Entrées (défaut) → Travail en direct (auto au lancement)
  → Conformité (courbe d'évolution du score de fin de run) → Apprentissage
  (fichiers de rejeu et d'exemple à télécharger) → Compétences (synthétisées
  au fil des itérations) → Logs (menu au survol : remarques / juge /
  apprentissages) → Présentation. En l'absence de contenu, une courte
  définition de l'onglet est affichée.
- Le nom de l'agent apparaît dans la barre supérieure quand son titre en page
  disparaît au défilement.

## Mouvement

- Transitions `duration-300/500`, entrées `animate-fade-up` (fondu + 8 px).
- `prefers-reduced-motion` respecté globalement (voir `styles/index.css`).

## Fond décoratif

Dégradés radiaux du thème actif + blob lumineux `blur-[100px]` en
`mix-blend-overlay`, fixes derrière les couches de verre.
