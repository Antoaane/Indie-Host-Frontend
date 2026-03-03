"""
Scraper Airbnb basé sur gobnb (https://github.com/johnbalvin/pybnb).
Récupère un maximum d'informations sur une annonce et les enregistre en JSON.
"""
import argparse
import json
import re
import sys
import time
import random
from collections import deque
import gobnb

try:
    from curl_cffi import requests as cffi_requests
    from bs4 import BeautifulSoup
    HAS_FALLBACK = True
except ImportError:
    HAS_FALLBACK = False

# Clés possibles pour les données embarquées (Airbnb change parfois le nom)
EMBEDDED_DATA_KEYS = ("niobeClientData", "niobeMinimalClientData", "niobeFullClientData", "bootstrapData")

# File d'attente globale pour séquencer les scrapes
REQUEST_QUEUE = deque()


def add_request(client_id: str, url: str) -> None:
    """Ajoute une demande de scraping à la file d'attente."""
    REQUEST_QUEUE.append((client_id, url))


def process_queue(
    currency: str,
    check_in: str,
    check_out: str,
    proxy_url: str,
    output_template: str,
    min_delay: float,
    max_delay: float,
) -> None:
    """Traite la file d'attente séquentiellement en espaçant les requêtes."""
    while REQUEST_QUEUE:
        client_id, url = REQUEST_QUEUE.popleft()
        print(f"Traitement de {url} pour le client {client_id}...")

        try:
            data = scrape_listing(
                url,
                currency=currency,
                check_in=check_in,
                check_out=check_out,
                proxy_url=proxy_url,
            )
        except Exception as e:  # pragma: no cover - robustesse CLI
            print(f"Erreur lors du scraping de {url} pour {client_id}: {e}", file=sys.stderr)
            continue

        output_path = output_template.format(client_id=client_id)
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except OSError as e:  # pragma: no cover
            print(f"Impossible d'écrire dans {output_path}: {e}", file=sys.stderr)
            continue

        print(f"Données enregistrées dans {output_path}")

        # Délai aléatoire pour "humaniser" le scraping
        delay = random.uniform(min_delay, max_delay)
        print(f"Attente de {delay:.1f} s avant la prochaine annonce...")
        time.sleep(delay)


def _fetch_page_fallback(url: str, proxy_url: str) -> dict:
    """Récupère la page et extrait le JSON embarqué (#data-deferred-state-*) quand gobnb échoue."""
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    proxies = {}
    if proxy_url:
        proxies = {"http": proxy_url, "https": proxy_url}
    resp = cffi_requests.get(url, headers=headers, proxies=proxies, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    out = {"listing_url": url, "source": "fallback_embedded_json"}

    for tag in soup.select("[id^='data-deferred-state-']"):
        raw = tag.get_text(strip=True).replace("\n", " ")
        raw = re.sub(r"\s+", " ", raw)
        if not raw:
            continue
        try:
            data = json.loads(raw)
            for key in EMBEDDED_DATA_KEYS:
                if key not in data or not isinstance(data[key], list) or len(data[key]) == 0:
                    continue
                entry = data[key][0]
                if isinstance(entry, (list, tuple)) and len(entry) > 1:
                    out["embedded_data"] = entry[1]
                else:
                    out["embedded_data"] = entry
                return out
            out["raw_deferred"] = data
            return out
        except json.JSONDecodeError:
            continue
    out["error"] = "Aucun JSON différé trouvé dans la page."
    return out


def scrape_listing(
    url: str,
    currency: str = "EUR",
    check_in: str = "",
    check_out: str = "",
    proxy_url: str = "",
) -> dict:
    """
    Scrape une annonce Airbnb par URL et retourne toutes les données en dict.
    Si check_in/check_out sont fournis, les prix pour ces dates sont inclus.
    En cas d'échec du parsing gobnb (ex. Airbnb a changé la page), tente un fallback.
    """
    url = url.strip()
    if not url.startswith("http"):
        url = f"https://www.airbnb.com/rooms/{url}"

    try:
        data = gobnb.Get_from_room_url(url, currency, check_in, check_out, proxy_url or "")
    except (KeyError, TypeError, IndexError) as e:
        if HAS_FALLBACK:
            print(f"gobnb a échoué ({e}), tentative de récupération du JSON embarqué...", file=sys.stderr)
            data = _fetch_page_fallback(url, proxy_url or "")
        else:
            raise
    else:
        if not isinstance(data, dict):
            data = {"raw": data}
        data["listing_url"] = url
    return data


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper une annonce Airbnb (gobnb) et enregistrer les données en JSON."
    )
    parser.add_argument(
        "url",
        nargs="?",
        help="URL de l'annonce (ex. https://www.airbnb.com/rooms/123456) ou room_id.",
    )
    parser.add_argument(
        "--currency",
        "-c",
        default="EUR",
        help="Code devise (défaut: EUR).",
    )
    parser.add_argument(
        "--check-in",
        default="",
        help="Date check-in (YYYY-MM-DD) pour inclure les prix.",
    )
    parser.add_argument(
        "--check-out",
        default="",
        help="Date check-out (YYYY-MM-DD) pour inclure les prix.",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="annonce.json",
        help="Fichier JSON de sortie (défaut: annonce.json).",
    )
    parser.add_argument(
        "--proxy",
        "-p",
        default="",
        help="URL proxy (optionnel), ex. http://user:pass@host:port.",
    )
    parser.add_argument(
        "--batch-file",
        "-b",
        default="",
        help="Fichier texte contenant une URL (ou un ID) par ligne pour un scraping séquentiel.",
    )
    parser.add_argument(
        "--min-delay",
        type=float,
        default=5.0,
        help="Délai minimum entre deux scrapes (secondes, défaut: 5).",
    )
    parser.add_argument(
        "--max-delay",
        type=float,
        default=15.0,
        help="Délai maximum entre deux scrapes (secondes, défaut: 15).",
    )
    parser.add_argument(
        "--output-template",
        default="annonce_{client_id}.json",
        help="Modèle de nom de fichier pour le mode batch (défaut: annonce_{client_id}.json).",
    )

    args = parser.parse_args()

    # Validation basique des délais
    if args.min_delay < 0 or args.max_delay < 0:
        print("Les délais min/max doivent être positifs.", file=sys.stderr)
        sys.exit(1)
    if args.min_delay > args.max_delay:
        # On échange pour éviter une configuration invalide
        args.min_delay, args.max_delay = args.max_delay, args.min_delay

    # Mode batch : on lit un fichier contenant une URL/ID par ligne
    if args.batch_file:
        try:
            with open(args.batch_file, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
        except OSError as e:
            print(f"Impossible de lire le fichier batch {args.batch_file}: {e}", file=sys.stderr)
            sys.exit(1)

        if not lines:
            print("Le fichier batch ne contient aucune URL/ID.", file=sys.stderr)
            sys.exit(1)

        for idx, line in enumerate(lines, start=1):
            client_id = f"client_{idx}"
            add_request(client_id, line)

        process_queue(
            currency=args.currency,
            check_in=args.check_in,
            check_out=args.check_out,
            proxy_url=args.proxy,
            output_template=args.output_template,
            min_delay=args.min_delay,
            max_delay=args.max_delay,
        )
        return

    # Mode simple : une seule URL, comme avant
    url = args.url

    # Mode interactif : si aucune URL n'est passée en argument, on la demande à l'utilisateur.
    if not url:
        try:
            url = input("Entrez l'URL de l'annonce Airbnb (ou l'ID de l'annonce) : ").strip()
        except KeyboardInterrupt:
            print("\nAnnulé par l'utilisateur.")
            sys.exit(1)
        if not url:
            print("Aucune URL fournie, arrêt.", file=sys.stderr)
            sys.exit(1)

    try:
        data = scrape_listing(
            url,
            currency=args.currency,
            check_in=args.check_in,
            check_out=args.check_out,
            proxy_url=args.proxy,
        )
    except (KeyError, TypeError) as e:
        print(
            f"Erreur de parsing (Airbnb a peut-être changé sa page) : {e}\n"
            "→ Mettre à jour gobnb : pip install -U gobnb\n"
            "→ Voir https://github.com/johnbalvin/pybnb / https://github.com/johnbalvin/pyairbnb",
            file=sys.stderr,
        )
        sys.exit(1)
    except Exception as e:
        print(f"Erreur lors du scraping: {e}", file=sys.stderr)
        sys.exit(1)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Données enregistrées dans {args.output}")


if __name__ == "__main__":
    main()
