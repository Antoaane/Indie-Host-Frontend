# secret.example

Ce dossier centralise tous les templates versionnes (`*.example.txt`) pour Docker.

Fichiers disponibles:
- `database_url.example.txt`
- `stripe_secret_key.example.txt`
- `clerk_secret_key.example.txt`
- `imagekit_api_key.example.txt`
- `cloudflare.ini.example` (wildcard HTTPS + renouvellement auto DNS-01)

Utilisation:
- Copier ces templates vers `secrets/*.txt`.
- Remplacer les placeholders par de vraies valeurs.
- Relancer `docker compose up -d --build --wait`.
