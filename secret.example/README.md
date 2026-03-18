# secret.example

Ce dossier centralise tous les templates versionnes (`*.example.txt`) pour Docker.

Fichiers disponibles:
- `database_url.example.txt`
- `stripe_secret_key.example.txt`
- `clerk_secret_key.example.txt`
- `gandi_api_token.example.txt`
- `imagekit_api_key.example.txt`
- `stripe_webhook_secret.example.txt` (optionnel, hors init Docker)
- `scrapfly_api_key.example.txt` (optionnel, hors init Docker)

Utilisation:
- Copier ces templates vers `secrets/*.txt`.
- Remplacer les placeholders par de vraies valeurs.
- Relancer `docker compose up -d --build --wait`.
