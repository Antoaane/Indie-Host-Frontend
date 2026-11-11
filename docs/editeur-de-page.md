# Éditeur de page à la volée et thèmes

Document de conception de la fonctionnalité « modifier ma page de présentation directement dessus ». Il sert de référence pour l'implémentation et de journal : toute idée, décision ou modification sur ce sujet s'ajoute ici (section 11).

- **État au 2026-11-11** : les trois thèmes sont en ligne sur la page principale publique, et **le mode édition est écrit** : depuis le tableau de bord (`/dashboard/page/:listingId`), l'hôte modifie sa page dessus (textes, photos, thème, sections), chaque modification est enregistrée et en ligne aussitôt. Vérifié en local de bout en bout, pas encore en production. Restent l'étape 4 (finitions) et l'extension aux annonces simples.
- **Voir les maquettes** : `cd frontend && npm run dev`, puis ouvrir
  - `http://127.0.0.1:5179/dev/page-themes?theme=maison`
  - `http://127.0.0.1:5179/dev/page-themes?theme=rivage`
  - `http://127.0.0.1:5179/dev/page-themes?theme=nocturne`
  - ajouter `&edit=1` pour arriver directement en mode édition ;
  - remplacer `theme=…` par `lieu=mer` ou `lieu=terre` pour voir le thème appliqué d'office selon le lieu (sans rien : annonce sans adresse) ;
  - ajouter `&erreur=1` pour voir un enregistrement qui échoue (message et « Réessayer »).
  Cette route fait tourner le vrai mode édition (`edit/useHubPageEditing.ts`) ; seuls l'enregistrement et l'envoi des photos y sont simulés.

---

## 1. Le besoin

Un hôte qui regarde sa page de présentation (la « page principale », qui peut regrouper plusieurs annonces) doit pouvoir la modifier sans passer par un formulaire : il voit une icône de crayon, il clique, et il change le style, les textes et les éléments de sa page là où ils sont.

**La règle : la simplicité.** Sans réfléchir, l'hôte doit comprendre que sa page se modifie à la volée. Chaque choix de ce document se juge à cette règle.

**Trois thèmes au maximum.** Chacun est un gabarit complet (couleurs, polices, formes, mise en page de l'en-tête), beau tel quel, sans réglage. L'hôte choisit un thème, il ne compose pas une palette.

## 2. Ce qui existe aujourd'hui

- La page principale est une annonce de type `hub` (`Listing.kind = 'hub'`), rendue par `frontend/src/views/ListingHub/_ListingHub.vue` : un bandeau (photo, titre, description, « Proposé par … ») et la grille des logements rattachés.
- Son contenu se modifie dans l'éditeur du tableau de bord (titre, photos, description, domaine, logements présentés), comme une annonce.
- Elle n'a qu'une apparence : celle d'IndieHost (Fustat, Outfit, encre `#111117`).
- Sur un domaine personnalisé, il n'y a pas de session Clerk : la page publique ne peut pas savoir que son visiteur est le propriétaire.

## 3. Ce que font les éditeurs existants

Lecture des aides officielles le 2026-11-10. Quand une information vient d'une recherche et pas de la page elle-même, c'est indiqué.

| Produit | Comment on entre | Comment on modifie | Enregistrement | Ce qu'on en retient |
|---|---|---|---|---|
| **Framer**, « On-Page Editing » | Un bouton « Edit » sur le côté droit du site publié, visible du propriétaire seulement | Les éléments modifiables sont surlignés ; on survole, on clique, on modifie | Rien n'est en ligne avant publication ; « Finish Editing » prévient les personnes qui publient | Le modèle le plus proche du besoin : on édite le vrai site, pas une copie dans un outil |
| **Webflow**, mode Édition (page non lue directement, erreur 403 ; d'après les extraits de l'aide officielle) | Un bouton « Edit site » en bas à droite de la page | Au survol, contour autour du texte et icône de crayon ; l'icône change selon le type (crayon pour un texte, image pour une photo) | Enregistrement automatique en brouillon, puis publication | Le crayon comme signal universel de « ceci se modifie », et l'entrée en bas à droite |
| **Squarespace** | Bouton « Edit » en haut à gauche de la page | Blocs sur une grille ; un pinceau ouvre « Site styles » : thèmes, polices, couleurs | Flèche d'annulation tant que rien n'est enregistré, bouton « Save » ; impossible d'annuler après | Les polices se choisissent par paires toutes faites et les couleurs par palette, jamais une à une. Mais la séparation contenu / style en deux panneaux est déjà trop pour notre règle |
| **Wix** (éditeur classique) | On clique un élément, puis « Edit Text » | Un panneau s'ouvre avec les options de mise en forme | Non décrit dans la page lue | Contre-exemple : chaque texte a sa police, sa taille, sa couleur. Puissant, mais l'hôte peut casser sa page |
| **Carrd / Linktree** (comparatifs tiers, non officiels) | – | Linktree : une pile de boutons ; Carrd : mise en page libre | – | Un comparatif chiffre la mise en route à 3 minutes pour Linktree contre 15 à 60 pour Carrd, parce que Carrd fait choisir gabarit, couleurs et polices. Moins de choix, c'est plus rapide |

**Reste à faire sur cette étude** : parcourir Squarespace en vrai avec un compte d'essai (proposé par Nathan le 2026-11-10 ; Claude ne peut pas créer le compte lui-même) pour relever le détail du survol, de la barre de texte et du remplacement d'image, que les pages d'aide ne décrivent pas.

Sources :
- [Framer, Using on-page editing](https://www.framer.com/help/articles/on-page-editing/)
- [Webflow, Edit site content as a content editor](https://help.webflow.com/hc/en-us/articles/33961251014931)
- [Squarespace, Editing your site with Fluid Engine](https://support.squarespace.com/hc/articles/6421525446541)
- [Squarespace, article d’aide sur les styles du site](https://support.squarespace.com/hc/articles/205815788)
- [Wix, Adding and editing text](https://support.wix.com/en/article/wix-editor-adding-and-editing-text)
- [Taplink, Linktree vs Carrd](https://taplink.at/en/blog/linktree-vs-carrd.html) (comparatif d'un concurrent, à lire avec recul)

## 4. Principes retenus

1. **On modifie la page, pas un formulaire.** Le texte se tape là où il s'affiche, avec sa vraie police et sa vraie taille.
2. **Une seule entrée, toujours au même endroit** : un bouton crayon « Modifier ma page » en bas à droite. Le libellé reste écrit à côté de l'icône : une icône seule se devine, un mot se lit.
3. **Tout ce qui se modifie se voit.** En mode édition, chaque texte modifiable porte un cadre pointillé, chaque photo un bouton « Changer la photo ». Pas de menu caché, pas de clic droit.
4. **Aucune mise en forme à la main.** Pas de gras, de taille ni de couleur par texte : c'est le thème qui décide. L'hôte ne peut pas enlaidir sa page.
5. **Le style se choisit en un clic.** Trois vignettes de thème dans la barre du bas ; le clic applique le thème à toute la page, immédiatement.
6. **Pas de bouton « Enregistrer ».** Une modification est gardée dès qu'on sort du champ (ou Entrée) ; la barre répond « Enregistré ». Échap annule la saisie en cours.
7. **On sort par « Terminé »**, et la page redevient exactement ce que voit un voyageur.
8. **On ajoute une section là où on la veut.** En mode édition, un « + » est posé sur un trait entre deux sections. Un clic propose trois types, pas une bibliothèque de blocs : « Texte et photo », « Texte », « Photos ». La section apparaît à cet endroit, le curseur déjà dans son titre.
9. **On supprime sans confirmation, mais on peut se raviser.** « Supprimer la section » agit tout de suite ; la barre propose « Annuler » pendant quelques secondes.
10. **Le thème est choisi d'office d'après le lieu.** L'hôte arrive sur une page déjà habillée ; il ne change de thème que s'il le veut (section 7 bis).

## 5. Parcours de l'hôte

```
Tableau de bord → « Voir ma page »
┌──────────────────────────────────────────────┐
│  la page, telle que la voit un voyageur      │
│                                              │
│                       [✎ Modifier ma page]   │  ← seule commande visible
└──────────────────────────────────────────────┘
                      │ clic
                      ▼
┌──────────────────────────────────────────────┐
│  ┌┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┐         [Changer la photo]│
│  ┆ Titre de page  ┆  ← on clique, on tape     │
│  └┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘                           │
│  ┌──────────────────────────────────────────┐│
│  │ Cliquez sur un texte   [Aa][Aa][Aa]  [✓] ││  ← consigne, thèmes, Terminé
│  │ ou une photo…        Maison Rivage Nocturne││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- **Entrée réelle (2026-11-11)** : dans « Mes annonces », la page principale a un panneau « Page de présentation » avec le bouton « Modifier ma page ». Il ouvre la page directement en mode édition (l'hôte vient de dire qu'il veut modifier). « Terminé » montre la page telle qu'un voyageur la voit, avec deux boutons en bas à droite : « Mes annonces » et le crayon.
- Sur téléphone, la barre passe sur deux lignes : la consigne et « Terminé », puis les trois thèmes sur toute la largeur.
- En mode édition, les cartes des logements ne naviguent plus : un clic sert à modifier, pas à quitter la page.
- Entre deux sections, un trait pointillé porte un « + » en son milieu et, à droite, « Supprimer la section » pour celle qui suit (sur téléphone, seulement l'icône de corbeille). Le « + » n'occupe aucune hauteur : la page a exactement la même mise en page avec ou sans lui.
- La page gagne une marge en bas pour que la barre ne cache jamais la fin du contenu.

## 6. Ce qui est modifiable

| Élément | Type | Limite | Vient de |
|---|---|---|---|
| Titre de la page | une ligne | 80 caractères | `core.title` (existe) |
| Phrase d'accroche | une ligne | 180 | nouveau |
| Lieu | une ligne | 80 | nouveau (proposé par défaut depuis `core.city` / `core.region`) |
| Photo d'en-tête | image | – | `medias.images[0]` (existe) |
| Titre de la liste des logements | une ligne | 80 | nouveau (défaut « Nos logements ») |
| Thème | un parmi trois, ou automatique | – | nouveau |
| Sections | liste ordonnée, voir ci-dessous | – | nouveau |

Sections que l'hôte peut ajouter et supprimer :

| Type | Contenu | Remarque |
|---|---|---|
| Texte et photo | titre (80), texte brut (1 200), une photo | Une section sur deux inverse ses colonnes. La première porte la signature de l'hôte. La présentation d'origine (`core.description`, `medias.images[1]`) devient la première section de ce type (voir décision D3) |
| Texte | titre (80), texte brut (1 200) | |
| Photos | titre (80), trois photos | Un emplacement vide ne s'affiche pas au voyageur |
| Logements | titre (80) | Toujours présente, une seule fois, jamais supprimable |

Une section entièrement vide n'est pas montrée au voyageur.

Non modifiable sur la page, volontairement : les cartes des logements (titre, photo, prix, capacité viennent de chaque annonce), les liens légaux, le nom de l'hôte (il vient du profil). Déplacer une section n'est pas prévu : on la supprime et on la recrée ailleurs, ou on attend que le besoin se confirme.

## 7. Les trois thèmes

Source unique : `frontend/src/domain/listings/pageThemes.ts`. Les différences de mise en page sont dans `frontend/src/views/ListingHub/themed/themed-hub-page.scss`.

### Vue d'ensemble

| | Maison | Rivage | Nocturne |
|---|---|---|---|
| Validation | Validé le 2026-11-10 | Version 2 validée le 2026-11-10 | Validé le 2026-11-10 |
| Pour qui | Maison de caractère, gîte, chambre d'hôtes | Appartement, location de bord de mer | Lieu à forte identité visuelle, belles photos |
| Titres | Cormorant Garamond 500 | DM Sans 800, très grand | Fraunces 400 |
| Texte | Proza Libre | DM Sans | Libre Franklin |
| Fond | `#f3f4ef` pierre claire | `#f7f0e3` sable | `#15191e` ardoise |
| Blocs | `#ffffff` | `#ffffff` | `#1e242b` |
| Encre | `#1e2a24` | `#0b2545` marine | `#f2efe9` ivoire |
| Texte secondaire | `#56645c` | `#4d5f78` | `#a9b0b8` |
| Couleur d'action | `#2e5a47` pin | `#1650c5` azur | `#e3a857` ambre |
| Couleur de relief | identique à l'action | `#ffc94a` soleil | identique à l'action |
| Formes | Angles presque droits | Arche, hublot, boutons en pilule | Coins légèrement arrondis |
| En-tête | Centré : lieu, titre, accroche en italique, puis grande photo panoramique | Aplat azur pleine largeur, titre d'affiche en blanc, photo en arche qui déborde sous l'aplat | Photo plein écran, titre posé en bas sur un fondu |
| Poids des polices (latin) | 126 Ko | 37 Ko | 97 Ko |

### Pourquoi ces polices

Associations relevées dans des sources de typographie, pas inventées :

- **Cormorant Garamond + Proza Libre** : première des cinq associations titre et texte recommandées par Typewolf. Cormorant y est décrit comme réservé aux titres (ses contreformes sont trop petites pour du texte courant), Proza Libre comme une linéale humaniste dessinée pour l'écran. C'est exactement l'usage fait ici.
- **DM Sans**, seule : première du classement Typewolf des polices Google Fonts (mise à jour du 2026-01-12). Une seule famille pour tout le thème, ce qui en fait aussi le plus léger.
- **Fraunces + Libre Franklin** : Fraunces est citée par FontAlternatives pour les hôtels de charme (elle adapte son dessin à la taille d'affichage) ; Libre Franklin est septième du classement Typewolf, dessinée pour l'écran. L'association des deux n'est citée telle quelle par aucune des sources lues : c'est un choix de Claude à partir de deux polices recommandées séparément.

Écartées : Playfair Display + Montserrat (l'association la plus citée, mais décrite comme surutilisée par la source même qui la recommande) ; Inter (trop associée aux interfaces d'outils).

Sources :
- [Typewolf, Five Fresh Headline & Body Text Pairings on Google Fonts](https://www.typewolf.com/blog/google-fonts-combinations)
- [Typewolf, The 40 Best Free Fonts Available on Google Fonts](https://www.typewolf.com/google-fonts)
- [FontAlternatives, Best Free Fonts for Travel & Hospitality](https://fontalternatives.com/best-fonts-for/travel-hospitality/)
- [JPK Design Co, My Favorite Font Pairings for Squarespace](https://www.jpkdesignco.com/blog/squarespace-font-pairings)

### Pourquoi ces couleurs

- Aucun thème ne reprend l'encre d'IndieHost : la page est celle de l'hôte, pas la nôtre.
- Chaque palette tient en huit couleurs nommées par leur rôle, jamais par leur teinte, pour qu'un quatrième thème éventuel se branche sans toucher au CSS. La « couleur de relief » (étiquettes de prix, bouton posé sur un aplat) n'est distincte de la couleur d'action que dans Rivage.
- Écartés exprès parce que vus partout : le fond crème avec titre à empattements et terre cuite, et le noir avec une couleur fluo.
- Contrastes calculés (norme AA : 4,5 pour le texte) :

| | Texte sur fond | Texte secondaire sur fond | Couleur d'action sur fond | Texte du bouton |
|---|---|---|---|---|
| Maison | 13,5 | 5,6 | 7,1 | 7,9 |
| Rivage | 13,6 | 5,7 | 6,2 | 7,0 (blanc sur azur), 10,0 (marine sur soleil) |
| Nocturne | 15,4 | 8,1 | 8,4 | 8,4 |

### Polices : hébergement et licence

- Fichiers dans `frontend/public/assets/fonts/themes/` (14 fichiers, 488 Ko), déclarés dans `page-theme-fonts.scss`. Aucun appel à Google Fonts, comme pour Fustat et Outfit.
- Origine : paquets Fontsource 5.3.0. Licence SIL Open Font License 1.1 pour les cinq familles.
- Le navigateur ne télécharge que les fichiers du thème affiché.
- Le Fraunces italique a été retiré : 81 Ko pour une seule ligne de signature.

## 7 bis. Thème appliqué d'office selon le lieu

Règle demandée par Nathan le 2026-11-10 : la page prend d'elle-même le thème qui correspond à l'endroit où se trouvent ses logements. Le lieu se lit dans l'adresse de l'annonce, rien n'est demandé à l'hôte.

| Lieu du logement | Thème d'office |
|---|---|
| À proximité de la mer (côte à moins de 10 km) | Rivage |
| En montagne, ou dans les terres | Maison |
| Annonce sans adresse | Thème par défaut (décision D2) |

- **Le choix de l'hôte prime toujours.** La règle ne vaut que tant qu'il n'a pas choisi lui-même. Dans la barre, le thème d'office porte la mention « Conseillé ».
- **Plusieurs logements sur la page** : le thème qui revient le plus l'emporte ; à égalité, la mer passe avant les terres.
- **Nocturne n'est jamais appliqué d'office** : un thème sombre se choisit.
- Montagne et terres donnent le même thème : il n'y a donc pas besoin de connaître l'altitude, seulement la distance à la mer.

### Comment le lieu est connu (fait le 2026-11-10)

- L'hôte place déjà son logement dans le panneau « Localisation » : l'annonce porte `core.latitude` et `core.longitude`.
- L'API mesure la distance de ce point à la côte la plus proche (`backend/api/src/lib/coastline.ts`) et en tire `sea` ou `inland` (`backend/api/src/domains/listings/placeSetting.ts`).
- Le tracé des côtes est embarqué dans l'API : terres Natural Earth au 1:10 000 000 (domaine public), livrées par le paquet `world-atlas` (licence ISC). **Aucun appel à un service extérieur**, donc ni panne, ni quota, ni coordonnées envoyées à un tiers.
- Le résultat n'est pas stocké : le calcul prend moins d'une milliseconde et suit toute correction de l'adresse.
- Il est renvoyé pour chaque logement d'une page principale par `GET /listings/:id/children`, dans le champ `setting`. La valeur ne révèle pas l'adresse.
- Le côté navigateur applique la règle avec `suggestPageThemeId` (`pageThemes.ts`).

Vérification : `cd backend/api && npx tsx scripts/place-setting-smoke.ts` rejoue 32 lieux réels.

| Lieu | Distance à la côte | Classement |
|---|---|---|
| Saint-François (Guadeloupe) | 0,3 km | mer |
| La Rochelle, Saint-Malo, Lisbonne | moins de 0,3 km | mer |
| Biarritz, Cassis, Honfleur, Porto-Vecchio | 0,6 à 0,7 km | mer |
| Nice, Arcachon, île de Ré | 1,2 à 1,4 km | mer |
| Vannes, Bayonne | 2,1 et 5,6 km | mer |
| Bordeaux (centre) | 7,2 km de l'estuaire | mer |
| Montpellier (centre) | 10,02 km | terres, de justesse |
| Perpignan, Béziers, Narbonne, Arles | 11,6 à 12,3 km | terres |
| Nantes, Caen, Aix-en-Provence | 13 à 18 km | terres |
| Chamonix, Annecy, Dijon, Paris | plus de 60 km | terres |

Limites connues :
- La précision du tracé est de l'ordre du kilomètre : un logement à 9 ou 11 km de la côte peut tomber d'un côté ou de l'autre du seuil. Montpellier-centre est exactement dans ce cas.
- Un lac n'est pas la mer (Annecy est classé « terres ») ; un estuaire compte comme une côte. Conséquence du seuil à 10 km : le centre de Bordeaux, à 7 km de l'estuaire de la Gironde, est classé « mer » et reçoit Rivage d'office.
- Le seuil est de 10 km (`SEA_PROXIMITY_KM`), fixé par Nathan le 2026-11-10 ; la première proposition de Claude était 5 km.
- La route n'a pas pu être rejouée sur une vraie page principale : la base locale n'en contient pas.

Pistes écartées : le service public Overpass d'OpenStreetMap (testé le 2026-11-10, il répondait « serveur saturé » à toutes les requêtes) ; les classements officiels des communes littorales et de montagne (valables seulement en France, et inutiles dès lors que la distance à la côte suffit).

## 8. Architecture technique

### Les fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/domain/listings/pageThemes.ts` | Registre des thèmes, types `HubPageContent` et `HubPageListing`, variables CSS |
| `frontend/src/views/ListingHub/themed/ThemedHubPage.vue` | La page à thème. Composant de présentation pur : contenu et thème en entrée, modifications en sortie |
| `frontend/src/views/ListingHub/themed/themed-hub-page.scss` | Structure commune, puis ce qui change par thème, puis le mode édition |
| `frontend/src/views/ListingHub/themed/page-theme-fonts.scss` | Déclaration des polices |
| `frontend/src/views/ListingHub/themed/EditableText.vue` | Un texte modifiable sur place (texte brut, Entrée valide, Échap annule, collage sans mise en forme) |
| `frontend/src/views/ListingHub/themed/SectionInserter.vue` | Le « + » entre deux sections et son choix de trois types |
| `frontend/src/views/ListingHub/themed/PageEditBar.vue` | Le bouton crayon et la barre du bas, aux couleurs d'IndieHost : consigne, thèmes, « Annuler », « Terminé » |
| `frontend/src/views/ListingHub/dev/` | Route `/dev/page-themes` et faux contenu (développement uniquement) |
| `frontend/src/domain/listings/hubPageContent.ts` | Lecture de `core.page`, contenu par défaut, limites. Partagé par la page publique et le mode édition |
| `frontend/src/views/ListingHub/edit/useHubPageEditing.ts` | Logique du mode édition : applique la modification, l'enregistre, gère « Annuler », « Réessayer » et l'envoi des photos. Ne sait pas où vont les données |
| `frontend/src/views/ListingHub/edit/HubPageEditRoute.vue` | Route du tableau de bord : branche la logique sur l'API et sur ImageKit |
| `frontend/src/views/Editor/…/ListingPanels/HubPagePanel.vue` | Panneau « Page de présentation » de l'éditeur, avec le bouton « Modifier ma page » |
| `backend/api/src/domains/listings/hubPage.ts` | Schéma, nettoyage et limites de `core.page` côté API |

### Le mode édition (fait le 2026-11-11)

**Données.** Un objet `core.page` dans le JSON de l'annonce, sans migration :
```ts
core.page = {
  theme?: 'maison' | 'rivage' | 'nocturne',   // absent : thème d'office selon le lieu
  tagline, location,                          // location vide : le lieu des logements
  sections: PageSection[],                    // types dans pageThemes.ts
}
```
Le titre reste `core.title` et la photo d'en-tête la première photo de l'annonce. Tant que l'hôte n'a rien modifié sur sa page, `core.page` n'existe pas : la page affiche la présentation de l'annonce (description et deuxième photo), puis les logements. À la première modification, toute la page est enregistrée, présentation comprise, en texte brut (décision D3).

**API.** Deux routes, réservées au propriétaire et à l'admin, pour une page principale uniquement :

| Route | Rôle |
|---|---|
| `GET /listings/:listingId/page` | Ouvre le mode édition : contrôle d'accès et réglages enregistrés |
| `PUT /listings/:listingId/page` | Enregistre la page entière, plus le titre et la nouvelle photo d'en-tête s'ils sont fournis |

- Le schéma zod refuse un thème ou un type de section inconnu. Les textes sont ramenés à du texte brut et coupés aux limites de la section 6. Au plus douze sections ajoutées ; la section des logements existe toujours, une seule fois.
- Une photo n'est acceptée que si elle est hébergée sur ImageKit, ou si l'annonce l'affichait déjà.
- `core.page` ne s'écrit **que** par cette route. La route générique de l'éditeur (`PATCH /listings/core/:id`) le conserve tel quel, et `POST /listings` l'ignore : un brouillon de l'éditeur chargé avant ne peut pas remplacer la page.
- `core.description` suit le premier texte de la page. Elle ne sert plus à l'affichage, seulement aux aperçus de partage et aux moteurs de recherche.

**Côté site.**
- Route `/dashboard/page/:listingId` (`page-editor`), chargée à part : le code d'édition n'arrive jamais avec la page publique.
- Enregistrement immédiat (décision D4) : un seul envoi à la fois, et une modification faite pendant un envoi en déclenche un autre aussitôt après, avec l'état le plus récent. La barre affiche « Enregistrement… » puis « Enregistré ». En cas d'échec, le message reste, avec « Réessayer ». Fermer l'onglet pendant un envoi demande confirmation.
- Photos : envoi ImageKit existant (`uploadGalleryImageToImageKit`), sans attendre que la page soit en ligne.
- Le titre ne peut pas être vidé : le champ reprend l'ancien texte.
- Dans l'éditeur, la page principale n'a plus de panneau « Description » : sa présentation se modifie sur la page.
- Après chaque enregistrement, la copie de l'annonce que l'éditeur garde dans le navigateur est effacée, sinon il rouvrirait l'ancien titre et « Appliquer » le remettrait en ligne.

**Vérifié en local le 2026-11-11.**
- Service : 32 contrôles (accès, nettoyage, limites, photos, protection contre l'éditeur).
- Routes, par HTTP : 401 sans session, 403 pour un autre compte, 400 pour un logement simple ou un thème inconnu, 404 pour une annonce inconnue.
- Parcours réel dans le navigateur, sur une page de test avec un logement : chargement, titre, accroche, thème, ajout d'une section, suppression puis « Annuler », lecture en base, page publique à jour, retour à l'éditeur.
- Route de développement : erreur d'enregistrement et « Réessayer », limite de douze sections, photo, fichier qui n'est pas une image, rendu à 320, 360 et 390 px.

**Pas vérifié.** L'envoi réel d'une photo vers ImageKit depuis la page (pour ne pas laisser de fichier de test sur le compte ; la fonction d'envoi est celle de la galerie). Le parcours avec une vraie session Clerk, et en production.

**Limites connues.**
- L'éditeur ouvert dans un autre onglet garde son ancienne copie : « Appliquer » y remettrait l'ancien titre et l'ancienne photo d'en-tête. La page (`core.page`) est protégée, pas ces deux champs.
- Un lieu vidé par l'hôte reprend celui des logements : on ne peut pas afficher une page sans lieu si tous les logements sont au même endroit.
- Une photo remplacée reste sur ImageKit.
- Pas de retour au thème « automatique » dans la barre une fois un thème choisi (l'API l'accepte, avec `theme: null`).

### La page publique (fait le 2026-11-10)

`_ListingHub.vue` fait le lien entre les données réelles et `ThemedHubPage` :

| Élément de la page | Vient de |
|---|---|
| Titre | `core.title` |
| Photo d'en-tête | première photo de la page principale ; sans photo, l'en-tête se réduit au titre |
| Lieu | `core.page.location` s'il existe, sinon la ville des logements quand ils sont tous au même endroit |
| Présentation | `core.description`, ramenée à du texte (paragraphes gardés, mise en forme retirée), avec la deuxième photo |
| Logements | les logements rattachés et en ligne ; sans aucun, « Aucun logement en ligne pour le moment » |
| Thème | `core.page.theme` s'il existe, sinon le thème d'office : `placeSettings` renvoyé par `GET /listings/:id/children` (lieu de tous les logements rattachés, en pause compris) |

- Une carte de logement ne dépasse pas 26rem : un logement seul ne s'étire pas sur toute la largeur.
- Dans l'aperçu de l'éditeur, la page est rendue « dans un cadre » (`embedded`) : elle ne repeint pas le fond du tableau de bord et ses cartes ne naviguent pas.
- Le cadre `#listing-page` est fixé à la hauteur de l'écran pour les annonces (qui défilent dans leurs colonnes) ; il est relâché pour la page principale, sinon tout ce qui dépassait l'écran était coupé. Ce défaut existait déjà avec l'ancienne page, masqué tant que les pages étaient courtes.
- Vérifié en local sur une page principale de test rattachée à deux logements à Saint-François (un en ligne, un en pause) : thème Rivage appliqué d'office, lieu repris des logements, page sans barre de navigation. Les variantes sans photo et sans logement ont été regardées sur la route de développement (`&photo=0`, `&logements=0`).

### Points d'attention

- **Pas d'édition sur le domaine personnalisé.** Sans session Clerk sur ces domaines, le crayon ne peut pas y apparaître. L'édition se fait depuis le tableau de bord, sur un aperçu fidèle.
- **Règle globale de police.** `styles/typography/_texts.scss` pose Outfit et l'encre d'IndieHost sur chaque élément. La page à thème l'annule en tête de sa feuille de style ; tout nouveau composant placé dans la page en hérite.
- **Fond du document.** Le composant peint le fond du `body` à la couleur du thème et règle `color-scheme`, sinon la marge de la barre de défilement reste claire sur le thème sombre.
- **Tailles de texte.** Elles sont locales à la page (variables `--page-*-size`) : les mixins `base-text` et `main-title` imposent les polices d'IndieHost. C'est une exception assumée à la règle « pas de taille en dur », limitée à ce fichier.
- **CSP.** Polices et styles viennent du même domaine : rien à ajouter à la politique actuelle.
- **Accessibilité.** Chaque champ modifiable a un nom lu par les lecteurs d'écran ; les thèmes sont un groupe de boutons radio ; « Enregistré » est annoncé ; tout est atteignable au clavier.

## 9. Étapes proposées

| Étape | Contenu | État |
|---|---|---|
| 0 | Étude, trois thèmes maquettés, prototype du mode édition sur faux contenu | Fait le 2026-11-10 |
| 1 | Validation des thèmes par Nathan, un par un, sur les maquettes | Fait le 2026-11-10 |
| 2 | Page publique à thème, sans édition : `_ListingHub.vue` rend la page à thème, thème d'office selon le lieu | Fait le 2026-11-10 |
| 2 bis | Choix du thème par l'hôte et textes propres à la page (`core.page` : validation et nettoyage côté API) | Fait le 2026-11-11, dans le mode édition (pas de réglage séparé dans l'éditeur) |
| 3 | Mode édition : route du tableau de bord, enregistrement, photos | Fait le 2026-11-11, vérifié en local, pas en production |
| 4 | Finitions : annuler la dernière modification, aide au premier passage, essais sur téléphone réel | À faire |
| 5 | Étendre aux pages d'annonce simples, si le besoin se confirme | À décider |

L'étape 2 est livrable seule : les hôtes ont déjà de beaux thèmes avant que l'édition sur place n'arrive.

## 10. Décisions à prendre

| | Question | Recommandation de Claude |
|---|---|---|
| D1 | Les trois thèmes conviennent-ils ? | **Tranché le 2026-11-10** : Maison, Rivage (version 2) et Nocturne sont validés |
| D2 | Quel thème par défaut pour les pages existantes ? | **Appliqué le 2026-11-10** faute d'objection : Maison, pour une page dont aucun logement n'a d'adresse. L'ancienne apparence IndieHost de la page principale n'existe plus |
| D3 | Le texte de présentation devient-il du texte brut ? | **Appliqué le 2026-11-11** (« mets ça en ligne » de Nathan, sur la recommandation de Claude). Oui pour la page principale : c'est la condition de l'édition sur place sans barre de mise en forme. La description des annonces garde son éditeur riche |
| D4 | Enregistrement immédiat en ligne, ou brouillon puis « Appliquer » comme dans l'éditeur ? | **Appliqué le 2026-11-11**, même accord. Immédiat, avec « Annuler » : le brouillon ajoute une étape que la règle de simplicité n'autorise pas. À confirmer, car c'est différent de l'éditeur actuel |
| D5 | Les pages d'annonce simples reçoivent-elles aussi les thèmes ? | Plus tard : la page d'annonce a un tunnel de réservation à habiller, c'est un chantier à part |
| D6 | L'hôte peut-il changer la couleur d'action de son thème ? | Non au départ. Si la demande revient, proposer trois ou quatre variantes vérifiées par thème, pas un sélecteur libre |
| D7 | Que recouvre « le reste » dans la règle du lieu ? | Avec l'adresse, tout logement est soit près de la mer, soit dans les terres. « Le reste » ne peut donc être que l'annonce sans adresse, qui reçoit le thème par défaut de D2. À confirmer |
| D8 | Le thème « Maison » doit-il s'appeler « Montagne » ? | Non : il sert aussi aux logements dans les terres, où « Montagne » sonnerait faux. À vous de dire |
| D9 | Combien de sections au maximum par page ? | Douze, pour borner la longueur de la page et la taille des données. **Appliqué le 2026-11-11** faute d'objection, modifiable (`PAGE_LIMITS.maxSections`, des deux côtés) |
| D10 | À quelle distance de la côte un logement est-il « à proximité de la mer » ? | **Tranché le 2026-11-10** : 10 km |

## 11. Journal

- **2026-11-10** – Demande de Nathan : crayon sur la page, édition à la volée, trois thèmes au maximum, document de suivi. Étude des aides de Framer, Webflow, Squarespace et Wix. Trois thèmes dessinés (Maison, Rivage, Nocturne) et montrés sur du faux contenu (`/dev/page-themes`). Prototype du mode édition : textes modifiables sur place, changement de photo, changement de thème en direct.
- **2026-11-10** – Ajustements après relecture des maquettes par Claude :
  - le texte courant héritait de la police d'IndieHost à cause de la règle globale, corrigé ;
  - les cadres pointillés de deux textes voisins se chevauchaient, décalage rendu fixe ;
  - le bouton « Changer la photo » passait sous la barre d'édition, déplacé en haut à droite de la photo ;
  - barre d'édition réorganisée sur téléphone ;
  - Fraunces italique retiré (81 Ko).
- **2026-11-10** – Retour de Nathan sur les maquettes : Maison et Nocturne « très bien », Rivage « pas assez marqué ». Rivage refait (version 2) : la première version, blanc et bleu-gris avec des encadrés arrondis, ressemblait à n'importe quel site d'application. La nouvelle part de l'affiche de bord de mer : aplat azur pleine largeur, titre très gras et très grand, photo d'en-tête en arche qui déborde sous l'aplat, photo de présentation en hublot, prix en étiquettes jaune soleil, fond sable. La police reste DM Sans, poussée à 800. Ajout au registre d'une « couleur de relief ». En mode édition, les cadres passent en blanc sur l'aplat et le bouton de photo se centre en haut de l'arche et du hublot, dont les coins sont rognés.
- **2026-11-10** – Demande de Nathan : des « + » entre les sections en mode édition pour en ajouter. Le prototype passe d'une page figée à une liste de sections : trois types ajoutables, suppression avec « Annuler », section des logements toujours présente. Le bouton de suppression a d'abord été posé au-dessus de la section, où il chevauchait le titre sur téléphone ; il est maintenant sur le trait du « + », réduit à l'icône sur téléphone.
- **2026-11-10** – Demande de Nathan : le thème s'adapte tout seul au lieu des logements (mer : Rivage ; montagne ou terres : Maison ; le reste : thème par défaut). Règle écrite et testable sur les maquettes avec `?lieu=` ; la détection du lieu reste à construire côté serveur (section 7 bis).
- **2026-11-10** – Remarque de Nathan : le lieu se connaît par l'adresse de l'annonce. Fait : l'API classe chaque logement « mer » ou « terres » à partir de ses coordonnées et du tracé des côtes embarqué, sans service extérieur, et le renvoie dans la liste des logements d'une page principale. Le cadre passe de quatre valeurs (mer, montagne, terres, ville) à deux : montagne et terres donnent le même thème, et la ville n'est plus un cas à part.
- **2026-11-10** – Décisions de Nathan : Rivage version 2 validé, donc les trois thèmes le sont ; seuil « à proximité de la mer » porté de 5 à 10 km. Effet mesuré du nouveau seuil : Bordeaux-centre et Bayonne passent en « mer », Montpellier-centre reste en « terres » à 20 mètres près.
- **2026-11-10** – Demande de Nathan : « branche les thèmes en production ». Fait pour la page principale publique (détail en section 8). La description riche de la page est affichée en texte simple ; rien n'est modifié dans les données. Reste hors de ce branchement : le choix du thème par l'hôte, le mode édition, les pages d'annonce simples.
- **2026-11-11** – Nathan constate qu'il voit sa page « comme un client classique », sans pouvoir la modifier, puis demande de mettre le mode édition en ligne. Étapes 2 bis et 3 écrites : `core.page`, deux routes d'API, route `/dashboard/page/:listingId`, panneau « Page de présentation » dans l'éditeur. Décisions D3, D4 et D9 appliquées selon les recommandations. Le mode édition s'ouvre depuis le tableau de bord et non depuis le domaine de l'hôte, qui n'a pas de session de connexion. La route de développement fait maintenant tourner le vrai mode édition.
- **2026-11-10** – Idées notées, non retenues pour l'instant : bulle d'aide au premier passage sur le crayon ; aperçu « téléphone » dans la barre ; annulation de la dernière modification ; section « Avis » et section « Nous trouver » ; duplication du contenu d'un thème à l'autre (inutile : le contenu est indépendant du thème).
