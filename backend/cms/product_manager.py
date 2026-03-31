import json
import os
from datetime import datetime
import uuid


class ProductManager:
    def __init__(self, products_dir):
        self.products_dir = products_dir
        os.makedirs(products_dir, exist_ok=True)

    def _product_path(self, product_id):
        return os.path.join(self.products_dir, f'{product_id}.json')

    def _normalize_price_cents(self, price_cents=None, price_eur=None):
        if price_cents is not None:
            return max(0, int(price_cents))
        if price_eur is not None:
            return max(0, int(round(float(price_eur) * 100)))
        return 0

    def _serialize_product(self, product_id, payload, created_at=None):
        now = datetime.now().isoformat()
        price_cents = self._normalize_price_cents(
            payload.get('price_cents'),
            payload.get('price_eur')
        )
        product = {
            'id': product_id,
            'title': payload.get('title', '').strip(),
            'subtitle': payload.get('subtitle', '').strip(),
            'short_description': payload.get('short_description', '').strip(),
            'description': payload.get('description', '').strip(),
            'category': payload.get('category', '').strip(),
            'badge': payload.get('badge', '').strip(),
            'image': payload.get('image', '').strip(),
            'cta_label': payload.get('cta_label', 'Koop nu').strip() or 'Koop nu',
            'price_cents': price_cents,
            'currency': (payload.get('currency') or 'eur').strip().lower() or 'eur',
            'featured': bool(payload.get('featured', False)),
            'active': bool(payload.get('active', True)),
            'created_at': created_at or now,
            'updated_at': now,
        }
        return product

    def create_product(self, **payload):
        product_id = str(uuid.uuid4())[:8]
        product = self._serialize_product(product_id, payload)
        with open(self._product_path(product_id), 'w', encoding='utf-8') as file:
            json.dump(product, file, ensure_ascii=False, indent=2)
        return product

    def get_product(self, product_id):
        path = self._product_path(product_id)
        if not os.path.exists(path):
            raise FileNotFoundError(f'Product {product_id} not found')
        with open(path, 'r', encoding='utf-8') as file:
            return json.load(file)

    def update_product(self, product_id, **payload):
        existing = self.get_product(product_id)
        updated_payload = {**existing, **payload}
        product = self._serialize_product(product_id, updated_payload, created_at=existing.get('created_at'))
        with open(self._product_path(product_id), 'w', encoding='utf-8') as file:
            json.dump(product, file, ensure_ascii=False, indent=2)
        return product

    def delete_product(self, product_id):
        path = self._product_path(product_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def get_all_products(self):
        products = []
        for filename in os.listdir(self.products_dir):
            if not filename.endswith('.json'):
                continue
            with open(os.path.join(self.products_dir, filename), 'r', encoding='utf-8') as file:
                products.append(json.load(file))
        return sorted(products, key=lambda item: (not item.get('featured', False), item.get('created_at', '')), reverse=False)
