# DESIGN — Système de design Template_LM

Système de design complet de l'**OS d'agents IA dans le navigateur**. Il
fusionne deux langages visuels issus des prototypes : le **glassmorphisme
instrumental** (TemplateLM_1) pour les conteneurs et les thèmes, et le style
**borderless / zéro-clutter** (KOMAÏ Coding) pour la densité et les flux.

Ce document est la **source unique de vérité du design** : aucune couleur,
aucun espacement, aucune règle typographique ne doit être codée ailleurs qu'aux
endroits qu'il désigne.

---

## 1. Deux principes de conception non négociables

Toute l'application obéit à deux principes de codage. Ils se complètent : le
premier gouverne la **structure du code**, le second gouverne la **traduction
de cette structure dans l'UI**.

### 1.1 SSOT — Single Source Of Truth
Une vérité = un seul endroit. Chaque couleur vit dans `core/themes.ts`, chaque
libellé dans `core/i18n.ts`, chaque conteneur de verre dans `ui/Glass.tsx`,
chaque formule physique dans `core/simulators.ts`, chaque type dans
`core/types.ts`. Un composant ne réimplémente jamais une vérité qui existe
déjà : il l'importe. Voir `docs/ARCHITECTURE.md`.

### 1.2 Réduction systématique de la dette de compréhension
> Toute fonctionnalité doit être livrée **accompagnée de sa traduction dans
> l'UI qui minimise la dette de compréhension de l'utilisateur humain**,
> d'après l'état de l'art (SOTA).

L'application sert à **aider l'humain à travailler** : il doit comprendre
**quasi instantanément et intuitivement** ce qui est en train d'être construit.
Une capacité back-end n'est donc jamais considérée « terminée » tant qu'elle
n'a pas sa représentation visuelle la plus lisible possible. Conséquences
concrètes, appliquées partout dans ce document :

- **Rien de tronqué** : les textes des nœuds s'enroulent (retour à la ligne),
  jamais coupés (voir §9.2).
- **Tout ce qui est calculé est montré** : un flux physique affiche sa
  transformation *pas à pas*, pas seulement son résultat (voir §9.3).
- **Tout ce qui est affirmé est sourcé et vérifiable** : chaque donnée de
  recherche internet porte un **lien cliquable vers sa source** (voir §9.4).
- **Métaphores familières** : diagramme en blocs MBSE, graphe de type
  Grasshopper/Blueprints, jauges « bullet » de Stephen Few (voir §10).
- **Codage redondant accessible** : couleur **+** texte **+** icône, jamais la
  couleur seule (voir §7 et §11).

---

## 2. Esthétique

- **Glassmorphisme** : conteneurs translucides `backdrop-blur-xl`, fonds
  `bg-white/50` (clair) / `bg-slate-950/40` (sombre), bordures `border-white/60`
  / `border-white/10`, ombre `0 8px 32px rgba(0,0,0,0.05)`.
  → Implémenté **une seule fois** dans `components/ui/Glass.tsx` (`Panel`,
  `MicroLabel`).
- **Zéro-clutter** : pas de sous-titres verbeux sous les titres ; micro-labels
  uppercase (`text-[11px] font-bold tracking-wider`) ; densité maîtrisée.
- **Flux vertical descendant** : le DAG de tâches (vue Flux) se lit du haut vers
  le bas ; double-vue 1/3 flux + 2/3 détail sur desktop.

---

## 3. Thèmes (7 préréglages)

| Nom | Hex d'accent | Type |
| --- | --- | --- |
| White | `#ffffff` | Clair |
| Cream | `#fef3c7` | Clair |
| Rose | `#fce7f3` | Clair |
| Mint | `#dcfce7` | Clair |
| Blue | `#3b82f6` | Clair |
| Midnight | `#172554` | Sombre |
| Black | `#000000` | Sombre |

Définis **une seule fois** dans `apps/web/src/core/themes.ts`. Chaque thème
embarque ses classes (texte primaire/secondaire/atténué, verre, bulle
utilisateur, fond d'icône, bouton d'accent) et un booléen `isDark` — aucun
composant ne code une couleur en dur, tous lisent `theme.*`.

---

## 4. Typographie

- **Inter** : UI générale.
  - Titres de page `text-xl font-bold tracking-tight`.
  - Titres de cartes `text-sm font-bold uppercase tracking-wide`.
  - Micro-labels `text-[11px] font-bold uppercase tracking-wider`.
  - Corps `text-sm leading-relaxed`.
- **JetBrains Mono** : code, logs, **métriques et grandeurs physiques**
  (`T_ext = -7 °C`), algorithmes Mermaid. Une grandeur physique est toujours en
  mono pour se distinguer de la prose.

---

## 5. Icônes

`lucide-react` **exclusivement**, trait `1.5`–`2`, style minimaliste. Icônes
sémantiques récurrentes : `CloudSun` / `MapPin` (environnants), `UserRound`
(utilisateur), `ThermometerSun` `Gauge` `Layers` `Droplets` (fonctions
physiques), `CheckCircle2` / `XCircle` (conformité), `ExternalLink` (lien
sourcé cliquable).

---

## 6. Couleur sémantique

La couleur **double** toujours une information déjà donnée par le texte/l'icône.

- **Flux fonctionnels** — une couleur stable par flux (thermique, humidité,
  charges, acoustique), définie une fois (`FLOW_COLORS` dans `core/mbse.ts`) et
  rappelée dans la légende **avec son nom écrit**.
- **Conformité** — `emerald-600` = dans la zone / `rose-600` = hors zone,
  **toujours** accompagnée de l'icône `CheckCircle2` / `XCircle` et du libellé
  « Dans / Hors zone de conformité ».
- **Sources** — liens `sky-500`, soulignés pointillés, icône `ExternalLink`.

---

## 7. Blocs de layout

1. **TopBar** — fixe `h-16`, verre, `z-50` : marque, titre du projet actif,
   sélecteur d'utilisateur (démonstration des périmètres), réglages.
2. **Sidebar** — auto-rétractable depuis le bord gauche (`w-5` → `w-72` au
   survol/focus, bouton d'épingle pour le tactile) ; liste des projets.
3. **Vue centrale** — bureau d'agents (grille bento 2→4 colonnes ; tuiles agent
   et tuiles dossier au même carré arrondi ; un dossier montre ses agents en
   miniature 2×2 et s'ouvre en surcouche de verre), Flux, Flux fonctionnel,
   page Agent, KOMAÏ Coding.
4. **MetaChatDock** — ancré en bas de **chaque** page : pilule d'onglets de
   navigation **contextuels** + fenêtre de chat unique + surcouche d'historique.
   - Sur l'accueil : `Accueil` / `Flux` / `Flux fonctionnel` / `Variables`.
   - Dans un agent : les onglets de l'agent (voir §8).
   - La **barre d'onglets est 5 % plus courte de chaque côté** que la fenêtre
     de chat. Les onglets qui débordent restent accessibles de deux façons :
     **défilement horizontal** de la barre, ou bouton **« + »** qui ouvre un
     menu **au-dessus de la barre** listant exactement les onglets non
     affichés (plus l'action « détailler en sous-flux » sur les agents
     éligibles).
   - Le chat parle **à l'agent affiché** — aucun préfixe « Parler à … » n'est
     affiché : la page elle-même est le contexte (le destinataire reste
     annoncé aux lecteurs d'écran via `aria-label`). KOMAÏ Coding est une
     **icône d'agent**, jamais un onglet.

---

## 8. Pages d'agent (affichage sans cadre)

- Contenu affiché **sans encadré** (pas de cartes arrondies) : une page web
  classique, lisible. Les diagrammes (algorithme, méthode de calcul) sont rendus
  comme de **vrais diagrammes SVG** (`components/ui/MermaidFlow.tsx`), jamais du
  texte dans une fenêtre noire.
- Ordre des onglets : **Chat** → **Résultats** → **Flux** (3ᵉ, méta-agents
  détaillés en sous-flux uniquement) → **Entrées** → **Travail en direct**
  (auto au lancement) → **Conformité** (courbe d'évolution du score de fin de
  run) → **Apprentissage** (fichiers de rejeu/exemple téléchargeables) →
  **Compétences** (liste **cliquable** : sélectionner une compétence affiche
  son contenu — origine et apprentissages appliqués) → **Logs** (menu au
  survol : remarques / juge / apprentissages) → **Présentation** (README). En
  l'absence de contenu, une courte définition de l'onglet est affichée.
- Le nom de l'agent apparaît dans la TopBar quand son titre en page disparaît au
  défilement.

### 8.1 Standard d'agent visible
Chaque agent non-humain porte sa **méthode de calcul** (`MethodSection.tsx`) :
graphe algorithmique, chaîne de formules expliquées, **sources SOTA cliquables**
et cas de contrôle chiffrés. La création d'un agent non conforme est refusée
(voir `docs/AGENT_STANDARD.md`) — et cette conformité est **montrée**, pas
seulement vérifiée.

### 8.2 Rendu Markdown & liens sourcés
Le README d'un agent est rendu par `components/ui/Markdown.tsx` (dépendance
zéro, sans `innerHTML` — XSS-safe par construction). Il supporte titres, gras,
code, listes, blocs de code **et liens `[libellé](url)`**. Les liens ne sont
autorisés que pour les schémas `https?://` (aucune URL `javascript:`), s'ouvrent
en nouvel onglet (`rel="noopener noreferrer"`) et sont stylés `sky-500` souligné
pointillé. C'est le socle de la **visibilité des sources**.

---

## 9. Vue « Flux fonctionnel » — le diagramme MBSE

La vue centrale d'un système physique conçu (`components/system/SystemView.tsx`).
Lecture gauche → droite :

```
ENVIRONNANTS ──►  [ MÉTA-COMPOSANT : agents-fonctions ]  ──► UTILISATEUR
(sources sourcées)   (transforment les grandeurs)          (zone de conformité)
```

### 9.1 Environnants comme agents sourcés
Un **environnant** est un élément de l'environnement **externe** au système
(climat, site/voisinage, occupant…). Chacun est **caractérisé par recherche
internet** et **embodié par un agent réel** :

- son **README = le rapport de recherche sourcé** : chaque caractéristique,
  chaque grandeur physique et chaque actualité cite une **source web cliquable**
  (Météo-France, RE2020, Eurocodes, BRGM/InfoTerre, zonage sismique, ASHRAE 55…) ;
- ses grandeurs sont **servies en entrée** aux agents-fonctions du système ;
- les agents environnants sont regroupés dans un dossier **« Environnants »**.

L'environnant **utilisateur** porte en plus la **zone de conformité** : les
plages de critères physiques que les grandeurs transformées doivent atteindre.

### 9.2 Diagramme en blocs — texte enroulé, nœuds cliquables
- Rendu **SVG** : blocs environnants empilés à gauche, bloc méta-composant
  central (contour pointillé) contenant un nœud par agent-fonction, environnant
  utilisateur à droite.
- **Aucun texte tronqué** : chaque libellé de nœud est **enroulé** en plusieurs
  lignes (`<tspan>`) et la **hauteur des nœuds est calculée dynamiquement** pour
  contenir toutes les lignes (principe §1.2).
- **Nœuds cliquables** : un nœud-fonction ouvre la page de son agent ; un bloc
  environnant ouvre la page de son **agent environnant sourcé** (icône
  `ExternalLink`).
- Les chemins de flux (courbes de Bézier colorées) passent **sous** les nœuds,
  de l'environnant source aux fonctions portées jusqu'à l'utilisateur.

### 9.3 Transformation pas à pas → zone de conformité
Sous le diagramme, chaque flux est déplié **étape par étape** : la valeur
source recherchée est transformée par chaque agent-fonction (formules réelles de
`core/simulators.ts` : Fourier `q = λ·ΔT/e`, `R = e/λ`, `α = λ/ρc`, `σ = F/A`,
loi de masse acoustique, tampon hygrique MBV) jusqu'à la **valeur livrée**. Un
badge indique si elle **atterrit dans la zone de conformité** de l'utilisateur
(`Requis min–max unité`), en couleur **+** icône **+** texte.

### 9.4 Cartes environnants — sources visibles
En bas, une carte par environnant (+ utilisateur) : caractéristiques, grandeurs
physiques (puces mono), zone de conformité, actualités. **Chaque fait sourcé
affiche son lien cliquable** (`ExternalLink`). L'en-tête de la carte ouvre
l'agent environnant. La sourcing est donc visible **à trois endroits** : la
carte, le nœud du diagramme (via l'agent), et le README de l'agent.

---

## 10. Espace de variables & tenseurs nommés (vision bout-en-bout)

Objectif : préparer les **itérations d'optimiseurs** qui chercheront le meilleur
**compromis de performances**, tout en gardant l'humain capable de **tout
comprendre d'un coup d'œil**. Le choix retenu est le **tenseur nommé** (espace
de variables + graphe de fonctions, à la OpenMDAO) plutôt que des tenseurs
bruts : les dimensions portent des **noms lisibles**.

### 10.1 Taxonomie des variables (5 rôles — la chaîne va jusqu'à l'humain)
Chaque variable de chaque agent du flux, et le flux lui-même, se range en un des
cinq rôles. Le tenseur est **de bout en bout** : il ne s'arrête pas aux
performances déduites, il aboutit aux **critères de confort de l'utilisateur
humain** :

| Rôle | Nature | Exemples | Qui la fixe |
| --- | --- | --- | --- |
| **environnant** | subie, profil temporel (saison × jour/nuit) | `T_ext`, `HR_ext`, `S_k`, `L_ext` | l'environnement (recherche sourcée) |
| **compromis** | **libre, résolue par l'optimiseur** | épaisseur `e`, conductivité `λ`, masse surfacique `m″` | l'optimiseur (recherche du bon compromis) |
| **état** | intermédiaire, calculée | `R`, `α`, `σ`, `T_si` (surface du mur) | les formules physiques |
| **performance** | **délivrée par le système — exigence DÉDUITE du confort humain, pas le critère lui-même** | flux de paroi `q`, tampon `m`, `SF`, `L_int` | déduction depuis les critères humains |
| **confort** | **LE CRITÈRE HUMAIN, jugé dans SA zone** — ce que l'occupant ressent | `T_op` (température opérative, ASHRAE 55), `HR_int`, calme perçu `L_p`, sécurité `SF_h` | l'humain (caractérisé par l'environnant utilisateur) |

> Note de vocabulaire (correction actée) : l'épaisseur du mur `e` et le `λ` du
> matériau **ne sont pas choisis par le concepteur**. Ce sont des variables de
> **compromis** que l'optimiseur ajuste pour atteindre, **en toute saison et de
> jour comme de nuit**, les plages de confort de l'utilisateur — arbitrage entre
> température, humidité, contraintes mécaniques, etc.

### 10.2 Trois vues bout-en-bout (SOTA de la lisibilité) — onglet « Variables »
L'onglet principal **« Variables »** (`components/system/VariablesView.tsx`,
données : `core/variables.ts`) rend l'espace de variables en trois vues, toutes
pilotées par le **sélecteur de scénario** (rangée de filtres au-dessus) :

1. **A — Graphe de nœuds porté** (métaphore Grasshopper / Unreal Blueprints) :
   les variables en nœuds, **cinq colonnes de rôle** (environnant → compromis →
   état → performance → **confort humain**), fils = dépendances de calcul.
   Cliquer une variable **surligne sa chaîne amont** (« d'où vient cette
   valeur ? »). Textes enroulés, valeur du scénario sélectionné dans chaque
   nœud, liseré de couleur de rôle.
2. **Calcul pas à pas — aucune boîte noire** : sous la vue A, la chaîne
   complète de la variable sélectionnée (par défaut `T_op`, le premier critère
   humain), en ordre topologique : pour chaque étape, la **formule symbolique**
   puis la **substitution numérique** du scénario (ex. `T_si = 19 + (−7 − 19) ×
   0.13 / 0.77 = 14.6 °C`) et le verdict de conformité. L'utilisateur de
   l'application peut ré-expliquer lui-même comment on arrive au résultat.
3. **B — Jauges « bullet » de conformité** (Stephen Few) + sparklines : les
   **critères humains d'abord**, puis les exigences déduites (performances),
   chacun contre sa **bande de zone de conformité**, un point par scénario
   (vert/rouge + icône + texte du verdict, scénarios hors zone nommés).
4. **C — Matrice variables × scénarios** (heatmap) : le tenseur nommé rendu tel
   quel — lignes = variables groupées par rôle, colonnes = scénarios ; couleur
   **séquentielle une teinte normalisée par ligne** (les lignes de compromis se
   lisent PLATES : constantes par construction), **valeurs visibles dans chaque
   cellule** (la matrice est aussi la vue-table), verdict ✓/✗ par cellule
   jugée, colonne du scénario sélectionné soulignée.
5. **D — Conclusions pour l'optimiseur** : pour chaque critère hors zone, les
   scénarios concernés avec leurs valeurs, les **leviers de compromis** de sa
   chaîne (calculés depuis le graphe de dépendances, ex. `[e, λ]`) et le sens
   de l'action ; plus la note de conflit entre leviers (isoler ↔ masse ↔
   structure) — la base de l'arbitrage que l'optimiseur devra rendre.

Les couleurs de rôle sont une palette catégorielle **validée** (bande de
lightness, plancher de chroma, séparation daltonisme ΔE ≥ 8, plancher vision
normale ΔE ≥ 15, contraste ≥ 3:1 — modes clair et sombre) définie une seule
fois dans `core/variables.ts` (`ROLE_COLORS`), toujours doublée du nom écrit du
rôle. §9 (flux, pas à pas, conformité) et cet onglet forment la traduction UI
exigée par le principe §1.2 pour la capacité d'optimisation à venir.

---

## 11. Accessibilité (rappel design)

- **Codage redondant** : couleur **+** texte **+** icône partout (flux,
  conformité). Jamais la couleur seule.
- `role="img"` + `aria-label` sur les diagrammes SVG ; `role="button"` +
  `aria-label` sur les nœuds cliquables.
- `role="tab"` / `role="tabpanel"` pour les onglets du dock et des agents.
- Contrastes conformes en thèmes clairs **et** sombres (chaque thème fournit ses
  classes de texte). Voir `docs/ACCESSIBILITY.md`.

---

## 12. Mouvement

- Transitions `duration-300/500`, entrées `animate-fade-up` (fondu + 8 px).
- `prefers-reduced-motion` respecté globalement (voir `styles/index.css`).

---

## 13. Fond décoratif

Dégradés radiaux du thème actif + blob lumineux `blur-[100px]` en
`mix-blend-overlay`, fixes derrière les couches de verre.

---

## 14. Où vit chaque vérité de design (SSOT)

| Vérité | Fichier unique |
| --- | --- |
| Couleurs, thèmes, `isDark` | `apps/web/src/core/themes.ts` |
| Libellés (FR/EN/ES) | `apps/web/src/core/i18n.ts` |
| Conteneurs de verre, micro-labels | `apps/web/src/components/ui/Glass.tsx` |
| Rendu Markdown + liens sourcés | `apps/web/src/components/ui/Markdown.tsx` |
| Rendu des diagrammes Mermaid → SVG | `apps/web/src/components/ui/MermaidFlow.tsx` |
| Couleurs & icônes de flux, environnants sourcés | `apps/web/src/core/mbse.ts` |
| Tenseur nommé : rôles, scénarios, couleurs de rôle, `fmtValue` | `apps/web/src/core/variables.ts` |
| Vues A/B/C de l'espace de variables | `apps/web/src/components/system/VariablesView.tsx` |
| Formules physiques | `apps/web/src/core/simulators.ts` |
| Types partagés (dont `SourcedFact`, `SotaSource`) | `apps/web/src/core/types.ts` |
| Diagramme MBSE (Flux fonctionnel) | `apps/web/src/components/system/SystemView.tsx` |
| DAG de tâches (Flux) | `apps/web/src/components/flux/PertGraph.tsx` |
