<!-- File: src/views/Editor/components/EditorSidebar/panels/PricingPanels/panels.md -->

# Onglet **Tarification** – Spécification MVP

> Objectif : couvrir **80 % des cas réels**, rester **simple**, **contrôlable par l’hôte**, et **cohérent avec la promesse IndieHost (0 % commission, flexibilité, transparence)**.

---

## 1. Prix de base

### 1.1 Prix par nuit

- **Type** : Input numérique incrémentable (`number + / -`)
- **Unité** : € / nuit
- **Contraintes** : min 0, pas de plafond
- **Obligatoire** : Oui

### 1.2 Prix week-end (optionnel)

- **Type** : Toggle ON/OFF
- **Si ON** :

  - Input numérique incrémentable (€ / nuit)

- **Jours concernés** : vendredi / samedi (fixe MVP)

### 1.3 Voyageurs supplémentaires

- **Type** :

  - Input numérique incrémentable (€ / personne / nuit)
  - Input numérique simple (seuil inclus)

- **Exemple** : +15 € / nuit au-delà de 2 voyageurs

---

## 2. Durée de séjour

### 2.1 Séjour minimum

- **Type** : Input numérique incrémentable
- **Unité** : nuits
- **Valeur par défaut** : 1

### 2.2 Séjour maximum (optionnel)

- **Type** : Input numérique incrémentable
- **Unité** : nuits
- **Peut être vide**

### 2.3 Réductions longues durées

#### a) Réduction hebdomadaire

- **Type** : Input numérique incrémentable
- **Unité** : %
- **Appliqué à partir de** : 7 nuits (fixe MVP)

#### b) Réduction mensuelle

- **Type** : Input numérique incrémentable
- **Unité** : %
- **Appliqué à partir de** : 28 nuits (fixe MVP)

---

## 3. Frais additionnels

> Tous les frais sont **libres**, **incrémentables** et **totalement personnalisables** par l’hôte.

### 3.1 Frais de ménage

- **Type** : Input numérique incrémentable
- **Unité** : € / séjour
- **Obligatoire** : Non

### 3.2 Frais de linge (optionnel)

- **Type** : Input numérique incrémentable
- **Unité** : € / séjour

### 3.3 Autres frais personnalisés (MVP simple)

- **Type** :

  - Input textuel simple (libellé)
  - Input numérique incrémentable (€)

- **Exemples** :

  - Frais animaux
  - Frais arrivée tardive

---

## 4. Taxes & obligations légales

### 4.1 Taxe de séjour

- **Type** :

  - Toggle ON/OFF

- **Si ON** :

  - Select :

    - Montant fixe / nuit / personne
    - Montant fixe / nuit

  - Input numérique incrémentable (€)

### 4.2 Affichage

- **Type** : Radio

  - Incluse dans le prix
  - Ajoutée au moment du paiement

---

## 5. Paiement

### 5.1 Moyens de paiement acceptés

- **Type** : Checkbox multiples

  - Carte bancaire (Stripe)
  - Virement / SEPA
  - Espèces

> Note : au moins **1 moyen requis**.

### 5.2 Conditions de paiement

#### a) Mode

- **Type** : Radio

  - Paiement intégral à la réservation
  - Acompte

#### b) Acompte (si activé)

- **Type** : Range slider
- **Unité** : %
- **Plage** : 10 % → 90 %

#### c) Solde

- **Type** : Select

  - À l’arrivée
  - X jours avant l’arrivée (input numérique incrémentable)

---

## 6. Caution / dépôt de garantie

### 6.1 Montant

- **Type** : Input numérique incrémentable
- **Unité** : €

### 6.2 Type de caution

- **Type** : Select

  - Information uniquement
  - Empreinte carte bancaire
  - Espèces
  - Chèque

> MVP : **pas de prélèvement automatique**.

---

## 7. Conditions d’annulation

### 7.1 Politique

- **Type** : Select

  - Flexible
  - Modérée
  - Stricte
  - Personnalisée

### 7.2 Politique personnalisée (si sélectionnée)

- **Type** :

  - Input numérique incrémentable (jours avant arrivée)
  - Input numérique incrémentable (% retenu après délai)

---

## 8. Récapitulatif dynamique (lecture seule)

> Bloc calculé automatiquement, non éditable.

- Prix par nuit
- Total estimé pour X nuits / Y voyageurs
- Frais inclus / exclus
- Message d’information (ex : « réservation directe sans commission »)

---

## Hors MVP (explicitement exclu)

- Pricing dynamique automatique
- Saisonnalité avancée
- Coupons / codes promo
- Yield management / IA
- Cashback ou wallet

---

**Principe directeur MVP** :

> _Tout ce que l’hôte voit, il le comprend. Tout ce qu’il configure, il le maîtrise._
