from datetime import datetime, timedelta
import json
import os
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session, redirect, url_for
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from cms.article_manager import ArticleManager
from cms.product_manager import ProductManager
from cms.order_manager import OrderManager

try:
    import stripe
except ImportError:
    stripe = None


def create_default_env_file(env_path):
    """Create a default .env file if it doesn't exist."""
    default_content = """# CMS Configuration
CMS_PASSWORD=admin123

# Secret key for sessions (change this in production!)
SECRET_KEY=your-super-secret-key-change-this-in-production

# Stripe Configuration (optional)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
APP_BASE_URL=http://localhost:5000
"""
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(default_content)
    print(f"DEBUG: Nieuwe .env file aangemaakt op {env_path}")


def load_env_file(env_path):
    print(f"DEBUG: Probeer .env te laden van: {env_path}")
    if not os.path.exists(env_path):
        print(f"DEBUG: .env niet gevonden op {env_path}")
        create_default_env_file(env_path)
    
    with open(env_path, 'r', encoding='utf-8') as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    print(f"DEBUG: .env geladen uit {env_path}")



print(f"DEBUG: Huidige werkdirectory: {os.getcwd()}")
BASE_DIR = os.path.dirname(__file__)
print(f"DEBUG: BASE_DIR = {BASE_DIR}")
env_path = os.path.join(BASE_DIR, '.env')
print(f"DEBUG: Verwachte .env pad: {env_path}")
load_env_file(env_path)
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend'))
ARTICLES_DIR = os.path.join(BASE_DIR, 'articles')
PRODUCTS_DIR = os.path.join(BASE_DIR, 'products')
VIEWS_FILE = os.path.join(BASE_DIR, 'views.json')
SETTINGS_FILE = os.path.join(BASE_DIR, 'site_settings.json')
# BELANGRIJK: .env MOET EERST GELADEN WORDEN!

STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '').strip()
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY', '').strip()
APP_BASE_URL = os.getenv('APP_BASE_URL', '').strip()


# Debug: print of Stripe keys geladen zijn
print(f"DEBUG: STRIPE_SECRET_KEY uit os.environ: {os.environ.get('STRIPE_SECRET_KEY')}")
print(f"DEBUG: STRIPE_PUBLISHABLE_KEY uit os.environ: {os.environ.get('STRIPE_PUBLISHABLE_KEY')}")
if not STRIPE_SECRET_KEY:
    print('WAARSCHUWING: STRIPE_SECRET_KEY NIET GEZET!')
else:
    print('Stripe secret key geladen:', STRIPE_SECRET_KEY[:8] + '...')
if not STRIPE_PUBLISHABLE_KEY:
    print('WAARSCHUWING: STRIPE_PUBLISHABLE_KEY NIET GEZET!')
else:
    print('Stripe publishable key geladen:', STRIPE_PUBLISHABLE_KEY[:8] + '...')

print('DEBUG: type(stripe) =', type(stripe))
print('DEBUG: stripe module:', stripe)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
CORS(app)

# Session-configuratie
app.secret_key = os.getenv('SECRET_KEY', 'change_this_in_production_12345')
app.config['SESSION_COOKIE_SECURE'] = False  # Set True for HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# CMS-wachtwoord (stel in via .env variabele CMS_PASSWORD)
CMS_PASSWORD = os.getenv('CMS_PASSWORD', 'admin123')
print(f'DEBUG: CMS_PASSWORD geladen: {CMS_PASSWORD[:5]}...' if CMS_PASSWORD else 'DEBUG: CMS_PASSWORD is LEEG!')

article_manager = ArticleManager(ARTICLES_DIR)
product_manager = ProductManager(PRODUCTS_DIR)
order_manager = OrderManager(os.path.join(BASE_DIR, 'orders'))

if stripe and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def parse_json_body():
    return request.get_json(silent=True) or {}


def require_cms_auth(f):
    """Decorator to require CMS authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'cms_authenticated' not in session or not session['cms_authenticated']:
            return redirect('/cms-login')
        return f(*args, **kwargs)
    return decorated_function


def load_views():
    if os.path.exists(VIEWS_FILE):
        with open(VIEWS_FILE, 'r', encoding='utf-8') as file:
            return json.load(file)
    return {}


def save_views(views):
    with open(VIEWS_FILE, 'w', encoding='utf-8') as file:
        json.dump(views, file, ensure_ascii=False, indent=2)


def load_site_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as file:
            data = json.load(file)
    else:
        data = {
        'newsletterTitle': 'GEEN WERK MEER MISSEN?',
        'newsletterText': 'MELD JE AAN OF DE NIEUWSBRIEF',
        'newsletterButtonText': 'JA IK WIL DE NIEUWSBRIEF',
        'newsletterButtonLink': '#',
        'workshopTitle': 'ONTDEK ONZE WORKSHOP SPEEDANIMATIE',
        'workshopText': 'Ik neem de allergrootste jaren workshops in SMAAK, designmuseum, scholen en veel meer!',
        'workshopButtonText': 'IK WIL MEER WETEN',
        'workshopButtonLink': '#'
    }
    data.setdefault('customGroups', [])
    data.setdefault('customCategories', [])
    data.setdefault('highlightedGroups', ['het klein nieuws', 'de miniatuurwereld'])
    return data


def save_site_settings(settings):
    with open(SETTINGS_FILE, 'w', encoding='utf-8') as file:
        json.dump(settings, file, ensure_ascii=False, indent=2)


def get_public_base_url():
    if APP_BASE_URL:
        return APP_BASE_URL.rstrip('/')
    return request.host_url.rstrip('/')


def stripe_is_ready():
    return bool(stripe and STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY)


def product_to_checkout_line_item(product, quantity):
    image = product.get('image') or ''
    image_url = image
    if image.startswith('/'):
        image_url = f"{get_public_base_url()}{image}"

    product_data = {
        'name': product.get('title') or 'Product',
        'description': product.get('short_description') or product.get('subtitle') or '',
    }
    if image_url.startswith('http'):
        product_data['images'] = [image_url]

    return {
        'quantity': quantity,
        'price_data': {
            'currency': product.get('currency', 'eur'),
            'unit_amount': int(product.get('price_cents', 0)),
            'product_data': product_data,
        },
        'metadata': {
            'product_id': product.get('id', '')
        }
    }


def save_order_from_stripe_session(session_id):
    existing_order = order_manager.get_order(session_id)
    if existing_order:
        return existing_order, False

    full_session = stripe.checkout.Session.retrieve(session_id, expand=['line_items', 'customer', 'payment_intent'])

    order_items = []
    total_cents = 0
    for line_item in full_session['line_items']['data']:
        item = {
            'product_id': line_item.get('metadata', {}).get('product_id', 'unknown'),
            'product_title': line_item.get('description') or 'Product',
            'price_cents': line_item['price']['unit_amount'],
            'quantity': line_item['quantity'],
            'subtotal_cents': line_item['amount_total']
        }
        order_items.append(item)
        total_cents += item['subtotal_cents']

    # Verzamel zoveel mogelijk relevante Stripe session info
    customer_email = (
        full_session.get('customer_email')
        or (full_session.get('customer_details') or {}).get('email')
        or (full_session.get('customer') or {}).get('email')
        or 'onbekend@email.com'
    )
    customer_name = None
    if full_session.get('customer') and isinstance(full_session['customer'], dict):
        customer_name = full_session['customer'].get('name')
    elif full_session.get('customer_details'):
        customer_name = full_session['customer_details'].get('name')

    shipping_address = None
    if full_session.get('shipping'):
        shipping = full_session['shipping']
        shipping_address = {
            'name': shipping.get('name'),
            'address': shipping.get('address', {}),
            'phone': shipping.get('phone')
        }
    elif full_session.get('customer_details') and full_session['customer_details'].get('address'):
        shipping_address = {
            'name': full_session['customer_details'].get('name'),
            'address': full_session['customer_details'].get('address'),
            'phone': full_session['customer_details'].get('phone')
        }

    payment_intent = full_session.get('payment_intent')
    payment_status = full_session.get('payment_status')
    currency = full_session.get('currency', 'eur')
    amount_total = full_session.get('amount_total')
    amount_subtotal = full_session.get('amount_subtotal')

    # Metadata uitbreiden
    metadata = {
        'payment_status': payment_status,
        'payment_intent': payment_intent,
        'currency': currency,
        'amount_total': amount_total,
        'amount_subtotal': amount_subtotal,
        'customer_name': customer_name,
    }

    order = order_manager.create_order(
        stripe_session_id=full_session.get('id'),
        stripe_customer_email=customer_email,
        items=order_items,
        total_cents=sum([item.get('price_cents', 0) * item.get('quantity', 1) for item in order_items]),
        status='pending',
        metadata=metadata,
        shipping_address=shipping_address
    )
    return order, True


@app.route('/api/articles', methods=['GET'])
def get_articles():
    articles = article_manager.get_all_articles()
    views = load_views()
    for article in articles:
        article_id = article['id']
        article['views'] = views.get(article_id, {}).get('views', 0)
        article['clicks'] = views.get(article_id, {}).get('clicks', 0)
    return jsonify(articles)


@app.route('/api/articles', methods=['POST'])
def create_article():
    data = parse_json_body()
    article = article_manager.create_article(
        title=data.get('title'),
        category=data.get('category'),
        group=data.get('group'),
        components=data.get('components', []),
        size=data.get('size', 'klein'),
        thumbnail=data.get('thumbnail')
    )
    return jsonify(article), 201


@app.route('/api/articles/<article_id>', methods=['GET'])
def get_article(article_id):
    filepath = os.path.join(ARTICLES_DIR, f'{article_id}.json')
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as file:
                return jsonify(json.load(file))
        except Exception as error:
            return jsonify({'error': str(error)}), 500
    return jsonify({'error': 'Article not found'}), 404


@app.route('/api/articles/<article_id>', methods=['PUT'])
def update_article(article_id):
    data = parse_json_body()
    article = article_manager.update_article(article_id, **data)
    return jsonify(article)


@app.route('/api/articles/<article_id>', methods=['DELETE'])
def delete_article(article_id):
    ok = article_manager.delete_article(article_id)
    return jsonify({'success': ok})


@app.route('/api/articles/reorder', methods=['POST'])
def reorder_articles():
    data = parse_json_body()
    article_ids = data.get('article_ids', [])
    group_name = data.get('group')

    if not isinstance(article_ids, list) or len(article_ids) == 0:
        return jsonify({'error': 'article_ids moet een niet-lege lijst zijn.'}), 400

    changed = article_manager.reorder_articles(article_ids, group_name=group_name)
    return jsonify({'success': True, 'updated': changed})


@app.route('/api/articles/reorder/reset', methods=['POST'])
def reset_article_order():
    changed = article_manager.reset_article_order()
    return jsonify({'success': True, 'updated': changed})


@app.route('/api/articles/<article_id>/reorder/reset', methods=['POST'])
def reset_single_article_order(article_id):
    changed = article_manager.reset_single_article_order(article_id)
    if changed is None:
        return jsonify({'error': 'Artikel niet gevonden.'}), 404
    return jsonify({'success': True, 'updated': changed})


@app.route('/api/articles/<article_id>/view', methods=['POST'])
def add_view(article_id):
    views = load_views()
    now = datetime.now().isoformat()
    if article_id not in views:
        views[article_id] = {'views': 0, 'clicks': 0, 'history': []}
    views[article_id]['views'] += 1
    views[article_id]['history'].append({'type': 'view', 'timestamp': now})
    save_views(views)
    return jsonify({'views': views[article_id]['views']})


@app.route('/api/articles/<article_id>/click', methods=['POST'])
def add_click(article_id):
    views = load_views()
    now = datetime.now().isoformat()
    if article_id not in views:
        views[article_id] = {'views': 0, 'clicks': 0, 'history': []}
    views[article_id]['clicks'] += 1
    views[article_id]['history'].append({'type': 'click', 'timestamp': now})
    save_views(views)
    return jsonify({'clicks': views[article_id]['clicks']})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    views = load_views()
    articles = article_manager.get_all_articles()
    week_ago = datetime.now() - timedelta(days=7)
    stats = {
        'totalViews': sum(item.get('views', 0) for item in views.values()),
        'mostVisited': {'title': '', 'views': 0},
        'mostClicked': {'title': '', 'clicks': 0},
        'viewsPerArticle': []
    }
    for article in articles:
        article_id = article['id']
        article_views = views.get(article_id, {'views': 0, 'clicks': 0, 'history': []})
        stats['viewsPerArticle'].append({'title': article['title'], 'views': article_views['views']})
        week_views = sum(
            1
            for item in article_views.get('history', [])
            if item['type'] == 'view' and item['timestamp'] >= week_ago.isoformat()
        )
        if week_views > stats['mostVisited']['views']:
            stats['mostVisited'] = {'title': article['title'], 'views': week_views}
        if article_views['clicks'] > stats['mostClicked']['clicks']:
            stats['mostClicked'] = {'title': article['title'], 'clicks': article_views['clicks']}
    return jsonify(stats)


@app.route('/api/groups', methods=['GET'])
def get_groups():
    def created_ts(value):
        try:
            return datetime.fromisoformat(value or '').timestamp()
        except Exception:
            return 0

    groups = {}
    for article in article_manager.get_all_articles():
        group_name = article.get('group')
        if not group_name:
            continue
        groups.setdefault(group_name, []).append(article)
    for group_name, items in groups.items():
        groups[group_name] = sorted(
            items,
            key=lambda item: (
                item.get('order_in_group', 10**9),
                -created_ts(item.get('created_at'))
            )
        )
    return jsonify(groups)


@app.route('/api/taxonomies', methods=['GET'])
def get_taxonomies():
    settings = load_site_settings()
    group_usage = article_manager.get_group_usage()
    category_usage = article_manager.get_category_usage()

    custom_groups = [str(item).strip() for item in settings.get('customGroups', []) if str(item).strip()]
    custom_categories = [str(item).strip() for item in settings.get('customCategories', []) if str(item).strip()]
    highlighted = [str(item).strip() for item in settings.get('highlightedGroups', []) if str(item).strip()]

    group_names = set(group_usage.keys()) | set(custom_groups)
    if 'standaard' not in group_names:
        group_names.add('standaard')

    category_names = set(category_usage.keys()) | set(custom_categories)

    groups = []
    for name in sorted(group_names):
        groups.append({
            'name': name,
            'count': group_usage.get(name, 0),
            'custom': name in custom_groups,
            'highlighted': name in highlighted
        })

    categories = []
    for name in sorted(category_names):
        categories.append({
            'name': name,
            'count': category_usage.get(name, 0),
            'custom': name in custom_categories
        })

    return jsonify({
        'groups': groups,
        'categories': categories
    })


@app.route('/api/taxonomies/groups', methods=['POST'])
def create_taxonomy_group():
    data = parse_json_body()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Group naam is verplicht.'}), 400

    settings = load_site_settings()
    custom_groups = [str(item).strip() for item in settings.get('customGroups', []) if str(item).strip()]
    if name not in custom_groups:
        custom_groups.append(name)
        settings['customGroups'] = sorted(set(custom_groups))
        save_site_settings(settings)

    return jsonify({'success': True, 'name': name})


@app.route('/api/taxonomies/groups/<path:group_name>', methods=['PATCH'])
def patch_taxonomy_group(group_name):
    data = parse_json_body()
    name = (group_name or '').strip()
    if not name:
        return jsonify({'error': 'Group naam ontbreekt.'}), 400

    settings = load_site_settings()
    highlighted = [str(item).strip() for item in settings.get('highlightedGroups', []) if str(item).strip()]
    should_highlight = bool(data.get('highlighted'))

    if should_highlight and name not in highlighted:
        highlighted.append(name)
    if not should_highlight and name in highlighted:
        highlighted = [item for item in highlighted if item != name]

    settings['highlightedGroups'] = sorted(set(highlighted))
    save_site_settings(settings)
    return jsonify({'success': True, 'name': name, 'highlighted': should_highlight})


@app.route('/api/taxonomies/groups/<path:group_name>', methods=['DELETE'])
def delete_taxonomy_group(group_name):
    name = (group_name or '').strip()
    if not name:
        return jsonify({'error': 'Group naam ontbreekt.'}), 400
    if name == 'standaard':
        return jsonify({'error': 'De groep standaard kan niet verwijderd worden.'}), 400

    changed = article_manager.reassign_group(name, 'standaard')

    settings = load_site_settings()
    settings['customGroups'] = [
        str(item).strip() for item in settings.get('customGroups', [])
        if str(item).strip() and str(item).strip() != name
    ]
    settings['highlightedGroups'] = [
        str(item).strip() for item in settings.get('highlightedGroups', [])
        if str(item).strip() and str(item).strip() != name
    ]
    save_site_settings(settings)

    return jsonify({'success': True, 'name': name, 'reassignedArticles': changed})


@app.route('/api/taxonomies/categories', methods=['POST'])
def create_taxonomy_category():
    data = parse_json_body()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Categorie naam is verplicht.'}), 400

    settings = load_site_settings()
    custom_categories = [str(item).strip() for item in settings.get('customCategories', []) if str(item).strip()]
    if name not in custom_categories:
        custom_categories.append(name)
        settings['customCategories'] = sorted(set(custom_categories))
        save_site_settings(settings)

    return jsonify({'success': True, 'name': name})


@app.route('/api/taxonomies/categories/<path:category_name>', methods=['DELETE'])
def delete_taxonomy_category(category_name):
    name = (category_name or '').strip()
    if not name:
        return jsonify({'error': 'Categorie naam ontbreekt.'}), 400

    changed = article_manager.clear_category(name)

    settings = load_site_settings()
    settings['customCategories'] = [
        str(item).strip() for item in settings.get('customCategories', [])
        if str(item).strip() and str(item).strip() != name
    ]
    save_site_settings(settings)

    return jsonify({'success': True, 'name': name, 'updatedArticles': changed})


@app.route('/api/site', methods=['GET'])
def get_site_settings():
    return jsonify(load_site_settings())


@app.route('/api/site', methods=['PUT'])
def update_site_settings():
    data = parse_json_body()
    current = load_site_settings()
    current.update({
        'newsletterTitle': data.get('newsletterTitle', current.get('newsletterTitle')),
        'newsletterText': data.get('newsletterText', current.get('newsletterText')),
        'newsletterButtonText': data.get('newsletterButtonText', current.get('newsletterButtonText')),
        'newsletterButtonLink': data.get('newsletterButtonLink', current.get('newsletterButtonLink')),
        'workshopTitle': data.get('workshopTitle', current.get('workshopTitle')),
        'workshopText': data.get('workshopText', current.get('workshopText')),
        'workshopButtonText': data.get('workshopButtonText', current.get('workshopButtonText')),
        'workshopButtonLink': data.get('workshopButtonLink', current.get('workshopButtonLink'))
    })
    save_site_settings(current)
    return jsonify(current)


@app.route('/api/products', methods=['GET'])
def get_products():
    include_inactive = request.args.get('includeInactive') == '1'
    products = product_manager.get_all_products()
    if not include_inactive:
        products = [product for product in products if product.get('active', True)]
    return jsonify(products)


@app.route('/api/products', methods=['POST'])
def create_product():
    data = parse_json_body()
    product = product_manager.create_product(**data)
    return jsonify(product), 201


@app.route('/api/products/<product_id>', methods=['GET'])
def get_product(product_id):
    try:
        return jsonify(product_manager.get_product(product_id))
    except FileNotFoundError:
        return jsonify({'error': 'Product not found'}), 404


@app.route('/api/products/<product_id>', methods=['PUT'])
def update_product(product_id):
    data = parse_json_body()
    try:
        return jsonify(product_manager.update_product(product_id, **data))
    except FileNotFoundError:
        return jsonify({'error': 'Product not found'}), 404


@app.route('/api/products/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    return jsonify({'success': product_manager.delete_product(product_id)})


@app.route('/api/stripe/config', methods=['GET'])
def get_stripe_config():
    print('DEBUG /api/stripe/config: STRIPE_SECRET_KEY loaded:', bool(STRIPE_SECRET_KEY), 'STRIPE_PUBLISHABLE_KEY loaded:', bool(STRIPE_PUBLISHABLE_KEY), 'stripe_is_ready:', stripe_is_ready())
    return jsonify({
        'enabled': stripe_is_ready(),
        'publishableKey': STRIPE_PUBLISHABLE_KEY,
    })


@app.route('/api/stripe/create-checkout-session', methods=['POST'])
def create_checkout_session():
    if not stripe_is_ready():
        return jsonify({'error': 'Stripe is niet geconfigureerd op de server.'}), 503

    data = parse_json_body()
    items = data.get('items', [])
    shipping_address = data.get('shipping_address')
    customer_email = data.get('customer_email')
    if not items:
        return jsonify({'error': 'Geen producten in winkelmandje.'}), 400

    try:
        line_items = []
        for item in items:
            product_id = (item.get('id') or '').strip()
            quantity = max(1, min(int(item.get('quantity', 1)), 10))
            product = product_manager.get_product(product_id)
            if not product.get('active', True):
                return jsonify({'error': f"Product {product_id} is niet beschikbaar."}), 400
            line_items.append(product_to_checkout_line_item(product, quantity))

        # Zet shipping address om naar Stripe formaat indien aanwezig
        stripe_shipping = None
        if shipping_address:
            stripe_shipping = {
                'name': shipping_address.get('name', ''),
                'address': {
                    'line1': shipping_address.get('address', ''),
                    'postal_code': shipping_address.get('postal', ''),
                    'city': shipping_address.get('city', ''),
                    'country': 'BE',
                }
            }

        session = stripe.checkout.Session.create(
            mode='payment',
            success_url=f"{get_public_base_url()}/cart?checkout=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{get_public_base_url()}/cart?checkout=cancelled",
            line_items=line_items,
            allow_promotion_codes=True,
            customer_email=customer_email,
            shipping_address_collection={
                'allowed_countries': ['BE', 'NL']
            },
            shipping_options=[
                {
                    'shipping_rate_data': {
                        'type': 'fixed_amount',
                        'fixed_amount': {'amount': 0, 'currency': 'eur'},
                        'display_name': 'Gratis verzending',
                        'delivery_estimate': {
                            'minimum': {'unit': 'business_day', 'value': 1},
                            'maximum': {'unit': 'business_day', 'value': 5},
                        },
                    }
                }
            ]
        )
    except FileNotFoundError:
        return jsonify({'error': 'Een of meer producten niet gevonden.'}), 404
    except Exception as error:
        return jsonify({'error': str(error)}), 500

    return jsonify({
        'sessionId': session.get('id'),
        'checkout_url': session.get('url'),
    })


@app.route('/api/stripe/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events."""
    if not stripe_is_ready():
        return jsonify({'error': 'Webhook gedeactiveerd.'}), 503

    payload = request.data
    sig_header = request.headers.get('stripe-signature')

    try:
        # Verify webhook signature (optional, requires STRIPE_WEBHOOK_SECRET env var)
        stripe_webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET', '').strip()
        if stripe_webhook_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, stripe_webhook_secret
            )
        else:
            # If no webhook secret, just parse the JSON (less secure but works for testing)
            event = json.loads(payload)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    except stripe.error.SignatureVerificationError as error:
        return jsonify({'error': str(error)}), 400

    # Handle checkout session completion
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        try:
            order, created = save_order_from_stripe_session(session['id'])
            if created:
                print(f"Order created via webhook: {order['id']}")
        except Exception as error:
            print(f"Error processing webhook: {error}")
            return jsonify({'error': str(error)}), 500

    return jsonify({'status': 'success'})


@app.route('/api/stripe/confirm-session', methods=['POST'])
def confirm_stripe_session():
    """Confirm a successful Stripe checkout session and persist an order.

    This endpoint allows local development without Stripe CLI webhooks.
    """
    if not stripe_is_ready():
        return jsonify({'error': 'Stripe is niet geconfigureerd op de server.'}), 503

    data = parse_json_body()
    session_id = (data.get('sessionId') or '').strip()
    if not session_id:
        return jsonify({'error': 'sessionId is verplicht.'}), 400

    try:
        order, created = save_order_from_stripe_session(session_id)
        return jsonify({
            'success': True,
            'created': created,
            'orderId': order.get('id')
        })
    except Exception as error:
        return jsonify({'error': str(error)}), 500


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Get all orders (admin/dashboard view)."""
    orders = order_manager.get_all_orders(limit=100)
    return jsonify(orders)


@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    """Get a specific order."""
    order = order_manager.get_order(order_id)
    if not order:
        return jsonify({'error': 'Order niet gevonden.'}), 404
    return jsonify(order)


@app.route('/api/orders/<order_id>/status', methods=['PATCH'])
def update_order_status(order_id):
    data = parse_json_body()
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Status is verplicht.'}), 400
    order = order_manager.update_order_status(order_id, new_status)
    if not order:
        return jsonify({'error': 'Order niet gevonden.'}), 404
    return jsonify({'success': True, 'order': order})


@app.route('/api/upload', methods=['POST'])
def upload_image():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Geen bestand gevonden'}), 400

        file = request.files['file']
        asset_id = request.form.get('article_id', '')
        index = request.form.get('index', '0')

        if not file or not asset_id:
            return jsonify({'error': 'Item ID en bestand zijn verplicht'}), 400

        filename = file.filename or 'image'
        ext = os.path.splitext(filename)[1].lower() or '.jpg'
        images_dir = os.path.join(BASE_DIR, 'images')
        os.makedirs(images_dir, exist_ok=True)

        new_filename = f"{asset_id}_{index}{ext}"
        filepath = os.path.join(images_dir, new_filename)
        file.save(filepath)
        return jsonify({'url': f"/images/{new_filename}"}), 200
    except Exception as error:
        return jsonify({'error': str(error)}), 500


# ===== CMS AUTHENTICATION =====

@app.route('/api/cms/login', methods=['POST'])
def cms_login():
    """Login endpoint for CMS."""
    data = parse_json_body()
    password = data.get('password', '').strip()
    current_cms_password = os.getenv('CMS_PASSWORD', CMS_PASSWORD).strip()
    
    print(f'DEBUG: Login attempt with password length: {len(password)}')
    print(f'DEBUG: Expected CMS_PASSWORD: {repr(current_cms_password)}')
    print(f'DEBUG: Received password: {repr(password)}')
    
    if not password:
        return jsonify({'success': False, 'error': 'Wachtwoord is verplicht'}), 400
    
    if password == current_cms_password:
        print(f'DEBUG: Wachtwoord correct! Session aangemaakt.')
        session.permanent = True
        session['cms_authenticated'] = True
        return jsonify({'success': True, 'message': 'Ingelogd'})
    else:
        print(f'DEBUG: Wachtwoord onjuist! {repr(password)} != {repr(current_cms_password)}')
        return jsonify({'success': False, 'error': 'Onjuist wachtwoord'}), 401


@app.route('/api/cms/logout', methods=['POST'])
def cms_logout():
    """Logout endpoint for CMS."""
    session.pop('cms_authenticated', None)
    return jsonify({'success': True, 'message': 'Uitgelogd'})


@app.route('/api/cms/status', methods=['GET'])
def cms_status():
    """Check if user is authenticated."""
    is_authenticated = session.get('cms_authenticated', False)
    return jsonify({'authenticated': is_authenticated})


# ===== STRIPE CONFIGURATION =====

@app.route('/api/cms/stripe-config', methods=['GET'])
def cms_get_stripe_config():
    """Get current Stripe configuration."""
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return jsonify({'error': 'Niet geauthenticeerd'}), 401
    
    secret_key = os.getenv('STRIPE_SECRET_KEY', '').strip()
    publishable_key = os.getenv('STRIPE_PUBLISHABLE_KEY', '').strip()
    
    return jsonify({
        'secret_key': secret_key[:20] + '...' if secret_key else '',
        'secret_key_full': secret_key,
        'publishable_key': publishable_key[:20] + '...' if publishable_key else '',
        'publishable_key_full': publishable_key,
        'configured': bool(secret_key and publishable_key)
    })


@app.route('/api/cms/stripe-config', methods=['POST'])
def cms_save_stripe_config():
    """Save Stripe configuration to .env file."""
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return jsonify({'error': 'Niet geauthenticeerd'}), 401
    
    data = parse_json_body()
    secret_key = data.get('secret_key', '').strip()
    publishable_key = data.get('publishable_key', '').strip()
    
    try:
        # Read current .env file
        env_path = os.path.join(BASE_DIR, '.env')
        env_content = {}
        
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_content[key.strip()] = value.strip()
        
        # Update Stripe keys
        env_content['STRIPE_SECRET_KEY'] = secret_key
        env_content['STRIPE_PUBLISHABLE_KEY'] = publishable_key
        
        # Write back to file
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write('# CMS Configuration\n')
            f.write(f'CMS_PASSWORD={env_content.get("CMS_PASSWORD", "admin123")}\n\n')
            f.write('# Secret key for sessions (change this in production!)\n')
            f.write(f'SECRET_KEY={env_content.get("SECRET_KEY", "your-super-secret-key-change-this-in-production")}\n\n')
            f.write('# Stripe Configuration\n')
            f.write(f'STRIPE_SECRET_KEY={secret_key}\n')
            f.write(f'STRIPE_PUBLISHABLE_KEY={publishable_key}\n')
            f.write(f'APP_BASE_URL={env_content.get("APP_BASE_URL", "http://localhost:5000")}\n')
        
        # Update environment variables
        os.environ['STRIPE_SECRET_KEY'] = secret_key
        os.environ['STRIPE_PUBLISHABLE_KEY'] = publishable_key
        
        print('DEBUG: Stripe instellingen opgeslagen')
        
        return jsonify({'success': True, 'message': 'Stripe instellingen opgeslagen'})
    
    except Exception as error:
        print(f'ERROR: Fout bij opslaan Stripe keys: {error}')
        return jsonify({'success': False, 'error': str(error)}), 500


@app.route('/api/cms/password', methods=['POST'])
def cms_change_password():
    """Change CMS password."""
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return jsonify({'error': 'Niet geauthenticeerd'}), 401
    
    data = parse_json_body()
    new_password = data.get('password', '').strip()
    
    if not new_password:
        return jsonify({'success': False, 'error': 'Wachtwoord mag niet leeg zijn'}), 400
    
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'Wachtwoord moet minstens 6 tekens zijn'}), 400
    
    try:
        # Read current .env file
        env_path = os.path.join(BASE_DIR, '.env')
        env_content = {}
        
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_content[key.strip()] = value.strip()
        
        # Update password
        env_content['CMS_PASSWORD'] = new_password
        
        # Write back to file
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write('# CMS Configuration\n')
            f.write(f'CMS_PASSWORD={new_password}\n\n')
            f.write('# Secret key for sessions (change this in production!)\n')
            f.write(f'SECRET_KEY={env_content.get("SECRET_KEY", "your-super-secret-key-change-this-in-production")}\n\n')
            f.write('# Stripe Configuration\n')
            f.write(f'STRIPE_SECRET_KEY={env_content.get("STRIPE_SECRET_KEY", "")}\n')
            f.write(f'STRIPE_PUBLISHABLE_KEY={env_content.get("STRIPE_PUBLISHABLE_KEY", "")}\n')
            f.write(f'APP_BASE_URL={env_content.get("APP_BASE_URL", "http://localhost:5000")}\n')
        
        # Update environment variable and in-memory fallback value
        global CMS_PASSWORD
        os.environ['CMS_PASSWORD'] = new_password
        CMS_PASSWORD = new_password
        
        print(f'DEBUG: CMS wachtwoord gewijzigd')
        
        return jsonify({'success': True, 'message': 'CMS wachtwoord opgeslagen. Log alstublieft opnieuw in.'})
    
    except Exception as error:
        print(f'ERROR: Fout bij wijzigen wachtwoord: {error}')
        return jsonify({'success': False, 'error': str(error)}), 500

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/shop')
def serve_shop():
    return send_from_directory(FRONTEND_DIR, 'shop.html')


@app.route('/cart')
def serve_cart():
    return send_from_directory(FRONTEND_DIR, 'cart.html')


@app.route('/cms-login')
def serve_cms_login():
    """Public login page."""
    return send_from_directory(FRONTEND_DIR, 'cms-login.html')


@app.route('/cms')
def serve_cms():
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return redirect('/cms-login')
    return send_from_directory(FRONTEND_DIR, 'cms.html')


@app.route('/cms-edit')
def serve_cms_edit():
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return redirect('/cms-login')
    return send_from_directory(FRONTEND_DIR, 'cms-edit.html')


@app.route('/cms-create')
def serve_cms_create():
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return redirect('/cms-login')
    return send_from_directory(FRONTEND_DIR, 'cms-create.html')


@app.route('/cms-product-create')
def serve_cms_product_create():
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return redirect('/cms-login')
    return send_from_directory(FRONTEND_DIR, 'cms-product-create.html')


@app.route('/cms-product-edit')
def serve_cms_product_edit():
    if 'cms_authenticated' not in session or not session['cms_authenticated']:
        return redirect('/cms-login')
    return send_from_directory(FRONTEND_DIR, 'cms-product-edit.html')


@app.route('/article/<article_id>')
def serve_article(article_id):
    return send_from_directory(FRONTEND_DIR, 'article.html')


@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'images'), filename)


@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
