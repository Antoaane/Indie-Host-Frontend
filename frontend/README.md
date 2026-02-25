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
VITE_API_BASE_URL=https://api-staging.indiehost.fr/v1
VITE_API_PROXY_TARGET=https://api-staging.indiehost.fr
VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXX
VITE_STRIPE_API_BASE_URL=https://api-staging.indiehost.fr/v1
VITE_STRIPE_PAYMENT_INTENT_PATH=/payments/stripe/payment-intents
VITE_STRIPE_PAYMENT_RETURN_URL=http://localhost:5179
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXX
STRIPE_CONNECT_CLIENT_ID=ca_XXXXXXXXXXXXXXXX
STRIPE_PLATFORM_ACCOUNT_ID=acct_XXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX
```

Notes:

- En dev, l’app proxifie automatiquement les appels API via Vite (pas de CORS) si `VITE_API_BASE_URL` est une URL absolue (ex: `https://…/v1`).
- Du coup dans l’onglet Network, tu verras souvent `http://localhost:5179/v1/...` : c’est normal, c’est le proxy Vite qui forward vers ton backend distant.
- Si vous mettez `VITE_API_BASE_URL=/v1`, renseignez aussi `VITE_API_PROXY_TARGET` (ex: `https://api-staging.indiehost.fr`) pour que le proxy Vite sache où forward.

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
