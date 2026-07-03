# ACCESSIBILITY — Conformité et points d'attention

## Mesures implémentées (WCAG 2.2 AA visé)

- **Lien d'évitement** « Aller au contenu » (`.skip-link`), premier élément
  focusable de chaque page.
- **Focus visible** global (`:focus-visible`, anneau 2 px) pour la
  navigation clavier.
- **`prefers-reduced-motion`** : toutes les animations/transitions sont
  neutralisées pour les utilisateurs qui le demandent.
- **Rôles ARIA** : `role="tablist/tab/tabpanel"` (onglets de navigation et
  onglets d'agent, avec `aria-selected`/`aria-controls`), `role="dialog"`
  + `aria-modal` (modales, fermeture Échap, focus déplacé), `role="log"` +
  `aria-live="polite"` (flux de chat et travail en direct).
- **Libellés** : tous les boutons-icônes ont un `aria-label` ; tous les
  champs ont un `<label>` (visible ou `sr-only`) ; iframes titrées.
- **Cibles tactiles** ≥ 44 px sur les actions principales (envoi, onglets,
  boutons de modale).
- **Contrastes** : textes atténués remontés à `slate-600` sur thèmes clairs ;
  micro-labels portés à 11 px ; pilules de statut en couleurs foncées sur
  fonds translucides clairs.
- **Sémantique** : `header/main/nav/aside/section` + hiérarchie h1→h3 ;
  langue du document déclarée.
- **Alternatives non visuelles** : les états (statuts, verdicts) sont
  toujours doublés d'un texte, jamais portés par la seule couleur.

## ⚠️ Points de vigilance restants (à connaître)

1. **Contraste sur verre** : le glassmorphisme superpose du texte à des
   fonds translucides dont la luminance dépend du dégradé situé derrière.
   Sur les thèmes *Blue* et *Cream*, certains micro-labels peuvent
   descendre sous 4,5:1 selon la zone traversée. Recommandation : vérifier
   au contrast-checker après tout changement de thème/dégradé, ou opacifier
   `glassBg` si un audit formel AA est requis.
2. **Sidebar au survol** : l'expansion par survol/focus est doublée d'un
   bouton d'épingle pour tactile et clavier, mais l'ordre de focus fait
   passer par le bouton avant le contenu ; à retester avec lecteur d'écran.
3. **`window.prompt` (déverrouillage projet)** : accessible nativement mais
   non stylable et non localisé par certains lecteurs d'écran ; à remplacer
   par une modale dédiée lors du branchement de l'auth réelle.
4. **Éditeur KOMAÏ** : un `<textarea>` brut reste le choix le plus
   accessible, mais sans coloration syntaxique ; si un éditeur riche est
   introduit plus tard (CodeMirror…), vérifier son mode accessibilité.
5. **Zoom 400 %** : la double-vue Flux (1/3 + 2/3) repasse en une colonne
   sous `md:` — comportement conforme, mais à revalider après toute
   modification de grille.
