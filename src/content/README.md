<!-- File: src/content/README.md -->

# Guide d’intégration JSON (Dev & Rédac)

## Pourquoi passer par du JSON ?

- **Séparation code / contenu** : Les rédacteurs éditent le JSON, les devs ne touchent pas aux `.vue`.
- **Multi-langue & variations** : Un dossier `/fr/`, `/en/` avec des fichiers identiques dans chaque langue.
- **SEO-friendly** : Le contenu est injecté lors du build (SSR/SSG), pas de `fetch` au runtime.
- **Accessibilité & SEO** : On centralise attributs ARIA, microdata, classes… dans les métadatas.

## Contraintes & usages

1. **Bloc par bloc** : Chaque section est un tableau de blocs (titre, paragraphe, image, input, composant…).
2. **Metadata spécifique** :
   - `h2`,`p` → id, class, itemProp…
   - `ul`,`ol` → items, aria-label…
   - `img` → src, alt, loading…
   - `input` → type, placeholder, ariaLabel…
   - `component`→ variant (nom du composant), data (tableau typé)
3. **Rendu unique** : Boucle `<template v-for>`, un seul `<component :is>` gère tout.

## Documentation

### Bloc texte (h2)

```json
"titel-1": {
  "tag": "h2",
  "content": "Titre de section",
  "meta": {
    "id": "sec-title",
    "itemProp": "headline"
  }
}
```

### Bloc paragraphe

```json
"text-1": {
  "tag": "p",
  "content": "Premier paragraphe."
}
```

### Bloc liste

```json
"list-1": {
  "tag": "ul",
  "content": "",
  "meta": {
    "items": [
      "Point 1",
      "Point 2"
    ],
    "ariaLabel": "Liste d\"avantages"
  }
}
```

### Bloc image

```json
"image-1": {
  "tag": "img",
  "content": "/img/photo.jpg",
  "meta": {
    "alt": "Photo produit",
    "loading": "lazy"
  }
}
```

### Bloc input

```json
"input-1": {
  "tag": "input",
  "content": "",
  "meta": {
    "type": "search",
    "placeholder": "Rechercher...",
    "ariaLabel": "Recherche FAQ"
  }
}
```

### Bloc composant

```json
"faq": {
  "tag": "component",
  "content": "",
  "meta": {
    "variant": "FaqPage",
    "data": [
      /* props | data */
    ]
  }
}
```

### Importation dans un fichier Vue

```js
<script setup lang="ts">
import type { BlockSection } from '@/content/types'
import sectionData from '@/content/fr/HabitsSection.json'

const content = sectionData as BlockSection
</script>

<template>
  <section :id="content.section">
    <div v-for="(blk, i) in content.blocks" :key="i">
      <component :is="blk.tag" v-bind="blk.metadata">
        <template v-if="blk.tag === 'ul'">
          <li v-for="(it, idx) in blk.metadata.items" :key="idx">
            {{ it }}
          </li>
        </template>
      </component>
    </div>
  </section>
</template>
```

> L' équipe peut rédiger **tout type** de contenu (texte, images, formulaires, composants) dans un fichier JSON, et les devs intègrent via un seul pattern de rendu.
