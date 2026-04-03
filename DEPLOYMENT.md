# Deployment Guide

Deze handleiding is voor een Debian of Ubuntu VPS met:

- nginx op poort 80 en 443
- Gunicorn voor de Flask app
- systemd om de app automatisch te starten
- Let's Encrypt voor HTTPS

De app zelf draait intern op `127.0.0.1:5000`.

## Snelle start

Als je gewoon alles automatisch wilt laten instellen, gebruik dan dit:

```bash
bash fix_debian.sh
```

Of, als je wilt dat het script eerst zelf de repo van GitHub ophaalt of bijwerkt:

```bash
bash setup_vps.sh
```

Dat script doet automatisch:

- packages installeren
- repo gebruiken of clonen als die ontbreekt
- Python venv maken
- requirements installeren
- `backend/.env` aanmaken of aanvullen
- Gunicorn systemd service maken
- nginx default site uitschakelen en juiste proxy-config schrijven
- bestaande kapotte nginx symlinks herstellen
- HTTPS automatisch proberen via Let's Encrypt

`setup_vps.sh` werkt nu als bootstrapper: het installeert indien nodig `git`, doet `git clone` of `git pull`, en roept daarna `fix_debian.sh` uit de repo aan.

Als DNS nog niet klaar is, kan HTTPS in die eerste run mislukken. Voer dan later dit uit:

```bash
sudo certbot --nginx -d studiomalem.be -d www.studiomalem.be
```

## 1. DNS instellen

Zet bij je domeinprovider deze A-records naar je VPS IP:

- `studiomalem.be` -> `136.144.201.79`
- `www.studiomalem.be` -> `136.144.201.79`

Verwijder oude records die nog naar een ander IP verwijzen.

## 2. Server packages installeren

```bash
sudo apt update
sudo apt install -y nginx python3-pip python3-venv certbot python3-certbot-nginx git
```

## 3. Repo clonen en Python environment maken

```bash
cd ~
git clone https://github.com/ninjahisser/Website-koen.git
cd Website-koen/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 4. Environment bestand controleren

Controleer of `backend/.env` bestaat en minstens deze waarden bevat:

```dotenv
CMS_PASSWORD=vervang-dit
SECRET_KEY=vervang-dit-met-een-lange-random-string
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
APP_BASE_URL=https://www.studiomalem.be
```

## 5. systemd service instellen

Er staat een voorbeeldbestand in [deploy/systemd/studiomalem.service](deploy/systemd/studiomalem.service).

Pas eerst deze regels aan:

- `User=sethv`
- alle `/home/sethv/...` paden

Vervang `sethv` door je echte Linux gebruikersnaam op de VPS.

Daarna:

```bash
cd ~/Website-koen
sudo cp deploy/systemd/studiomalem.service /etc/systemd/system/studiomalem.service
sudo systemctl daemon-reload
sudo systemctl enable studiomalem
sudo systemctl start studiomalem
sudo systemctl status studiomalem
```

## 6. nginx instellen

Er staat een voorbeeldbestand in [deploy/nginx/studiomalem.be.conf](deploy/nginx/studiomalem.be.conf).

Dat bestand doet dit:

- redirect van `studiomalem.be` naar `www.studiomalem.be`
- reverse proxy van `www.studiomalem.be` naar `127.0.0.1:5000`

Activeer het zo:

```bash
cd ~/Website-koen
sudo cp deploy/nginx/studiomalem.be.conf /etc/nginx/sites-available/studiomalem.be.conf
sudo ln -s /etc/nginx/sites-available/studiomalem.be.conf /etc/nginx/sites-enabled/studiomalem.be.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 7. HTTPS inschakelen

Als DNS goed staat en nginx bereikbaar is op poort 80:

```bash
sudo certbot --nginx -d studiomalem.be -d www.studiomalem.be
```

Daarna zou je site bereikbaar moeten zijn op:

- `https://www.studiomalem.be`

## 8. Updaten na wijzigingen

```bash
cd ~/Website-koen
git pull
cd backend
source .venv/bin/activate
python -m pip install -r requirements.txt
sudo systemctl restart studiomalem
```

## 9. Problemen controleren

Service status:

```bash
sudo systemctl status studiomalem
```

Gunicorn logs:

```bash
journalctl -u studiomalem -n 100 --no-pager
```

nginx test:

```bash
sudo nginx -t
```

nginx logs:

```bash
sudo tail -n 100 /var/log/nginx/error.log
```

## 10. Belangrijk

Je domein gaat niet rechtstreeks naar poort `5000`.

Dat is normaal. Bezoekers gaan naar poort `80` of `443`, en nginx stuurt dat intern door naar de Flask app op `127.0.0.1:5000`.
