# HetVoorlaatsteNieuws - Content en Shop

Een Flask-app met een redactionele frontend, een CMS voor artikelen en producten, en een Stripe-gestuurde shop.

## Project Structure

```
├── frontend/
│   ├── index.html               # Nieuws-overzicht
│   ├── article.html             # Detailpagina voor artikels
│   ├── shop.html                # Webshop-pagina
│   ├── cms.html                 # CMS dashboard
│   ├── cms-create.html          # Nieuw artikel
│   ├── cms-edit.html            # Artikel aanpassen
│   ├── cms-product-create.html  # Nieuw product
│   ├── cms-product-edit.html    # Product aanpassen
│   ├── css/
│   │   └── style.css            # Gedeelde styling
│   └── js/
│       ├── app.js
│       ├── article.js
│       ├── cms.js
│       ├── cms-create.js
│       ├── cms-edit.js
│       ├── cms-product-create.js
│       ├── cms-product-edit.js
│       └── shop.js
└── backend/
    ├── server.py                # Flask API en static serving
    ├── requirements.txt         # Python dependencies
    ├── articles/                # JSON artikels
    ├── products/                # JSON shopproducten
    └── cms/
        ├── article_manager.py
        └── product_manager.py
```

## Backend Setup

### Requirements
- Python 3.10+
- Flask
- Flask-CORS
- Stripe Python SDK

### Installation

```bash
cd backend
pip install -r requirements.txt
```

### Running the Server

```bash
python server.py
```

De server draait standaard op `http://localhost:5000`.

## Stripe Configuration

Stripe checkout is optioneel maar de shop ondersteunt het direct zodra deze environment variables zijn gezet:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
APP_BASE_URL=http://localhost:5000
```

Zonder deze keys blijft de shop zichtbaar, maar checkout geeft dan correct aan dat Stripe nog niet geconfigureerd is.

## API Endpoints

### Artikels
- `GET /api/articles`
- `POST /api/articles`
- `GET /api/articles/<article_id>`
- `PUT /api/articles/<article_id>`
- `DELETE /api/articles/<article_id>`
- `POST /api/articles/<article_id>/view`
- `POST /api/articles/<article_id>/click`
- `GET /api/groups`
- `GET /api/stats`

### Shopproducten
- `GET /api/products`
- `GET /api/products?includeInactive=1`
- `POST /api/products`
- `GET /api/products/<product_id>`
- `PUT /api/products/<product_id>`
- `DELETE /api/products/<product_id>`

### Stripe
- `GET /api/stripe/config`
- `POST /api/stripe/create-checkout-session`

### Overig
- `GET /api/site`
- `PUT /api/site`
- `POST /api/upload`

## JSON Formaten

### Artikel

```json
{
  "id": "article_001",
  "title": "Artikel titel",
  "category": "Nieuws",
  "size": "klein",
  "group": "standaard",
  "components": [
    { "type": "text", "content": "Tekstblok" },
    { "type": "image", "src": "/images/example.jpg", "alt": "Omschrijving" }
  ],
  "created_at": "2026-03-21T10:00:00",
  "updated_at": "2026-03-21T10:00:00"
}
```

### Product

```json
{
  "id": "product_001",
  "title": "Editorial Poster Pack",
  "subtitle": "Set van 3 grafische prints",
  "short_description": "Korte omschrijving",
  "description": "Volledige producttekst",
  "category": "Prints",
  "badge": "Bestseller",
  "image": "https://placehold.co/900x1200",
  "cta_label": "Bestel nu",
  "price_cents": 2900,
  "currency": "eur",
  "featured": true,
  "active": true,
  "created_at": "2026-03-21T10:00:00",
  "updated_at": "2026-03-21T10:00:00"
}
```

## Frontend Pages

- `/` toont de artikelen-homepage
- `/article/<id>` toont een artikel
- `/shop` toont de webshop met Stripe checkout
- `/cms` is het dashboard voor artikelen, producten en homepage-instellingen

## Development Notes

- Artikelen en producten worden allebei als JSON opgeslagen; er is geen database nodig.
- Geuploade media worden via `/api/upload` opgeslagen in `backend/images/`.
- De shop gebruikt dezelfde CSS als de rest van de site zodat de vormtaal consistent blijft.
