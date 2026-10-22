# TODO IndieHost

Liste unique de ce qui reste à faire. Toute session Claude la lit avant de commencer une tâche et y note ce qui est remis à plus tard (règle dans `CLAUDE.md`, section « Suivi des tâches »).

Le fichier a toujours deux parties :
- **Ce que vous devez faire** : action ou décision de Nathan (information, contrat, compte externe, validation, test en réel).
- **À faire par Claude** : développement ou configuration que Claude peut faire dès que vous dites go. Une tâche qui attend une action de votre part le précise (« après … »).

Une tâche terminée est cochée, puis déplacée dans « Fait » avec sa date et son commit.

## Ce que vous devez faire

### Légal et argent

- [ ] Donner un numéro de téléphone de contact. La LCEN l'impose dans les mentions légales (`frontend/src/views/Legal/content/mentions-legales.html`, section « Éditeur du site »).
- [ ] Adhérer à un médiateur de la consommation (par exemple CM2C ou Medicys). C'est obligatoire, car la plupart des hôtes sont des particuliers. Claude complètera ensuite les CGV (voir « À faire par Claude »).
- [ ] Faire valider par un avocat :
  - les CGV hôtes, les CGU voyageurs et la page annulation et remboursement ;
  - la **taxe de séjour** : les paiements en destination charges font probablement d'IndieHost un intermédiaire de paiement (art. L2333-34 CGCT), qui doit collecter la taxe pour les loueurs particuliers ;
  - la déclaration **DAC7** des revenus des hôtes (art. 1649 ter A CGI).
- [ ] Tester en réel, en mode test Stripe ou avec une petite réservation :
  - annulation par le voyageur avec et sans « Rembourser le voyageur s'il annule » ;
  - « Annuler et rembourser » depuis la page Gestion ;
  - résiliation puis reprise de l'abonnement depuis Mon profil.
- [ ] Décider qui paie les frais Stripe des réservations. En destination charges sans commission (`application_fee_amount` à 0), ils sont prélevés sur le compte d'IndieHost, alors que la FAQ dit « seuls les frais de transaction de Stripe s'appliquent ».
- [ ] Consigner dans un registre interne des violations l'incident du 2026-10-22 (art. 33.5 RGPD), en quatre points :
  - les réservations et les guides d'arrivée étaient lisibles publiquement ;
  - cause : routes API sans contrôle d'accès ;
  - correctif : commit `8caed97` ;
  - constat : 0 donnée de voyageur exposée (2 annonces en brouillon, 0 réservation).

### RGPD

- [ ] Option : supprimer le conteneur Google Tag Manager `GTM-W7W68HMP` et la propriété GA4 `G-KED539W25B` côté Google. Ils ne sont plus chargés par le site.

### Produit

- [ ] Option : choisir un outil de mesure d'audience sans cookie (Plausible, Umami ou Matomo configuré en mode exempté), si vous voulez des statistiques.
- [ ] Renseigner un pseudo dans « Mon profil » (menu de l'avatar) : sans pseudo, la page principale affiche « Proposé par sciranguinvest », tiré de l'adresse e-mail.
- [ ] Ouvrir https://indiehost.fr/sign-up en navigation privée et regarder la case « J'accepte les CGV… » : elle a été stylée sans pouvoir l'afficher, car la session de Claude est connectée et Claude ne saisit pas de mot de passe en production.

### Sécurité (audit du 2026-10-22)

- [ ] Vérifier dans le Clerk Dashboard (Production → Users) qu'aucun compte n'a de clé `role` dans son *Unsafe metadata*. Avant `507d16c`, ce champ, modifiable par l'utilisateur lui-même, suffisait pour devenir super admin. Claude n'a pas pu lister les utilisateurs (données personnelles).
- [ ] Faire une vraie réservation de test dès qu'une annonce est publiée. Depuis `229cd07`, le prix est recalculé côté serveur (`payments/reservationPricing.ts`) et la réservation exige un PaymentIntent vérifié ; ce parcours n'a pas pu être testé en prod (aucune annonce publiée).
- [ ] Si vous aviez gelé une annonce en tant qu'admin avant le 2026-10-22, la repasser en « Réservations bloquées » : le gel n'est verrouillé pour le propriétaire que s'il porte le marqueur `core.blockedBy`, posé depuis `229cd07`.

## À faire par Claude

### Légal et argent

- [ ] Compléter l'article 18 de `cgv.html` avec le nom et les coordonnées du médiateur de la consommation (après votre adhésion).
- [ ] Envoyer un e-mail de confirmation au voyageur après sa réservation (support durable, art. L221-13 C. conso). Aujourd'hui, seule la page de confirmation existe ; le backend n'envoie aucun e-mail.
- [ ] Ajouter dans l'éditeur le statut de l'hôte (particulier ou professionnel) et l'afficher sur l'annonce et au checkout (art. L111-7 C. conso). Les CGV le promettent déjà (article 3).
- [ ] Ajouter le numéro d'enregistrement du meublé de tourisme (loi Le Meur) dans l'éditeur et l'afficher sur l'annonce publique.
- [ ] Collecte de la taxe de séjour et export DAC7 (après l'avis de l'avocat).

### RGPD

- [ ] Permettre la suppression et l'export de compte (droits art. 15 à 20), et ajouter le webhook Clerk `user.deleted`. Aujourd'hui, supprimer une annonce ne change que son statut, et les lignes `User` restent en base.
- [ ] Purger automatiquement selon les durées annoncées dans `confidentialite.html` :
  - réservations : 5 ans après le séjour, puis anonymisation ;
  - messages : 1 an après le séjour ;
  - `Payment.rawRequest` et `rawResponse` (le second contient le `client_secret`) ;
  - `CalendarSync.rawIcs` ;
  - comptes inactifs depuis 3 ans.
- [ ] Retirer le nombre de voyageurs à mobilité réduite (PMR) des métadonnées Stripe, car c'est une donnée de santé (`payments.service.ts`, `checkoutPayment.ts`).
- [ ] Masquer dans les logs Fastify les `?token=` et les clés de guide `rg.` (option `redact` du logger), et ajouter une rotation des logs nginx et Docker.

### Accessibilité, SEO et agents IA

- [ ] Texte alternatif des photos d'annonce :
  - ajouter un champ « Description de la photo » dans l'éditeur et l'assistant de création ;
  - utiliser comme repli « <titre> — photo N », au lieu du nom de fichier (`GalleryPanel.vue`) ;
  - reprendre les légendes lors de l'import Airbnb ;
  - prendre `||` au lieu de `??` dans les transformations d'import.
- [ ] Donner un nom accessible aux boutons de la galerie (`Tile.vue`, `Gallery.vue`) et aux 6 vidéos. Ajouter un bouton pause aux vidéos de la landing.
- [ ] Afficher les notes d'avis sous forme de texte lisible (« Note : 4 sur 5 ») et non seulement en étoiles (`CommentCard.vue`). Corriger les 5 alt identiques de la landing (`locales/landing/fr.json`).
- [ ] Donner un `<title>` à chaque route (`meta.title` et `router.afterEach`), et remettre `lang="fr"` en quittant la landing (`useLandingLocale.ts`).
- [ ] Pré-rendre la landing et `/pricing` en HTML statique, comme les pages légales, pour les agents IA qui n'exécutent pas JavaScript.
- [ ] Rediriger `www.indiehost.fr` vers `indiehost.fr` en 301 (règle Cloudflare) : les deux répondent aujourd'hui en 200.
- [ ] Afficher les liens légaux sur les pages d'annonce des hôtes. Le pied de page global n'y est pas, pour ne pas gêner la barre de réservation mobile ; prévoir une version compacte à tester sur mobile.

### Produit et technique

- [ ] Afficher le règlement intérieur de l'hôte avant le paiement : la version publique du guide d'arrivée contient `practical.rules`.
- [ ] Réparer le dépôt d'avis par le voyageur depuis le guide : `PATCH /listings/comments` est réservé au propriétaire, donc l'envoi échoue. Prévoir une route protégée par la clé de guide.
- [ ] Regrouper les barèmes d'annulation, aujourd'hui définis à trois endroits :
  - `bookings.service.ts` ;
  - `reservationRules.ts` ;
  - `CancellationPanel.vue`.
- [ ] Webhooks Stripe pour suivre les remboursements échoués et les litiges (aucun webhook n'est utilisé aujourd'hui).

### Interface (passe contraste et Clerk du 2026-10-22)

- [ ] Dédoublonner les appels API au chargement du tableau de bord : sur l'éditeur, `GET /payments/stripe/subscriptions/me` part 7 fois, `/users/me/listings` et chaque section d'annonce (`core`, `bookings`, `medias`…) 2 fois, `/listings/:id/domain` 4 fois (34 requêtes au total). Partager une seule promesse par ressource. L'écran de chargement attend la fin de ces appels, donc chaque doublon retire en partie le délai d'affichage.
- [ ] CSP complète : autoriser par son hash le script en ligne de `frontend/index.html` qui pose `html.is-booting` (écran de chargement du tableau de bord), sinon le fond mobile redevient sombre avant le montage de l'app.

- [ ] Nom public de l'hôte : ne plus le tirer de la partie locale de l'e-mail (`readEmailLocalPart` dans `backend/api/src/domains/listings/listings.service.ts`, `resolveIdentityLabel` dans `users/users.repository.ts`). Afficher le prénom, sinon « votre hôte ». Demande un redéploiement de l'API.
- [ ] Libellé par défaut `status: 'Host'`, en anglais, dans `toHostProfile` (`users.repository.ts`), affiché sous le nom de l'hôte sur l'annonce (`HostProfile.vue`). Le remplacer par « Hôte » ou le laisser vide.
- [ ] Pied de page de la landing en thème sombre : `.layout-footer` garde son fond `$accent` clair (`styles/layouts/_footer.scss`). Lui donner une variante sombre.
- [ ] Ajuster le style de la case CGV de l'inscription Clerk (`styles/components/_clerk.scss`, classes `cl-formFieldCheckbox*`) (après votre vérification en navigation privée).
- [ ] Avertissements Sass `mixed-decls` au build (environ 180) : des mixins (`_texts.scss`, `_buttons.scss`, `_inputs.scss`…) placent des déclarations après des règles imbriquées. Dart Sass 2 changera l'ordre de sortie, donc le rendu ; remettre les déclarations avant les règles imbriquées.

### Sécurité (audit du 2026-10-22)

- [ ] Domaines personnalisés : prouver la propriété par un enregistrement TXT. Aujourd'hui l'enregistrement A suffit, donc le premier compte qui déclare un domaine pointant déjà vers le VPS l'obtient (`CustomDomainPanel.vue`, vérification dans `listings.service.ts`).
- [ ] CSP complète (`script-src`, `connect-src`, `frame-src`) dans `nginx/proxy-locations.conf`, d'abord en `Content-Security-Policy-Report-Only` pour repérer ce qui casserait (Clerk, Stripe, ImageKit, Google Maps). Seule une CSP minimale est posée aujourd'hui.
- [ ] Annonces sans propriétaire : n'importe quel compte connecté peut les modifier, s'y rattacher et y envoyer des fichiers (`canWrite` dans `listings/listings.access.ts`, rattachement dans `patchListingResource`). Réserver ce cas à l'admin, après avoir vérifié qu'aucun parcours légitime n'en dépend.
- [ ] Rendre atomique le rattachement d'un PaymentIntent à une réservation : deux `POST /bookings` simultanés avec le même paiement passeraient la vérification (`verifyReservationPayment`, puis rattachement dans `persistReservation`). Même chose pour deux réservations concurrentes sur les mêmes dates (ancien SEC-011).
- [ ] Limiter le débit de `POST /payments/stripe/payment-intents` et `POST /bookings` avec `lib/rateLimit.ts`, déjà utilisé par l'import et l'IA (ancien SEC-007).
- [ ] Rendre `BOOKING_GUIDE_ACCESS_SECRET` obligatoire quand `NODE_ENV=production` : `config/env.ts` a une valeur par défaut en clair. La prod utilise bien une valeur personnalisée (ancien SEC-006).
- [ ] Nettoyer aussi le HTML côté serveur à l'écriture (description, guide d'arrivée, avis), en plus de `sanitizeHtml()` au rendu.
- [ ] Invalider le cache du rôle admin (5 min, `plugins/auth.ts`) quand un rôle est retiré.
- [ ] Option : signer l'URL de l'export `.ics` public. Elle n'expose plus que « Réservé » / « Indisponible », et la signer casserait les synchronisations déjà configurées chez Airbnb et Booking.

## Fait

- [x] 2026-10-22 — Écran de chargement au rechargement d'une page du tableau de bord (`BootLoader.vue`, `useBootLoader.ts`) : logo et halo de marque, retiré d'un seul geste quand la route, Clerk et l'API sont prêts (silence réseau de 220 ms, plafond 5 s), au lieu d'une page qui se montait par morceaux. Fond clair dès le premier affichage sur mobile (`2fda2d5`, `1fc08a7`).
- [x] 2026-10-22 — Contraste et thème clair inspiré d'Apple (`18e1a21`, `c6a3795`, `2d79183`) :
  - encres lisibles `$bad-ink`, `$good-ink` et `$primary_gradiant_ink_*` à la place du rouge, du menthe et du dégradé pastel sur fond clair ;
  - textes Outfit en 300 au minimum, CTA principaux noirs, halos de marque en fond du héros et de l'appel final ;
  - panneau de connexion et d'inscription Clerk aux couleurs du site, sous-titres en français.
- [x] 2026-10-22 — Règles globales `header` et `footer` supprimées : elles transformaient tout `<header>` ou `<footer>` en barre du site (dialogue « Mon profil », héros des pages principales, boutons Retour / Suivant de l'assistant de création) (`2d79183`, `e30702d`).
- [x] 2026-10-22 — Dialogue « Mon profil » refait, menu de l'avatar qui ne se referme plus au clic ni ne reste ouvert sur le dialogue, aperçu d'une page principale dans l'éditeur rendu comme la page publique (`e30702d`, `2b1aff9`).
- [x] 2026-10-22 — Fuite des données voyageurs corrigée (réservations, guides d'arrivée, URL iCal des OTA, export `.ics`), contrôle de propriété sur les routes d'écriture, vérifié en production (`8caed97`).
- [x] 2026-10-22 — Six pages légales sous `/legal`, pré-rendues en HTML statique, avec lien dans le pied de page (`94d6974`).
- [x] 2026-10-22 — Plus aucun traceur sans consentement :
  - GTM et GA4 retirés ;
  - hCaptcha, Stripe et Google Maps chargés seulement à la demande ;
  - aucun bandeau nécessaire (`94d6974`).
- [x] 2026-10-22 — Allégations de la landing corrigées dans les 6 langues (`94d6974`).
- [x] 2026-10-22 — `robots.txt`, `sitemap.xml`, `llms.txt` ; Cloudflare ouvert aux robots IA et cache purgé (`94d6974`).
- [x] 2026-10-22 — Remboursements contrôlés par l'hôte :
  - « Rembourser le voyageur s'il annule », désactivé par défaut ;
  - « Annuler et rembourser » dans la page Gestion ;
  - `reverse_transfer` sur les remboursements (`94d6974`).
- [x] 2026-10-22 — Abonnements : résiliation et reprise depuis Mon profil ; remboursement uniquement en cas de rétractation dans les 14 jours, par e-mail (`94d6974`).
- [x] 2026-10-22 — Clerk : acceptation des CGV et de la politique de confidentialité à l'inscription (production).
- [x] 2026-10-22 — Sécurité, premier lot : rôle admin plus lu dans `unsafe_metadata`, messagerie verrouillée, messages des erreurs 500 masqués, en-têtes de sécurité nginx (`507d16c`).
- [x] 2026-10-22 — Sécurité, second lot (`229cd07`) :
  - prix recalculé et PaymentIntent vérifié côté serveur, remboursement limité au paiement rattaché ;
  - `PATCH /users/me` sans champs de facturation, gel admin verrouillé, seuls les domaines vérifiés servent une annonce ;
  - scraping non exposé (relais `POST /api/v1/imports/scrape`), SSRF iCal et ImageKit corrigés, DOMPurify sur les `v-html` ;
  - IP réelle derrière Cloudflare, limites de débit sur l'import et l'IA.
- [x] 2026-10-22 — Ancien `SECURITY_AUDIT.md` revu : SEC-001, 004, 005, 008 et 010 sont corrigés par ces lots. Aucun `.env` ni secret n'a jamais été commité, donc aucune rotation de clé n'est nécessaire (SEC-002). SEC-006, 007 et 011 sont reportés dans « Sécurité ».
