# Hand Lab — Entraînement à la lecture de mains

Jeu HTML/CSS/JS vanilla, 4 modes, 20 questions par exercice.

## Lancement

Le jeu charge `combos.json` via `fetch()` → il faut un serveur HTTP, pas un double-clic sur le fichier (`file://` ne marche pas).

- **WAMP** : copier le dossier dans `www/`, ouvrir `http://localhost/poker-hands-trainer/`
- **GitHub Pages** : push le dossier, activer Pages, c'est tout
- **Rapide** : `npx serve` ou `python -m http.server` dans le dossier

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille |
| `style.css` | Thème complet |
| `poker.js` | Évaluateur de mains + générateurs d'exercices + picker pondéré |
| `app.js` | UI / écrans / scoring |
| `combos.json` | Banque : 150 combos de 5 cartes par type (40 pour straight flush — il n'en existe que 40 au total) |
| `tools/generate_bank.js` | Régénère `combos.json` (`node tools/generate_bank.js`) |
| `tools/selftest.js` | Tests de l'évaluateur + distributions (`node tools/selftest.js`) |

## Réglages (haut de poker.js)

- `PICKER_DECAY` (0.35) : à quel point un type tiré perd ses chances
- `PICKER_RECOVER` (0.18) : vitesse de remontée vers le poids normal
- `TIE_RATE_M2` (~0.13) / `TIE_RATE_M4` (0.10) : taux d'égalités forcées
- `N_QUESTIONS` (20) : en haut de `app.js`

## Scoring

- Mode 1 : 1 pt
- Mode 2 : 3 pts (nom A, nom B, gagnant)
- Mode 3 : 2 pts (sélection des 5 cartes, nom)
- Mode 4 : 3 pts (nom J1, nom J2, vainqueur)

Stats par combinaison en fin d'exercice — les lignes ambre = à retravailler.
