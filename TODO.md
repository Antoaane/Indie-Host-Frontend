# TODO IndieHost

Liste unique de ce qui reste à faire. Toute session Claude la lit avant de commencer une tâche et y note ce qui est remis à plus tard (règle dans `CLAUDE.md`, section « Suivi des tâches »).

Le fichier a toujours deux parties :
- **Ce que vous devez faire** : action ou décision de Nathan (information, contrat, compte externe, validation, test en réel).
- **À faire par Claude** : développement ou configuration que Claude peut faire dès que vous dites go. Une tâche qui attend une action de votre part le précise (« après … »).

Une tâche terminée est cochée, puis déplacée dans « Fait » avec sa date et son commit.

## Ce que vous devez faire

### Bloquant : paiements des hôtes

- [ ] Terminer l’inscription Stripe du compte de démonstration (`acct_1UTgHiBxC9MDMaAf`). L’onglet Chrome est ouvert sur l’écran « Démarrer sur Stripe », sinon cliquez sur « Configurer Stripe Connect » depuis la page d’activation. Étapes : identifiant Stripe (e-mail et mot de passe), type d’activité « Particulier », identité, adresse, date de naissance et IBAN. Ce compte n’est pas pré-rempli : Stripe verrouille certains champs après le premier lien d’inscription, créé avant l’ajout du pré-remplissage. Les nouveaux hôtes sont pré-remplis dès la création de leur compte. Claude ne remplit pas ces informations.
- [ ] Décider si la validation par SMS sans mot de passe Stripe (Dashboard Express) vaut une migration. En Accounts v1, Stripe ne l’accepte que si IndieHost encaisse les frais et porte les pertes. Avec Stripe qui garde le risque, il faut l’API Accounts v2 : Stripe → Paramètres → Connect → Configuration de la plateforme → « Demander un accès ». Une fois l’accès accordé, Claude migre (voir « À faire par Claude »).
- [ ] Première vraie réservation : vérifier dans le Dashboard Stripe de l’hôte que le paiement y apparaît (et pas sur le compte IndieHost), puis tester une annulation remboursée.

### Suites du déploiement du 2026-10-23

- [ ] Clerk Dashboard (instance Production) → Webhooks → ajouter `https://indiehost.fr/api/v1/webhooks/clerk`, événement `user.deleted`, secret dans `CLERK_WEBHOOK_SECRET`, redéployer. Sans lui, une suppression faite dans Clerk n'est pas répercutée en base.
- [ ] **Brevo : poser la clé et redéployer.** Le compte, le domaine d’envoi `mail.indiehost.fr` et l’expéditeur sont déjà faits. Ces étapes activent aussi les e-mails aux voyageurs.
  1. Dans Brevo → SMTP & API → Clés API, créer une clé (nom : « IndieHost API »).
  2. La mettre dans `/opt/indiehost/.env` sur le serveur sous la forme `BREVO_API_KEY=…`. Si une ligne `MAIL_FROM` existe, la supprimer ou la passer à `IndieHost <no-reply@mail.indiehost.fr>`. Vérifier aussi que `BASE_URL=https://indiehost.fr` est présent.
  3. Redéployer (la migration `20261023000004` s’applique seule), puis me prévenir.
  4. Avant le premier envoi réel, vous pouvez voir ce qui partira : `docker compose exec api node dist/jobs/hostReminders.cli.js --dry-run`.
- [ ] Parcourir le site avec la console ouverte (connexion Clerk, checkout Stripe, import, carte, upload ImageKit) et relever les violations `Content-Security-Policy-Report-Only` : Claude ajustera puis passera la CSP en mode bloquant.

### Vérifications visuelles (Claude n'a pas de navigateur sur ces écrans)

- [ ] Landing : bouton lecture/pause en coin de chaque vidéo (features, étapes, preuve, aperçu mobile), pied de page en thème sombre, titres d'onglet par page.
- [ ] Éditeur : panneau galerie avec le champ « Description de la photo » (barre latérale à 360 px et 1280 px, case « + »), panneau « Informations légales » (statut particulier/professionnel, SIRET, n° d'enregistrement), panneau domaine personnalisé avec la ligne TXT et les deux contrôles après « Vérifier ».
- [ ] Annonce publique : section « Règlement intérieur », n° d'enregistrement sous le titre, ligne de statut de l'hôte, liens légaux en bas (bureau : bandeau sous la carte ; mobile : fin du défilement au-dessus de la barre de réservation), galerie mobile au clavier.
- [ ] Checkout : champ e-mail obligatoire, bloc règlement intérieur à l'étape 4, phrase « Vous réservez auprès d'un hôte … » à l'étape 5.
- [ ] Guide d'arrivée : formulaire d'avis (après la première nuit), encart « avis déjà déposé », liens légaux en bas. Page de confirmation : liens légaux.
- [ ] Mon profil : bloc « Mes données » (téléchargement de l'export, suppression de compte avec confirmation).
- [ ] Tableau de bord : rechargement de `/dashboard/editor` avec l'onglet Réseau ouvert : environ 15 requêtes au lieu de 34, écran de chargement plus court.
- [ ] Connexion par lien à jeton, après déploiement : ouvrir un compte client via « Impersonate » du Clerk Dashboard (ou un jeton de connexion) et vérifier l’arrivée directe sur le tableau de bord, puis revenir sur la landing par le logo et vérifier qu’elle reste affichée. Testé par Claude en local sur un faux jeton et sur la règle de décision, pas avec une vraie session.
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

- [ ] Dépendances : GitHub (Dependabot) signale 16 vulnérabilités sur la branche par défaut le 2026-10-23 (14 graves, 2 modérées). Les passer en revue (`npm audit` dans `frontend/` et `backend/api/`, `pip-audit` pour le scraping), mettre à jour ce qui peut l’être sans rupture et noter le reste.
- [ ] Passer la CSP de `Content-Security-Policy-Report-Only` à `Content-Security-Policy` dans `nginx/proxy-locations.conf` (après votre relevé des violations en prod).
- [ ] Option : script de reprise `npm run sanitize:backfill` (nettoyage HTML des annonces et messages existants, avec `--dry-run`) ; aujourd'hui seul ce qui est réenregistré est nettoyé.
- [ ] Option : signer l'URL de l'export `.ics` public. Elle n'expose plus que « Réservé » / « Indisponible », et la signer casserait les synchronisations déjà configurées chez Airbnb et Booking.

### Produit et technique

- [ ] (après votre redéploiement avec la clé Brevo) Contrôler dans les journaux de Brevo (Emails transactionnels → Logs) que les premiers e-mails partent et arrivent sans tomber en spam.
- [ ] Option : un interrupteur « Rappels par e-mail » dans Mon profil (`HostProfileDialog.vue`). Aujourd’hui, on se désinscrit par le lien de chaque rappel, et on se réinscrit en écrivant au support (`User.emailRemindersOptOutAt`).
- [ ] (après la première inscription d’un nouvel hôte) Vérifier sur Stripe que son compte a été créé pré-rempli : `business_type: individual`, MCC 7011, description, e-mail et nom. Ce chemin n’a encore jamais tourné en production, car le seul compte connecté date d’avant le pré-remplissage.
- [ ] Image de marque de l’inscription Connect : l’icône IndieHost s’affiche, mais le panneau de gauche garde le violet Stripe par défaut au lieu de `#111117`. Chercher si Connect a des réglages de marque à part (Paramètres → Connect) ; toute modification se fera avec votre accord.
- [ ] (après l’accès Accounts v2 accordé par Stripe) Créer les comptes des hôtes avec l’API Accounts v2 et le Dashboard Express, Stripe gardant le risque. À faire : passer le SDK `stripe` de la version 17.7 à une version qui expose `v2.core.accounts` ; mettre à jour `ensureStripeConnectAccount` et `CONNECT_DASHBOARD_TYPE` (`payments.service.ts`). Le lien de connexion Express et le remplacement des comptes jamais soumis existent déjà. À vérifier d’abord dans la documentation Stripe : Express avec pertes portées par Stripe en v2, pour un compte FR.
- [ ] Page Gestion : afficher à l'hôte les remboursements échoués et les litiges remontés par le webhook Stripe (`Payment.refundStatus`, `disputeStatus`…) : fusionner les lignes `Payment` dans `getListingBookings` (`bookings.service.ts`) et ajouter un badge dans `ManagementReservationSlider.vue` / `ManagementPaymentEditor.vue`.
- [ ] Éditeur : l'aperçu ne reflète le statut de l'hôte (particulier/professionnel) qu'après rechargement, car la section `host` est enregistrée hors file de brouillon (`listingHost.ts`) ; ajouter `host` au flux `DraftPatch` (`useEditorController.ts`, `listingsController.ts`).
- [ ] Guide : les avis déposés avant le 2026-10-23 n'ont pas de `reservationId`, la détection « déjà un avis » ne les voit pas (impossible à rattacher).
- [ ] Option : mot de passe SMTP en secret Docker (`secrets/smtp_password.txt` → `SMTP_PASSWORD_FILE`, déjà lu par `env.ts`) : ajouter l'entrée `secrets:` au service `api` et le modèle dans `init-indiehost.*`.
- [ ] `_ListingGuide.vue` : `rawComments` encore chargé mais plus utilisé pour l'écriture ; nettoyer.
- [ ] Rendre `BookingsService.rebuildListingBookedDaysFromCalendarEvents` cohérent avec les annulations (il compte toutes les lignes `Reservation`, annulées comprises) : incohérence préexistante relevée pendant la passe « réservation atomique ».

### Interface

- [ ] Éditeur, deuxième passe UX (audit du 2026-10-23) : panneaux repliés par défaut avec un résumé sur une ligne (« Localisation · Saint-François », « Photos · 2 photos », « Domaine · www.… · vérifié ») qui se déplient au clic ; menu ⋮ des cartes complété (Voir la page publique, Copier le lien, Dupliquer, Réimporter, Mettre en pause, puis Supprimer en rouge) et « Supprimer l'annonce » retiré du bas du panneau Visibilité.
- [ ] Éditeur, troisième passe UX : aperçu permanent à droite dès qu'une annonce est sélectionnée (la grille devient une barre de sélection compacte), défilement de l'aperçu vers la section en cours d'édition, colonne élargie à 600 px quand l'aperçu est ouvert.
- [ ] Ajuster le style de la case CGV de l'inscription Clerk (`styles/components/_clerk.scss`, classes `cl-formFieldCheckbox*`) (après votre vérification en navigation privée).
- [ ] Deux titres `h2` de la landing (`FaqSection/faq-section.scss`, `HowSection/how-section.scss`) gardent une marge basse de 0,5 rem au-delà de `lg`, héritée du mixin `lp-h2-title` ; la valeur du site (3 gaps / 1 rem) ne s'appliquait que sur mobile. Rendu conservé à l'identique pendant la passe Sass ; décider si la grande marge doit aussi valoir sur bureau (après votre regard).
- [ ] `ListingView/components/Core/components/Title/TitleSk.vue` importe un `title.scss` inexistant ; le composant n'est importé nulle part. Supprimer le fichier ou le corriger.

## Fait

- [x] 2026-10-23 — Brevo configuré par Claude dans la session Chrome de l’utilisateur, à sa demande. Le compte « IndieHost » existait déjà.
  - Domaine d’envoi `mail.indiehost.fr` authentifié : c’est un sous-domaine, car la racine sert à Google Workspace et Brevo demande un domaine qu’aucun autre service d’e-mail n’utilise.
  - Enregistrements ajoutés dans Cloudflare : TXT code Brevo, deux CNAME DKIM (DNS only), DMARC `p=none` sur `_dmarc.mail`.
  - Expéditeur `IndieHost <no-reply@mail.indiehost.fr>` vérifié, avec DKIM et DMARC validés.
  - `MAIL_FROM` par défaut aligné, et `mail`, `clerk`, `accounts`, `clkmail`, `custom` réservés aux sous-domaines d’annonce (commit en cours).
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
