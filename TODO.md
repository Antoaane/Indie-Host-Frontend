# TODO IndieHost

Liste unique de ce qui reste à faire. Toute session Claude la lit avant de commencer une tâche et y note ce qui est remis à plus tard (règle dans `CLAUDE.md`, section « Suivi des tâches »).

Le fichier a toujours deux parties :
- **Ce que vous devez faire** : action ou décision de Nathan (information, contrat, compte externe, validation, test en réel).
- **À faire par Claude** : développement ou configuration que Claude peut faire dès que vous dites go. Une tâche qui attend une action de votre part le précise (« après … »).

Une tâche terminée est cochée, puis déplacée dans « Fait » avec sa date et son commit.

## Ce que vous devez faire

### Éditeur de page et thèmes (docs/editeur-de-page.md)

- [ ] Trancher les décisions encore ouvertes de la section 10 du document (D1 et D10 sont tranchées) : thème par défaut, texte brut pour la présentation, enregistrement immédiat ou brouillon, extension aux annonces simples, couleur d’action modifiable, sens de « le reste » dans la règle du lieu, nom du thème Maison, nombre maximal de sections.
- [ ] Option : créer un compte d’essai Squarespace et rester connecté dans Chrome, pour que Claude relève le détail de leur édition (survol, barre de texte, remplacement d’image).

### Bloquant : paiements des hôtes

- [ ] Compte Stripe de l’hôte de Saint-François (`acct_1UTgHiBxC9MDMaAf`) : rien à faire côté hôte. Vu dans Stripe le 2026-11-10 : inscription terminée, aucune pièce à fournir, Stripe vérifie l’identité du représentant. Depuis le 2026-11-10 l’hôte peut publier sans attendre, **mais Stripe refuse tout paiement en ligne tant que sa vérification n’est pas finie** : un voyageur qui tente de payer d’ici là reçoit « Le paiement en ligne n’est pas encore ouvert pour ce logement ». À surveiller dans Stripe → Connect → Comptes.
- [ ] Rattacher « Appartement les Raisins Clairs » à la page principale « Coeur de Saint François » (éditeur, panneau « Page principale » de l’annonce) : aujourd’hui la page ne présente aucun logement, elle n’a donc aucun lieu pour choisir son thème.
- [ ] Stripe → Développeurs → Webhooks → destination « Comptes connectés » : ajouter l’événement `account.updated` (après que Claude aura écrit son traitement, voir « À faire par Claude »).

### Calendrier iCal

- [ ] (après le redéploiement de `ed7ce08` : le panneau n’avait pas de bouton de suppression avant) Éditeur, « Appartement les Raisins Clairs », Réglages → iCal : supprimer la source « Booking Coeur de saint francois » (ancien lien Booking). Elle exporte le même calendrier que « Booking coeur de SF » et échoue à chaque synchronisation sur un doublon (`Unique constraint failed … externalUid`). Constaté le 2026-11-11 ; les jours Booking sont bien bloqués par la nouvelle source. Essai du 2026-11-11 vers 00 h 25 : « Route DELETE … not found ». Le front en ligne a été reconstruit (bouton présent, `last-modified` 23:24 GMT), mais l’API répond toujours 404 sur cette route et renvoie encore l’erreur Prisma brute : son conteneur n’a pas été reconstruit. Sur le VPS : `cd /opt/indiehost && git log --oneline -1` (doit montrer `ed7ce08` ou plus récent), puis `docker compose up -d --build --wait api` et `docker compose logs --tail 50 api` si ça échoue. L’API compile en local (`tsc --noEmit` sans erreur).
- [ ] Décider si le jour de départ d’une période bloquée peut servir de jour d’arrivée (rotation le même jour, comme sur Airbnb et Booking). Aujourd’hui le calendrier bloque aussi ce jour-là, pour les fermetures Booking comme pour les réservations IndieHost : la fermeture Booking du 13 au 22 novembre (départ le 22) rend le 22 indisponible à l’arrivée, et un séjour ne peut pas finir le 13.

- [ ] Terminer l’inscription Stripe du compte de démonstration (`acct_1UTgHiBxC9MDMaAf`). L’onglet Chrome est ouvert sur l’écran « Démarrer sur Stripe », sinon cliquez sur « Configurer Stripe Connect » depuis la page d’activation. Étapes : identifiant Stripe (e-mail et mot de passe), type d’activité « Particulier », identité, adresse, date de naissance et IBAN. Ce compte n’est pas pré-rempli : Stripe verrouille certains champs après le premier lien d’inscription, créé avant l’ajout du pré-remplissage. Les nouveaux hôtes sont pré-remplis dès la création de leur compte. Claude ne remplit pas ces informations.
- [ ] Déployer `develop` (poussé le 2026-11-10, jusqu’à `7bb9fff` : thèmes sur la page principale et règle Stripe compris). Au 2026-11-10 au soir la production n’était toujours pas redéployée : `curl -sI https://indiehost.fr/ | grep -i last-modified` répondait « 23 Oct 2026 », et la barre de navigation IndieHost s’affichait encore sur `apparts-saintfrancois.fr` pour cette seule raison : `ssh root@45.93.139.219`, puis `cd /opt/indiehost && git pull && docker compose up -d --build --wait`. Le PC Windows n’a pas de clé SSH pour le VPS. Après déploiement, vérifier : rester plus d’une minute sur la page d’activation puis cliquer sur « Configurer Stripe Connect » (plus d’erreur de jeton, le bouton tourne jusqu’à l’ouverture de Stripe) ; iCal de « Appartement les Raisins Clairs » : rester une minute dans l’éditeur, Réglages → iCal (la source « Booking Coeur de saint francois » doit s’afficher), cliquer sur l’actualisation de la source et vérifier le statut « OK » et les jours bloqués (Booking ferme du 13 au 21 novembre 2026 et du 7 décembre 2026 au 9 mai 2028 : ces dates ne seront plus réservables sur IndieHost, à corriger côté Booking si ce n’est pas voulu). Si le lien Booking a changé, supprimer la source et ajouter le nouveau ; `https://apparts-saintfrancois.fr` sans la barre de navigation IndieHost ; le logo ramène à « Mes annonces » quand on est connecté ; `/api/health`.
- [ ] Image de marque de l’inscription Connect (panneau de gauche violet au lieu de `#111117`) : Stripe a bien un réglage à part, Paramètres → Connect → « Interface d’inscription » (`dashboard.stripe.com/settings/connect/onboarding-interface`) → Personnaliser → « Copier l’image de marque de la plateforme ». D’après la documentation Stripe, il ne vaut que pour les comptes créés ensuite. Réglage du Dashboard, à faire par vous.
- [ ] GitHub → Security → Dependabot : fermer les trois alertes `prisma`, `@prisma/config` et `deepmerge-ts` de `backend/api` avec le motif « non exploitable ». La faille est dans le chargeur de configuration de l’outil Prisma, qui ne tourne qu’au build et aux migrations sur nos propres fichiers. La corriger demanderait de passer à Prisma 7 (vraie migration) ou de revenir à la 6.12 (incohérent avec le client 6.19). Claude n’a pas l’outil `gh` sur ce PC pour le faire.
- [ ] Décider si la validation par SMS sans mot de passe Stripe (Dashboard Express) vaut une migration. En Accounts v1, Stripe ne l’accepte que si IndieHost encaisse les frais et porte les pertes. Avec Stripe qui garde le risque, il faut l’API Accounts v2 : Stripe → Paramètres → Connect → Configuration de la plateforme → « Demander un accès ». Une fois l’accès accordé, Claude migre (voir « À faire par Claude »).
- [ ] Première vraie réservation : vérifier dans le Dashboard Stripe de l’hôte que le paiement y apparaît (et pas sur le compte IndieHost), puis tester une annulation remboursée.

### Suites du déploiement du 2026-10-23

- [ ] Clerk Dashboard (instance Production) → Webhooks → ajouter `https://indiehost.fr/api/v1/webhooks/clerk`, événement `user.deleted`, secret dans `CLERK_WEBHOOK_SECRET`, redéployer. Sans lui, une suppression faite dans Clerk n'est pas répercutée en base.
- [ ] Parcourir le site avec la console ouverte (connexion Clerk, checkout Stripe, import, carte, upload ImageKit) et relever les violations `Content-Security-Policy-Report-Only` : Claude ajustera puis passera la CSP en mode bloquant.

### Vérifications visuelles (Claude n'a pas de navigateur sur ces écrans)

- [ ] Landing : bouton lecture/pause en coin de chaque vidéo (features, étapes, preuve, aperçu mobile), pied de page en thème sombre, titres d'onglet par page.
- [ ] Éditeur : panneau galerie avec le champ « Description de la photo » (barre latérale à 360 px et 1280 px, case « + »), panneau « Informations légales » (statut particulier/professionnel, SIRET, n° d'enregistrement), panneau domaine personnalisé avec la ligne TXT et les deux contrôles après « Vérifier ».
- [ ] Annonce publique : section « Règlement intérieur », n° d'enregistrement sous le titre, ligne de statut de l'hôte, liens légaux en bas (bureau : bandeau sous la carte ; mobile : fin du défilement au-dessus de la barre de réservation), galerie mobile au clavier.
- [ ] Checkout : champ e-mail obligatoire, bloc règlement intérieur à l'étape 4, phrase « Vous réservez auprès d'un hôte … » à l'étape 5.
- [ ] Guide d'arrivée : formulaire d'avis (après la première nuit), encart « avis déjà déposé », liens légaux en bas. Page de confirmation : liens légaux.
- [ ] Mon profil : bloc « Mes données » (téléchargement de l'export, suppression de compte avec confirmation).
- [ ] Tableau de bord : rechargement de `/dashboard/editor` avec l'onglet Réseau ouvert : environ 15 requêtes au lieu de 34, écran de chargement plus court.
- [ ] Connexion par lien à jeton, après déploiement : ouvrir un compte client via « Impersonate » du Clerk Dashboard (ou un jeton de connexion) et vérifier l’arrivée directe sur le tableau de bord, puis cliquer sur le logo et vérifier qu’il ramène à « Mes annonces » (depuis le 2026-11-10, le logo n’ouvre plus la landing pour un hôte connecté). Testé par Claude en local sur un faux jeton et sur la règle de décision, pas avec une vraie session.
- [ ] Éditeur (première passe UX) sur une vraie annonce : sommaire groupes + sections, pastilles « à compléter », bandeau d'état après une frappe (« Enregistrement… » puis « Modifications non appliquées · Brouillon enregistré à HH:MM »), Appliquer / Annuler, aide ⓘ du sous-domaine, mobile à 360 px (groupes défilants, bouton retour). Vérifié par Claude sur `/dev/editor` (données en mémoire), pas en prod.

### Légal et argent

- [ ] Donner un numéro de téléphone de contact. La LCEN l'impose dans les mentions légales (`frontend/src/views/Legal/content/mentions-legales.html`, section « Éditeur du site »).
- [ ] Adhérer à un médiateur de la consommation (par exemple CM2C ou Medicys). C'est obligatoire, car la plupart des hôtes sont des particuliers. Claude complètera ensuite les CGV (voir « À faire par Claude »).
- [ ] Faire valider par un avocat :
  - les CGV hôtes, les CGU voyageurs et la page annulation et remboursement ;
  - la **taxe de séjour** : depuis le 2026-10-23, les paiements sont encaissés directement sur le compte Stripe de l’hôte et IndieHost ne détient jamais les fonds ; faire confirmer qu’IndieHost n’est donc pas intermédiaire de paiement au sens de l’art. L2333-34 CGCT ;
  - l’article 10 des CGV (Encaissement des réservations), réécrit pour ce modèle ;
  - la déclaration **DAC7** des revenus des hôtes (art. 1649 ter A CGI).
- [ ] Tester en réel, en mode test Stripe ou avec une petite réservation :
  - annulation par le voyageur avec et sans « Rembourser le voyageur s'il annule » ;
  - « Annuler et rembourser » depuis la page Gestion ;
  - résiliation puis reprise de l'abonnement depuis Mon profil ;
  - réception de l'e-mail de confirmation puis d'annulation (une fois Brevo configuré), côté voyageur et côté hôte.
- [ ] Consigner dans un registre interne des violations l'incident du 2026-10-22 (art. 33.5 RGPD), en quatre points :
  - les réservations et les guides d'arrivée étaient lisibles publiquement ;
  - cause : routes API sans contrôle d'accès ;
  - correctif : commit `8caed97` ;
  - constat : 0 donnée de voyageur exposée (2 annonces en brouillon, 0 réservation).
- [ ] Valider deux précisions à ajouter dans `confidentialite.html` (Claude les rédige dès votre accord) : échanges bruts avec Stripe conservés 90 jours ; messages sans réservation supprimés 1 an après envoi.
- [ ] Brevo, deux points :
  - accepter l’accord de sous-traitance des données (DPA) dans votre compte Brevo, obligatoire au titre de l’article 28 du RGPD ;
  - confirmer sa raison sociale exacte. La politique de confidentialité indique « Brevo (Sendinblue SAS), Union européenne (France) », à vérifier sur votre contrat Brevo.

### RGPD

- [ ] Option : supprimer le conteneur Google Tag Manager `GTM-W7W68HMP` et la propriété GA4 `G-KED539W25B` côté Google. Ils ne sont plus chargés par le site.

### Produit

- [ ] Option : choisir un outil de mesure d'audience sans cookie (Plausible, Umami ou Matomo configuré en mode exempté), si vous voulez des statistiques.
- [ ] Renseigner un pseudo ou un prénom dans « Mon profil » (menu de l'avatar) : sans nom, la page principale n'affiche plus « Proposé par … » et l'annonce affiche « Votre hôte ».
- [ ] Ouvrir https://indiehost.fr/sign-up en navigation privée et regarder la case « J'accepte les CGV… » : elle a été stylée sans pouvoir l'afficher, car la session de Claude est connectée et Claude ne saisit pas de mot de passe en production.
- [ ] Renseigner votre statut (particulier / professionnel) et, si votre commune l'exige, le numéro d'enregistrement de chaque logement dans le nouveau panneau « Informations légales » de l'éditeur.

### Sécurité (audit du 2026-10-22)

- [ ] Vérifier dans le Clerk Dashboard (Production → Users) qu'aucun compte n'a de clé `role` dans son *Unsafe metadata*. Avant `507d16c`, ce champ, modifiable par l'utilisateur lui-même, suffisait pour devenir super admin. Claude n'a pas pu lister les utilisateurs (données personnelles).
- [ ] Faire une vraie réservation de test dès qu'une annonce est publiée. Depuis `229cd07`, le prix est recalculé côté serveur (`payments/reservationPricing.ts`) et la réservation exige un PaymentIntent vérifié ; ce parcours n'a pas pu être testé en prod (aucune annonce publiée).
- [ ] Si vous aviez gelé une annonce en tant qu'admin avant le 2026-10-22, la repasser en « Réservations bloquées » : le gel n'est verrouillé pour le propriétaire que s'il porte le marqueur `core.blockedBy`, posé depuis `229cd07`.
- [ ] Domaines personnalisés déjà rattachés mais non vérifiés avant le 2026-10-23 : le jeton TXT n'est créé qu'au premier clic sur « Vérifier » ; prévenir l'hôte concerné qu'il doit ajouter l'enregistrement TXT affiché.

## À faire par Claude

### Légal et argent

- [ ] Compléter l'article 18 de `cgv.html` avec le nom et les coordonnées du médiateur de la consommation (après votre adhésion).
- [ ] Ajouter dans `confidentialite.html` les durées manquantes (échanges Stripe 90 jours, messages sans réservation 1 an) (après votre validation).
- [ ] Collecte de la taxe de séjour et export DAC7 (après l'avis de l'avocat).

### Sécurité

- [ ] Dépendances restantes après les passes du 2026-11-10. `backend/api/` : seules les trois alertes de `prisma` 6.19 subsistent (outil de build, non exploitable, voir « Ce que vous devez faire ») et une alerte faible sur `esbuild` (serveur de développement sous Windows, non utilisé). `frontend/` : `@nuxt/ui` 4.1 → 4.8 (modéré, à vérifier visuellement), `vue-tsc` 2 → 3 et `npm-run-all2` 8 → 9 (modérés, outils de build), chaîne `@ai-sdk` (faibles : la version corrigée dépend d’un `undici` vulnérable, donc laissée telle quelle). `pip-audit` du scraping pas encore fait.
- [ ] Passer la CSP de `Content-Security-Policy-Report-Only` à `Content-Security-Policy` dans `nginx/proxy-locations.conf` (après votre relevé des violations en prod).
- [ ] Option : script de reprise `npm run sanitize:backfill` (nettoyage HTML des annonces et messages existants, avec `--dry-run`) ; aujourd'hui seul ce qui est réenregistré est nettoyé.
- [ ] Option : signer l'URL de l'export `.ics` public. Elle n'expose plus que « Réservé » / « Indisponible », et la signer casserait les synchronisations déjà configurées chez Airbnb et Booking.

### Produit et technique

- [ ] (après votre décision sur la rotation le même jour) Jours d’arrivée et de départ sur une période bloquée : `makeIsDateDisabled` (`components/DatePicker/utils/range.ts`) compte la date de fin comme occupée. À changer des deux côtés (calendrier, `reservationRules.ts` et `reservationPricing.ts` / disponibilités de l’API, voir la règle de copie de la tarification dans `CLAUDE.md`), puis vérifier les réservations IndieHost et les fermetures iCal.
- [ ] Option : iCal, refuser dès l’ajout une source qui exporte les mêmes événements qu’une source existante. Depuis `ed7ce08`, elle est acceptée puis affichée en erreur avec un message clair (« Ce calendrier est déjà importé… »), et l’hôte peut la supprimer. `calendar.service.ts`, `importCalendar`.
- [ ] Scraping : épingler les versions de `backend/microservices/microservice-scraping-py/requirements.txt` (toutes en `>=`, donc une reconstruction sans cache prend les dernières versions). Le 2026-11-10, Playwright 1.65 a cassé le build de l’image en production (`libatomic.so.1` manquante). `libatomic1` est ajoutée au Dockerfile (`9af9903`) : l’erreur est reproduite puis corrigée dans un conteneur, mais le build complet de l’image n’a pas été mené au bout (arrêté à la demande de Nathan, scraping jugé non prioritaire). En attendant, ne pas reconstruire `scraping` au déploiement (`docker compose build migrate api frontend && docker compose up -d --wait`).

- [ ] Webhook Stripe `account.updated` des comptes connectés : mettre à jour l’état du compte de l’hôte dès que Stripe a fini sa vérification, et lui envoyer un e-mail « vos paiements sont activés ». Aujourd’hui l’état n’est relu qu’à l’ouverture de l’éditeur ou de la page d’activation (`refreshPendingConnectState`, `payments.service.ts`). Fichier : `payments.webhooks.ts`.

- [ ] (après votre accord) Ajouter un SPF et un DMARC à la racine `indiehost.fr` dans Cloudflare. Les e-mails Google Workspace (contact@, dev@) n’ont ni l’un ni l’autre, ce qui les expose au classement en spam. Valeurs : `v=spf1 include:_spf.google.com ~all`, et `v=DMARC1; p=none` sur `_dmarc`. Constaté le 2026-10-23 en préparant Brevo.
- [ ] (après votre redéploiement avec la clé Brevo) Contrôler dans les journaux de Brevo (Emails transactionnels → Logs) que les premiers e-mails partent et arrivent sans tomber en spam.
- [ ] Option : un interrupteur « Rappels par e-mail » dans Mon profil (`HostProfileDialog.vue`). Aujourd’hui, on se désinscrit par le lien de chaque rappel, et on se réinscrit en écrivant au support (`User.emailRemindersOptOutAt`).
- [ ] (après la première inscription d’un nouvel hôte) Vérifier sur Stripe que son compte a été créé pré-rempli : `business_type: individual`, MCC 7011, description, e-mail et nom. Ce chemin n’a encore jamais tourné en production, car le seul compte connecté date d’avant le pré-remplissage.
- [ ] (après l’accès Accounts v2 accordé par Stripe) Créer les comptes des hôtes avec l’API Accounts v2 et le Dashboard Express, Stripe gardant le risque. À faire : passer le SDK `stripe` de la version 17.7 à une version qui expose `v2.core.accounts` ; mettre à jour `ensureStripeConnectAccount` et `CONNECT_DASHBOARD_TYPE` (`payments.service.ts`). Le lien de connexion Express et le remplacement des comptes jamais soumis existent déjà. À vérifier d’abord dans la documentation Stripe : Express avec pertes portées par Stripe en v2, pour un compte FR.
- [ ] Domaines personnalisés : servir aussi la variante `www` / sans `www` du domaine rattaché, avec une redirection 301 vers l’adresse rattachée. Aujourd’hui seule l’adresse exacte a un certificat ; l’autre pointe souvent vers le VPS (chez Hostinger, un CNAME `www` vers la racine existe par défaut) et affiche une alerte de sécurité. À faire : contrôle DNS de la variante, second domaine dans `certbot/custom-domains/domains.txt`, redirection dans nginx ou dans la résolution d’hôte (`listings.service.ts`). Constaté le 2026-11-10 sur `apparts-saintfrancois.fr`.
- [ ] Domaines personnalisés : interroger directement les serveurs DNS du domaine (enregistrements NS) pour la vérification, au lieu du résolveur du VPS. Un hôte qui clique sur « Vérifier » avant d’avoir créé le TXT reste bloqué sur « introuvable » le temps du cache négatif (10 min chez Hostinger), alors que l’enregistrement est déjà publié. `checkCustomDomainOwnership` et le contrôle d’adresse dans `listings.service.ts`. Constaté le 2026-11-10 sur `apparts-saintfrancois.fr`.
- [ ] Page Gestion : afficher à l'hôte les remboursements échoués et les litiges remontés par le webhook Stripe (`Payment.refundStatus`, `disputeStatus`…) : fusionner les lignes `Payment` dans `getListingBookings` (`bookings.service.ts`) et ajouter un badge dans `ManagementReservationSlider.vue` / `ManagementPaymentEditor.vue`. Laissé le 2026-11-10 : fonctionnalité nouvelle (API et deux composants), sans litige ni remboursement échoué en base pour la vérifier ; à faire avec un événement Stripe de test.
- [ ] Éditeur : l'aperçu ne reflète le statut de l'hôte (particulier/professionnel) qu'après rechargement, car la section `host` est enregistrée hors file de brouillon (`listingHost.ts`) ; ajouter `host` au flux `DraftPatch` (`useEditorController.ts`, `listingsController.ts`). Regardé le 2026-11-10 et laissé : le brouillon, la copie « volatile » et l'annulation des modifications partagent cet état, et l'effet d'une écriture de `host` hors file n'a pas pu être garanti sans test sur une vraie annonce.
- [ ] Guide : les avis déposés avant le 2026-10-23 n'ont pas de `reservationId`, la détection « déjà un avis » ne les voit pas (impossible à rattacher).
- [ ] Option : mot de passe SMTP en secret Docker (`secrets/smtp_password.txt` → `SMTP_PASSWORD_FILE`, déjà lu par `env.ts`) : ajouter l'entrée `secrets:` au service `api` et le modèle dans `init-indiehost.*`.

### Interface


- [ ] Éditeur de page, étape 2 bis : laisser l’hôte choisir son thème et écrire les textes propres à sa page (`core.page` : thème, accroche, lieu, sections), avec validation zod et nettoyage côté API, et un réglage dans l’éditeur actuel. Aujourd’hui le thème est uniquement celui d’office selon le lieu. Détail dans `docs/editeur-de-page.md`.
- [ ] (après l’étape 2) Éditeur de page, étape 3 : mode édition depuis le tableau de bord (route d’aperçu, enregistrement, photos par ImageKit), puis étape 4 (annulation, aide au premier passage, essais sur téléphone).

- [ ] Éditeur, deuxième passe UX (audit du 2026-10-23) : panneaux repliés par défaut avec un résumé sur une ligne (« Localisation · Saint-François », « Photos · 2 photos », « Domaine · www.… · vérifié ») qui se déplient au clic ; menu ⋮ des cartes complété (Voir la page publique, Copier le lien, Dupliquer, Réimporter, Mettre en pause, puis Supprimer en rouge) et « Supprimer l'annonce » retiré du bas du panneau Visibilité. Laissé le 2026-11-10 : la première passe n'a pas encore été validée sur une vraie annonce (voir « Vérifications visuelles »), empiler deux refontes dessus serait risqué.
- [ ] Éditeur, troisième passe UX : aperçu permanent à droite dès qu'une annonce est sélectionnée (la grille devient une barre de sélection compacte), défilement de l'aperçu vers la section en cours d'édition, colonne élargie à 600 px quand l'aperçu est ouvert.
- [ ] Ajuster le style de la case CGV de l'inscription Clerk (`styles/components/_clerk.scss`, classes `cl-formFieldCheckbox*`) (après votre vérification en navigation privée).
- [ ] Deux titres `h2` de la landing (`FaqSection/faq-section.scss`, `HowSection/how-section.scss`) gardent une marge basse de 0,5 rem au-delà de `lg`, héritée du mixin `lp-h2-title` ; la valeur du site (3 gaps / 1 rem) ne s'appliquait que sur mobile. Rendu conservé à l'identique pendant la passe Sass ; décider si la grande marge doit aussi valoir sur bureau (après votre regard).

## Fait

- [x] 2026-11-11 — Suppression d’une source iCal depuis l’éditeur (commit `ed7ce08`) : route `DELETE /calendar/listings/:listingId/sources/:syncId` (propriétaire ou admin), qui retire aussi les événements importés par la source et recalcule les jours bloqués ; bouton « Supprimer » avec confirmation ; boutons des sources stylés ; message clair pour une source en double au lieu de l’erreur Prisma. Vérifié : type-checks, et sur la base locale (annonce temporaire) import, doublon, suppression du doublon (jours conservés), suppression de la dernière source (jours libérés, aucun événement restant), source inconnue (404). Rendu du panneau pas vu dans un navigateur (aucune source en local).

- [x] 2026-11-11 — Page d’annonce figée sur « Chargement… » (onglet bloqué) en production, sur `indiehost.fr/<slug>` comme sur un domaine personnalisé (commit `672fbd9`). Au passage bureau ↔ mobile, la ref `listingView` est un instant vide ; `_ListingView.vue` la traduisait en mode mobile par défaut, ce qui relançait le changement de mise en page sans fin. Rendu visible par la mise à jour de Vue 3.5.26 → 3.5.45 du 2026-11-10. Vérifié en local branché sur l’API de production : plus d’erreur, bascule mobile (600 px), tablette (900 px) et bureau correcte ; type-check passé. Pas encore vu en production.

- [x] 2026-11-10 — Synchronisation iCal (Airbnb, Booking) en échec sur toute l’API compilée depuis mars : « nodeIcal.parseICS is not a function ». `import * as` d’un paquet CommonJS depuis un module ES n’expose pas ses fonctions ; `calendar.service.ts` passe par l’export par défaut de `node-ical` (commit `b449d39`). Constaté en production sur la source Booking de « Appartement les Raisins Clairs ». Vérifié : type-check, compilation, lecture du calendrier Booking réel en module ES compilé et sous `tsx` (2 périodes fermées lues). Pas encore rejoué sur l’API déployée. L’erreur « Invalid authentication token. » du même panneau vient de l’ancienne version en ligne (corrigée dans `49b11d6`, reproduite en production le 2026-11-10 : 401 sur la liste des sources après une minute d’inactivité).

- [x] 2026-11-10 — Thèmes branchés sur la page principale publique (commit `7bb9fff`). `_ListingHub.vue` rend la page à thème avec le thème d’office selon le lieu des logements rattachés (mer : Rivage ; terres : Maison ; aucun logement avec adresse : Maison). Corrigé au passage : la page principale était coupée à la hauteur de l’écran sur ordinateur, et une carte de logement seule s’étirait sur toute la largeur. Vérifié en local sur une page principale de test (deux logements à Saint-François) ; pas encore vu en production.
- [x] 2026-11-10 — Stripe : une inscription terminée suffit pour publier, sans attendre la fin de la vérification de Stripe (décision de Nathan, commit `22db49c`). L’état `verifying` compte comme « prêt » pour la publication et déverrouille les annonces ; la page d’activation dit que le paiement en ligne s’ouvrira à la fin de la vérification. Si un voyageur tente de payer avant, l’API répond 409 `HOST_PAYMENTS_NOT_READY` avec un message clair au lieu de l’erreur brute de Stripe.

- [x] 2026-11-10 — Compte Stripe « incomplet » alors que l’hôte a tout fourni (commit `0a2d525`). Stripe vérifiait ses pièces, et le site présentait cette attente comme un compte incomplet en proposant de recommencer l’inscription. Nouvel état `verifying` (`domains/payments/connectStatus.ts`) : la page d’activation dit que Stripe vérifie et qu’il n’y a rien à faire, le bouton devient « Vérifier où en est Stripe », la carte de l’éditeur affiche « Vérification Stripe en cours », les rappels « activez vos paiements » ne partent plus pendant la vérification. L’état est relu chez Stripe à chaque ouverture de l’éditeur ou de la page d’activation tant que le compte n’est pas complet. Détection testée sur 10 états Stripe ; type-checks et build passés ; pas rejoué en production.

- [x] 2026-11-10 — Lieu d’un logement déduit de son adresse (commit `8263555`) : l’API classe chaque logement « mer » (côte à moins de 10 km, seuil fixé par Nathan) ou « terres » à partir de ses coordonnées et du tracé des côtes embarqué (`lib/coastline.ts`, `domains/listings/placeSetting.ts`, paquet `world-atlas`), sans service extérieur, et le renvoie dans `GET /listings/:id/children` (`setting`). `npx tsx scripts/place-setting-smoke.ts` : 32 lieux réels sur 32, dont Saint-François. Route non rejouée sur une vraie page principale (aucune en base locale).

- [x] 2026-11-10 — Éditeur de page à la volée, étape 0 (commit `8263555`) : étude des éditeurs existants, document `docs/editeur-de-page.md`, trois thèmes maquettés puis validés par Nathan (Maison, Rivage en version 2, Nocturne) avec polices auto-hébergées, prototype du mode édition sur faux contenu (`/dev/page-themes`, développement uniquement). Rien n’est branché sur les vraies pages ni sur l’API. Vérifié dans le navigateur à 1440 px et 390 px ; type-check passé.

- [x] 2026-11-10 — Logo IndieHost de la navigation : pour un hôte connecté, il ouvre « Mes annonces » (`/dashboard/editor`) au lieu de la page marketing, sans rechargement de page (`NavShell.vue`). Un visiteur non connecté va toujours à l’accueil ; sur la landing, le logo remonte toujours en haut de page ; l’adresse `/` saisie à la main affiche toujours la landing. Commit `1616fdf`, type-check passé, pas vérifié avec une session connectée.

- [x] 2026-11-10 — Domaine personnalisé d’un client : la barre de navigation IndieHost (Fonctionnalités, Tarifs, « Essayer gratuitement ») s’affichait sur sa page. `Nav.vue` ne masquait la navigation que sur les sous-domaines `*.indiehost.fr` ; il la masque maintenant sur tout hôte d’annonce (`isListingHostname`), comme le pied de page et le routeur le faisaient déjà. Commit `1616fdf`, type-check passé, pas vérifiable en local (un domaine personnalisé ne se simule pas sur localhost).

- [x] 2026-11-10 — Apostrophes manquantes dans 14 textes d’interface (« d abord un plan d abonnement », « Impossible d annuler », « à l arrivée »…) : panneaux domaine et sous-domaine de l’éditeur, checkout, confirmation, guide, messagerie, gestion (commit `1616fdf`, type-check passé). Panneau « Votre propre nom de domaine » : les messages renvoient au tableau « ci-dessus » (il est au-dessus, pas en dessous) et la colonne « Type » ne se coupe plus en deux lignes (pas vérifié à l’écran).

- [x] 2026-11-10 — API : `zod` 3 → 4.6.7 et `nodemailer` 7 → 10.5.0 (commit `4c7b43d`). L’API passe de 6 alertes à 4, il ne reste que celles de `prisma` et une faible sur `esbuild`.
  - `zod` : 12 `z.record(...)` réécrits avec clé et valeur, rien d’autre à changer. Vérifié par un comparatif : 42 447 charges utiles rejouées sur les 46 schémas avant et après ; 42 401 résultats identiques (verdict, données, champs en erreur) et 46 écarts, tous des durcissements (entiers au-delà de 2^53 et « Infinity » désormais refusés). Configuration d’environnement : 19 jeux de variables, mêmes verdicts. Le texte anglais des erreurs de validation change (`issues[].message`), le front ne le lit pas.
  - `nodemailer` : envoi comparé sur un faux serveur SMTP local, enveloppe et message identiques octet pour octet. `@types/nodemailer` retiré (types fournis par le paquet). Au passage, les délais de 20 s n’étaient pas appliqués quand `SMTP_URL` est utilisé (ils étaient passés comme valeurs par défaut des messages) : corrigé dans `lib/mailer.ts`.
  - API locale redémarrée avec ces versions : santé, routes publiques, 401 sans jeton, 400 avec la liste des champs en erreur.

- [x] 2026-11-10 — Passe « dépendances et nettoyages » (commits `4c7b43d` pour les dépendances, `84a71fa` pour les réservations annulées, `1616fdf` pour les nettoyages).
  - Dépendances, mises à jour sans rupture : `frontend/` passe de 24 alertes (1 critique, 13 graves) à 9 (aucune grave) avec `vue` 3.5.45, `vite` 6.4.6, `axios` 1.21.1, `svgo`, `postcss`, `nanoid`, `shell-quote` ; `backend/api/` passe de 10 à 6 avec `fastify` 5.12.8, `find-my-way`, `fast-uri`, `qs`. `npm audit fix` tel quel a été écarté : il rétrogradait `prisma` et ajoutait un `undici` vulnérable au front. Vérifié : build complet du front, `/` et `/dev/editor` sans erreur console, API locale redémarrée avec le nouveau `fastify` (santé, route publique, 401 sans jeton).
  - Réservations annulées : `rebuildListingBookedDaysFromCalendarEvents` (`calendar.service.ts`) ne recompte plus une réservation annulée, qui redevenait indisponible à la synchronisation iCal suivante. Type-check passé, pas rejoué sur une vraie annulation.
  - Nettoyages : `TitleSk.vue` supprimé (importé nulle part, feuille de style inexistante) ; le guide d’arrivée ne charge plus les avis de l’annonce, qu’il n’utilisait plus.
- [x] 2026-11-10 — MCP Brevo : les outils sont chargés dans la session Claude, VS Code a donc bien été relancé.

- [x] 2026-11-10 — Page d’activation : le bouton « Configurer Stripe Connect » affiche un indicateur tournant et « Ouverture de Stripe… », et reste en chargement jusqu’à l’arrivée sur Stripe (avant, il reprenait son aspect normal pendant la navigation). Même indicateur pour l’activation d’un plan et la publication. `PricingChecklistCallbackView.vue`, commit `1616fdf`. Type-check passé, pas vérifié dans un navigateur.

- [x] 2026-11-10 — Erreur « Invalid authentication token. » au clic sur « Configurer Stripe Connect ». Le jeton Clerk vit 60 secondes et plusieurs clients API renvoyaient celui gardé en mémoire sans regarder son expiration. Nouveau `frontend/src/utils/authToken.ts` (`getFreshAuthToken`, commit `49b11d6`), utilisé par `stripeSubscriptions`, `stripePayments`, `bookings`, `listingCalendar`, `listingHubs`, `listingHost`, `privacy` et `aiDescription`. Un 401 sur les appels d’abonnement affiche « Votre session a expiré. Rechargez la page, puis réessayez. ». Type-check passé, parcours non rejoué dans un navigateur.

- [x] 2026-10-23 — E-mails Brevo en production : clé posée et redéploiement fait par l’utilisateur.
  - Vérifié par Claude : la désinscription répond, la politique de confidentialité mentionne Brevo, l’API est en bonne santé, et le jeton MCP est accepté par Brevo.
  - Aucun e-mail n’était encore parti à 15 h 45 : aucun événement déclencheur depuis le déploiement.
- [x] 2026-10-23 — Brevo configuré par Claude dans la session Chrome de l’utilisateur, à sa demande. Le compte « IndieHost » existait déjà.
  - Domaine d’envoi `mail.indiehost.fr` authentifié : c’est un sous-domaine, car la racine sert à Google Workspace et Brevo demande un domaine qu’aucun autre service d’e-mail n’utilise.
  - Enregistrements ajoutés dans Cloudflare : TXT code Brevo, deux CNAME DKIM (DNS only), DMARC `p=none` sur `_dmarc.mail`.
  - Expéditeur `IndieHost <no-reply@mail.indiehost.fr>` vérifié, avec DKIM et DMARC validés.
  - `MAIL_FROM` par défaut aligné, et `mail`, `clerk`, `accounts`, `clkmail`, `custom` réservés aux sous-domaines d’annonce (commit `b6b8b97`, non déployé).
- [x] 2026-10-23 — E-mails automatiques aux hôtes via Brevo, sans effet tant que la clé n’est pas posée (commit `3b7cb5b`, non déployé).
  - Sur événement : nouvelle réservation, annulation, message d’un voyageur, avis, annonce en ligne, dernier logement de l’offre utilisé, litige, remboursement échoué.
  - Rappels planifiés : arrivée demain, bienvenue, brouillon inactif, paiements à activer, fin d’essai ou d’accès offert, calendrier iCal en erreur.
  - Anti-doublon, désinscription des rappels, politique de confidentialité mise à jour.
  - Testé sur la base locale, envoi vers Brevo simulé : une deuxième passe n’envoie rien de plus, un deuxième message en moins de 30 minutes ne déclenche pas d’e-mail, la désinscription en un clic fonctionne.
- [x] 2026-10-23 — Redéploiement de `053e039` vérifié par Claude sur indiehost.fr. Le nouveau texte de la page d’activation s’affiche et les boutons radio sont corrects. « Configurer Stripe Connect » (Particulier) ouvre l’inscription Stripe sur le compte `acct_1UTgHiBxC9MDMaAf`, rattaché à nouveau sans doublon : c’est le seul compte connecté.
- [x] 2026-10-23 — Retour au Dashboard complet pour les comptes des hôtes (commit `053e039`, non déployé). Le Dashboard Express (commit `23b6815`, déployé) est refusé par Stripe en production. Le remplacement de compte est aussi corrigé : l’ancien compte n’est détaché qu’après la création du nouveau, et un compte détaché par erreur est rattaché à nouveau. Le texte de la page d’activation est mis à jour.
- [x] 2026-10-23 — Image de marque Stripe appliquée avec l’accord de l’utilisateur : icône IndieHost 512 px, couleurs `#111117` (Paramètres → Adaptation à votre marque, commune à tout le compte : Checkout, reçus, inscription Connect).
- [x] 2026-10-23 — Inscription Stripe des hôtes allégée et ouverte aux particuliers : choix « particulier / professionnel » avant l’ouverture de Stripe ; pour un particulier, compte déclaré personne physique (pas de SIRET, de société ni de représentant légal), catégorie hébergement, description et site de l’annonce pré-remplis ; formulaire limité au nécessaire immédiat (`currently_due`). Non déployé (commit `a46070c`).
- [x] 2026-10-23 — Déploiement en production (par l’utilisateur, commits jusqu’à `e6e4b0a`, sauvegarde de la base faite avant) vérifié par Claude : site, API, pré-rendu de `/` et `/pricing`, CGV à jour, CSP en mode rapport, redirection `www`, type MIME du manifeste, webhook Stripe qui répond « signature manquante » (secrets pris en compte). Webhook Clerk encore à 503 (secret à créer).
- [x] 2026-10-23 — Stripe Connect débloqué : il restait l’étape « Confirmer vos choix d’intégration » du guide de démarrage Stripe (modèle logiciel, acceptation du Contrat d’utilisation de la plateforme Connect, validée par Claude avec l’accord explicite de l’utilisateur). « Configurer Stripe Connect » ouvre maintenant l’inscription Stripe ; premier compte connecté `acct_1UTgHiBxC9MDMaAf` créé avec `fees.payer: account`, `losses.payments: stripe`, Dashboard complet.
- [x] 2026-10-23 — Stripe live : deux destinations de webhook créées vers `https://indiehost.fr/api/v1/payments/stripe/webhook` (11 événements, charge utile instantanée, API `2025-08-27.basil`, la version du compte) : `indiehost-api-plateforme` sur « Votre compte » et `indiehost-api-comptes-hotes` sur « Comptes connectés ». Secrets non lus par Claude.
- [x] 2026-10-23 — Stripe Connect aligné sur le profil plateforme validé (modèle « logiciel ») : comptes des hôtes créés avec les propriétés de contrôleur équivalentes à Standard (l’hôte paie ses frais, Stripe porte le risque, Dashboard Stripe complet), paiements des réservations créés sur le compte de l’hôte, vérification, annulation et remboursement sur ce compte, Stripe.js chargé avec le compte de l’hôte au checkout, webhook à deux secrets, lien du tableau de bord vers dashboard.stripe.com, article 10 des CGV réécrit. Décision « qui paie les frais Stripe » réglée : l’hôte, comme l’annonce la FAQ. Aucun compte connecté n’existait en live, donc rien à migrer. Paramètres validés contre la documentation Stripe ; pas de test réel en local (clé de test factice) (commit `e1d28ba`).
- [x] 2026-10-23 — « Configurer Stripe Connect » ne faisait rien au clic : l’API répondait 400 (profil plateforme Stripe non validé, voir « Bloquant ») et la page de checklist (`PricingChecklistCallbackView.vue`) n’affichait ses messages d’erreur et d’information que dans la console de dev. Messages désormais affichés sous « Prochaine étape » (encart d’erreur `role="alert"`) ; pour ce cas, l’hôte lit un message qui le concerne et l’admin garde la consigne technique ; le client API garde le code d’erreur (`StripeApiError`). Non déployé (commit `4c9b0c8`).
- [x] 2026-10-23 — Connexion par lien à jeton (Impersonate, jeton de connexion, invitation acceptée chez Clerk) : arrivée sur le tableau de bord au lieu de la landing ; un ticket posé sur `/` part vers la page de connexion qui le consomme (commit `398908d`).
- [x] 2026-10-23 — Pile Docker locale vérifiée : les 7 migrations Prisma (dont les 4 du jour) s’appliquent sur une base vierge, aucune différence avec `schema.prisma` (`prisma migrate diff`, `migration_lock.toml` ajouté), API saine ; test de fumée conforme (webhooks Stripe et Clerk en 503 sans secret, export et suppression de compte en 401 sans jeton, 21e PaymentIntent en 429, purge RGPD planifiée) (commit `398908d`).
- [x] 2026-10-23 — Éditeur, première passe UX (commit `7d21892`) : sommaire à deux niveaux (cinq groupes, puces de sections ancrées, section active suivie au défilement, pastilles « à compléter »), panneaux réordonnés (essentiel d'abord, technique ensuite, import et légal dans Réglages), bandeau d'état permanent avec Appliquer / Annuler toujours visibles et heure du dernier enregistrement, aide repliée derrière ⓘ (sous-domaine ; guide du domaine plus ouvert d'office), onglets accessibles (`role="tab"`, `aria-selected`, flèches), route de dev `/dev/editor` sans backend pour vérifier dans le navigateur. Vérifié à 1316 px et 360 px sur données en mémoire.
- [x] 2026-10-23 — Favicon vérifié : les cinq fichiers déclarés dans `index.html` (ICO, SVG, PNG 96 px, Apple touch, manifeste) sont servis en prod. `public/favicon.ico` (repli `/favicon.ico`, 32 px, image différente) aligné sur l'icône complète 16/32/48 px ; `favicon-og.ico` et `favicon.zip` (non référencés, 210 Ko) retirés ; `site.webmanifest` servi en `application/manifest+json` au lieu d'`octet-stream` (`frontend/nginx.conf`, effectif au prochain build de l'image).
- [x] 2026-10-23 — Passe sur la liste (commit `171ef05`) :
  - **Légal** : e-mail de confirmation et d'annulation au voyageur (`lib/mailer.ts`, `domains/notifications/`, champ e-mail obligatoire au checkout) ; statut de l'hôte particulier/professionnel avec raison sociale et SIRET, affiché sur l'annonce et au checkout ; numéro d'enregistrement du meublé de tourisme dans l'éditeur et sur l'annonce ; règlement intérieur affiché et accepté avant le paiement, et sur l'annonce ; liens légaux compacts sur l'annonce, la page principale, le guide et la confirmation.
  - **RGPD** : export (`GET /users/me/export`) et suppression de compte (`DELETE /users/me`, anonymisation, refus si abonnement ou séjour en cours) depuis Mon profil ; webhook Clerk `user.deleted` ; purge quotidienne (réservations 5 ans, messages 1 an, `Payment.raw*` 90 j, `rawIcs` 7 j, comptes inactifs 3 ans) ; nombre de voyageurs PMR retiré des métadonnées Stripe ; jetons et clés de guide masqués dans les logs, rotation des journaux Docker.
  - **Accessibilité, SEO, agents IA** : description des photos (éditeur, assistant, import, repli « <titre> — photo N ») ; noms accessibles de la galerie et des vidéos, bouton pause sur les vidéos de la landing ; notes d'avis en texte ; alt distincts de la landing dans les 7 langues ; `<title>` par route et `lang="fr"` restauré ; pré-rendu statique de `/` et `/pricing` ; liens légaux sur les pages d'annonce.
  - **Produit** : avis voyageur depuis le guide réparé (route protégée par la clé de guide) ; barèmes d'annulation regroupés en un module miroir par côté ; webhooks Stripe (remboursements échoués, litiges, statut des paiements).
  - **Interface** : appels API du tableau de bord dédoublonnés (34 → ~15, `requestCache.ts`) ; hash CSP du script `is-booting` ; nom public de l'hôte sans e-mail, « Hôte » au lieu de « Host », repli « Votre hôte » ; pied de page sombre sur la landing.
  - **Sécurité** : TXT de propriété pour les domaines personnalisés ; CSP complète en mode rapport ; annonces sans propriétaire réservées à l'admin ; réservation atomique (verrou par annonce, `Payment.reservationId` unique, remboursement automatique du perdant) ; limites de débit sur les PaymentIntents et les réservations ; `BOOKING_GUIDE_ACCESS_SECRET` obligatoire en prod ; HTML nettoyé côté serveur à l'écriture ; cache du rôle admin réduit à 60 s.
  - **Build** : plus aucun avertissement Sass (`mixed-decls` × 184 et `slash-div` × 2) : déclarations remises avant les règles imbriquées dans les mixins et les appels, surcharges volontaires isolées dans un bloc `& { }` commenté.
  - **Cloudflare** : règle de redirection `www.indiehost.fr` → `indiehost.fr` (301, chemin et paramètres conservés, phase `http_request_dynamic_redirect`), vérifiée en ligne le 2026-10-23.
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
