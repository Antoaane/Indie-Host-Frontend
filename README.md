<!-- File: README.md -->

# ihf — Setup rapide

Vite + Vue 3 + TS.
Plugins internes :

- `file-path-comment` (entêtes automatiques)
- `svg-to-vue` (SVG → SFC + extraction d’images + SVGO/Prettier).

---

## 1) Prérequis

- [**Node.js ≥ 18** + **npm**](https://nodejs.org/en/download)
- [**Python 3.10+**](https://www.python.org/downloads/release/python-3100/)
- [**Git**](https://git-scm.com/downloads)
- [**Prettier**](https://prettier.io/docs/en/install.html)

---

## 2) Installation

### macOS / Linux

```bash
cp .env.example .env
npm install

python -m pip install --upgrade pip
pip install -r requirement.txt

npm run dev   # http://localhost:5179
```

### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
npm install

python -m pip install --upgrade pip
pip install -r requirement.txt

npm run dev   # http://localhost:5179
```

> Si seul `py` fonctionne sous Windows, remplacez `python` par `py -3`, ou adaptez l’appel dans `plugins/svg-to-vue/vite-plugin-svg-to-vue.ts`.

---

## 3) Variables d’environnement

```env
# .env
VITE_DONATION_LINK=https://votre-lien
```

---

## 4) Scripts utiles

```bash
npm run dev         # Lance Vite (5179) + pipeline SVG (auto)
npm run build       # type-check + build
npm run preview     # sert le build
npm run type-check  # vue-tsc
npm run format      # Prettier sur src/
npm run tag:files   # Entête "File: <path>" normalisé dans /src
npm run svg:convert # Lancement manuel du convertisseur SVG
npm run watch       # SASS input.scss -> output.css
```

---

## 5) Plugins (résumé)

- **file-path-comment** : ajoute/synchronise la première ligne `File: <path>` (styles adaptés), nettoie les lignes vides en trop.
- **svg-to-vue** :
  - Parcourt `public/assets/media/**/*.svg`
  - Extrait les images base64 → `public/assets/media/images/` (dédup par perceptual hash)
  - Scope dynamiquement les `id` + réécrit `url(#id)` / `href="#id"` en bindings Vue
  - Injecte des bindings a11y (`role`, `aria-hidden`, `aria-labelledby`)
  - Génère des SFC dans `src/components/svgs/**`
  - **SVGO** si dispo, **Prettier** ensuite

> Le script cherche `plugins/svg-to-vue/svgo.config.js`. Copiez `plugins/svgo.config.js` à cet emplacement (cf. Installation).

---
