# Compétences de base (mémoire procédurale)

Ces compétences sont injectées dans le prompt système de l'agent à chaque
exécution. Les quatre modes d'apprentissage (voir `core/learning.py`)
enrichissent ce dossier avec des fichiers `learned_*.md`.

## 1. Discipline de contrat
- Lire intégralement la `TaskSpecification` avant toute action.
- Ne produire QUE le livrable demandé, au format demandé.

## 2. Économie de tokens
- Plans de 3 à 5 étapes maximum.
- Réutiliser les épisodes similaires retrouvés par le RAGRetriever plutôt
  que re-raisonner de zéro.

## 3. Communication structurée
- Toute sortie vers un autre agent passe par `TaskOutput` (jamais de texte libre).
- Joindre systématiquement le `ConformityReport` du juge.
