# IndieHost

Solution SaaS pour hôtes de locations courte durée: réservations directes, paiements intégrés, messagerie et domaines.

## Docker-Only (mode standard)

Le projet se lance uniquement via Docker Compose.

### 1) Préparer la configuration

Copier l'environnement racine:

```bash
cp .env.example .env
```

Copier les secrets runtime:

```bash
cp secret.example/database_url.example.txt secrets/database_url.txt
cp secret.example/stripe_secret_key.example.txt secrets/stripe_secret_key.txt
cp secret.example/clerk_secret_key.example.txt secrets/clerk_secret_key.txt
cp secret.example/gandi_api_token.example.txt secrets/gandi_api_token.txt
```

### 2) Lancer la stack

```bash
docker compose up -d --build
```

### 3) Vérifier

- Frontend: `http://localhost`
- API health: `http://localhost/api/v1/health`
- PostgreSQL: service interne Docker `postgres:5432`

## Arborescence utile

```text
.
├── docker-compose.yml
├── .env.example
├── secret.example/   # templates versionnés
├── secrets/          # secrets locaux runtime (non versionnés)
├── frontend/
├── backend/api/
└── nginx/
```

## Notes

- Les variables frontend `VITE_*` sont injectées au build Docker via `docker-compose.yml`.
- Les secrets backend passent par des fichiers (`*_FILE`) montés depuis `secrets/*.txt`.
- Les scripts `start-indiehost.sh` et `start-indiehost.ps1` restent disponibles comme wrappers Docker.
