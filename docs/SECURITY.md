# SECURITY — Modèle de sécurité & revue

## Surfaces et mesures

| Surface | Risque | Mesure |
| --- | --- | --- |
| Clés API LLM | Exfiltration | Saisies par l'utilisateur, gardées en mémoire/localStorage du poste, envoyées UNIQUEMENT au fournisseur choisi en HTTPS ; champs `type="password"` + `autocomplete="off"` ; jamais commitées (`.gitignore` exclut `.env*`) |
| Rendu Markdown | XSS | `components/ui/Markdown.tsx` construit des éléments React (aucun `innerHTML`), donc échappement natif |
| Aperçu KOMAÏ | Évasion d'iframe | `sandbox=""` : scripts, formulaires et same-origin désactivés ; le code édité ne peut pas toucher l'app hôte |
| Données multi-utilisateurs | Fuite hors périmètre | Règles Firestore (`firebase/firestore.rules`) : lecture des tâches conditionnée à l'appartenance du `taskId` au périmètre du membre ; écriture des tâches réservée à l'Admin SDK ; défaut = tout refuser |
| Hébergement | Clickjacking, sniffing | Headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (firebase.json) |
| Outils d'agent (Python) | Traversée de chemin, injection | `tools.py` : accès fichiers confiné au workspace (`is_relative_to`), calculatrice par AST whitelist (jamais `eval`), stub réseau à brancher explicitement |
| Boucles d'agent | Emballement / déni de ressource | `loop_guardrails.py` : cap d'itérations, stagnation, budget d'observations |
| Verrou projet | Accès local opportuniste | Verrouillage par code (héritée du prototype) — voir « Limites » |

## Limites connues (à traiter avant production réelle)

1. **Le verrou projet côté client (`window.prompt`) est cosmétique** : la
   vraie protection est l'authentification Firebase + les règles Firestore.
   Ne jamais considérer le verrou UI comme une frontière de sécurité.
2. **Appels LLM depuis le navigateur** : pratique en démo, mais pour un
   déploiement d'équipe, proxifier via une Cloud Function afin de ne jamais
   exposer de clé partagée dans le client (le header
   `anthropic-dangerous-direct-browser-access` signale explicitement ce mode).
3. **localStorage** n'est pas chiffré : sur poste partagé, utiliser
   uniquement le backend Firebase authentifié.
4. Les règles Firestore supposent la forme `perimeters` en map par uid —
   validée par le backend à l'écriture ; exécuter l'émulateur
   (`firebase emulators:start`) et ses tests de règles avant tout déploiement.
