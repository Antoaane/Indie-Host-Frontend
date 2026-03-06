import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Le champ email est ajouté par défaut
    // Ajoutez d'autres champs si nécessaire
  ],
}

