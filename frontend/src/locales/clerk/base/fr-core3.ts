// File: src/locales/clerk/base/fr-core3.ts

// Textes ajoutés par Clerk Core 3 (@clerk/vue 2) dans les parcours du site : connexion, inscription,
// mot de passe, revérification depuis « Mon profil », erreurs. La traduction officielle de Clerk ne
// les couvre pas : sans eux, ils s’affichaient en anglais (« Create a password » à l’inscription).
// Fusionné sous fr.ts dans index.ts. Non traduits : double authentification imposée, SSO
// d’entreprise, clés d’accès (passkeys), organisations, facturation, que le site n’utilise pas.

import type { LocalizationResource } from '@clerk/vue/types'

export const clerkFrCore3: LocalizationResource = {
  formFieldAction__hidePassword: 'Masquer le mot de passe',
  formFieldAction__showPassword: 'Afficher le mot de passe',
  // Même texte qu’à la connexion, comme avant Core 3.
  formFieldInputPlaceholder__signUpPassword: 'Mot de passe',
  formFieldInput__emailAddress_format: 'Format attendu : nom@exemple.fr',
  identityPreviewEditButton__emailAddress: 'Modifier l’adresse e-mail',
  identityPreviewEditButton__identifier: 'Modifier l’identifiant',
  identityPreviewEditButton__phoneNumber: 'Modifier le numéro de téléphone',
  searchInput: {
    action__clear: 'Effacer la recherche',
  },
  actionBlocked: {
    title: 'Cette demande n’a pas pu aboutir',
    subtitle: 'Pour votre sécurité, cette demande n’a pas pu être traitée.',
    traceIdLabel: 'Référence',
  },
  signIn: {
    emailLink: {
      verifiedTransferable: {
        title: 'Adresse e-mail vérifiée',
        subtitle: 'Revenez à l’onglet d’origine pour continuer',
      },
    },
    passwordCompromised: {
      title: 'Mot de passe compromis',
    },
    passwordUntrusted: {
      title: 'Mot de passe peu sûr',
    },
    protectCheck: {
      title: 'Vérification de votre demande',
      subtitle: 'Veuillez patienter pendant que nous vérifions votre demande.',
      loading: 'Chargement…',
      retryButton: 'Réessayer',
    },
  },
  signUp: {
    protectCheck: {
      title: 'Vérification de votre demande',
      subtitle: 'Veuillez patienter pendant que nous vérifions votre demande.',
      loading: 'Chargement…',
      retryButton: 'Réessayer',
    },
  },
  taskResetPassword: {
    title: 'Choisissez un nouveau mot de passe',
    subtitle: 'Votre compte demande un nouveau mot de passe avant de continuer.',
    formButtonPrimary: 'Enregistrer le mot de passe',
    signOut: {
      actionLink: 'Se déconnecter',
      actionText: 'Connecté avec {{identifier}}',
    },
  },
  reverification: {
    passwordCompromised: {
      title: 'Mot de passe compromis',
      subtitle__saveNewPassword:
        'Votre mot de passe actuel ne peut plus être utilisé. Confirmez votre identité pour enregistrer le nouveau.',
    },
    passwordPwned: {
      title: 'Mot de passe compromis',
      subtitle__saveNewPassword:
        'Votre mot de passe actuel figure dans une fuite de données. Confirmez votre identité pour enregistrer le nouveau.',
    },
    resetPassword: {
      title: 'Nouveau mot de passe',
      formButtonPrimary: 'Continuer',
    },
    resetPasswordAlternativeMethods: {
      blockButton__resetPassword: 'Réinitialiser votre mot de passe',
      label__alternativeMethods: 'Ou vérifiez autrement',
    },
    resetPasswordCode: {
      formTitle: 'Code de réinitialisation',
      resendButton: 'Code non reçu ? Renvoyer',
      title__saveNewPassword_email: 'Consultez vos e-mails',
      title__saveNewPassword_phone: 'Consultez vos SMS',
      subtitle__saveNewPassword_email:
        'Saisissez le code envoyé à votre adresse e-mail pour enregistrer votre nouveau mot de passe',
      subtitle__saveNewPassword_phone:
        'Saisissez le code envoyé à votre téléphone pour enregistrer votre nouveau mot de passe',
    },
  },
  userButton: {
    label__accountActions: 'Actions du compte',
    label__activeSessions: 'Sessions actives',
    label__userButtonPopover: 'Panneau du compte',
  },
  unstable__errors: {
    action_blocked: 'Cette action n’a pas pu aboutir. Réessayez plus tard, ou contactez-nous si le problème persiste.',
    external_account_not_found: 'Compte introuvable. Créez un compte, ou connectez-vous avec un autre compte.',
    form_new_password_matches_current: 'Le nouveau mot de passe doit être différent de l’actuel.',
    form_password_matches_identifier:
      'Le mot de passe ne peut pas reprendre votre adresse e-mail, votre numéro de téléphone ni votre identifiant. Choisissez-en un autre.',
    form_password_untrusted__sign_in:
      'Votre mot de passe a peut-être été compromis. Pour protéger votre compte, connectez-vous autrement puis changez-le.',
    oauth_access_denied: 'Vous n’avez pas autorisé l’accès à votre compte.',
    protect_check_execution_failed: 'La vérification n’a pas abouti. Réessayez.',
    protect_check_invalid_script: 'La vérification n’a pas pu se charger. Contactez-nous si le problème persiste.',
    protect_check_invalid_sdk_url: 'La vérification n’a pas pu démarrer. Contactez-nous.',
    protect_check_required:
      'Cette connexion demande une vérification supplémentaire qui ne peut pas s’afficher ici. Réessayez dans votre navigateur habituel.',
    protect_check_script_load_failed:
      'La vérification n’a pas pu se charger, peut-être à cause du réseau ou d’un bloqueur. Réessayez.',
    protect_check_timed_out: 'La vérification a pris trop de temps. Réessayez.',
    protect_check_unsupported_environment:
      'La vérification ne fonctionne pas ici. Continuez dans un navigateur classique.',
    signup_rate_limit_exceeded: 'Trop de tentatives. Réessayez dans quelques instants.',
    something_went_wrong: 'Une erreur est survenue. Réessayez.',
  },
}
