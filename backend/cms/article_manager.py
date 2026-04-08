import json
import os
from datetime import datetime
import uuid


class ArticleManager:
    def __init__(self, articles_dir):
        self.articles_dir = articles_dir
        os.makedirs(articles_dir, exist_ok=True)

    def _article_filepath(self, article_id):
        return os.path.join(self.articles_dir, f'{article_id}.json')

    def _load_all_articles_raw(self):
        articles = []
        for filename in os.listdir(self.articles_dir):
            if not filename.endswith('.json'):
                continue
            filepath = os.path.join(self.articles_dir, filename)
            with open(filepath, 'r', encoding='utf-8-sig') as file:
                articles.append(json.load(file))
        return articles

    def _write_article(self, article):
        filepath = self._article_filepath(article.get('id', ''))
        if not article.get('id'):
            return
        with open(filepath, 'w', encoding='utf-8') as file:
            json.dump(article, file, ensure_ascii=False, indent=2)

    def _is_valid_order(self, value):
        return isinstance(value, int) and value > 0

    def _normalize_existing_orders(self, articles):
        """Ensure order fields exist so ordering can be managed explicitly."""
        changed = False

        sorted_by_created_desc = sorted(
            articles,
            key=lambda item: item.get('created_at', ''),
            reverse=True
        )

        for index, article in enumerate(sorted_by_created_desc):
            if not self._is_valid_order(article.get('order_global')):
                article['order_global'] = (index + 1) * 1000
                changed = True

        group_positions = {}
        for article in sorted_by_created_desc:
            group_name = (article.get('group') or 'standaard').strip() or 'standaard'
            group_positions.setdefault(group_name, 0)
            group_positions[group_name] += 1
            if not self._is_valid_order(article.get('order_in_group')):
                article['order_in_group'] = group_positions[group_name] * 1000
                changed = True

        if changed:
            for article in articles:
                article['updated_at'] = article.get('updated_at') or datetime.now().isoformat()
                self._write_article(article)

        return changed

    def _next_global_order(self, articles):
        orders = [item.get('order_global') for item in articles if self._is_valid_order(item.get('order_global'))]
        return (max(orders) + 1000) if orders else 1000

    def _next_group_order(self, articles, group_name):
        normalized_group = (group_name or 'standaard').strip() or 'standaard'
        orders = [
            item.get('order_in_group')
            for item in articles
            if ((item.get('group') or 'standaard').strip() or 'standaard') == normalized_group
            and self._is_valid_order(item.get('order_in_group'))
        ]
        return (max(orders) + 1000) if orders else 1000

    def _first_global_order(self, articles):
        orders = [item.get('order_global') for item in articles if self._is_valid_order(item.get('order_global'))]
        if not orders:
            return 1000

        min_order = min(orders)
        if min_order > 1:
            return max(1, min_order // 2)

        # No room left above the first item: shift all existing orders down once.
        now = datetime.now().isoformat()
        for article in articles:
            if not self._is_valid_order(article.get('order_global')):
                continue
            article['order_global'] = article.get('order_global') + 1000
            article['updated_at'] = now
            self._write_article(article)
        return 1000

    def _first_group_order(self, articles, group_name):
        normalized_group = (group_name or 'standaard').strip() or 'standaard'
        group_articles = [
            item for item in articles
            if ((item.get('group') or 'standaard').strip() or 'standaard') == normalized_group
        ]
        orders = [item.get('order_in_group') for item in group_articles if self._is_valid_order(item.get('order_in_group'))]
        if not orders:
            return 1000

        min_order = min(orders)
        if min_order > 1:
            return max(1, min_order // 2)

        now = datetime.now().isoformat()
        for article in group_articles:
            if not self._is_valid_order(article.get('order_in_group')):
                continue
            article['order_in_group'] = article.get('order_in_group') + 1000
            article['updated_at'] = now
            self._write_article(article)
        return 1000

    def _created_timestamp(self, article):
        raw = article.get('created_at')
        if not raw:
            return 0
        try:
            return datetime.fromisoformat(raw).timestamp()
        except Exception:
            return 0

    def create_article(self, title, category, components, size="klein", group=None, thumbnail=None):
        article_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()
        existing_articles = self._load_all_articles_raw()
        normalized_group = (group or 'standaard').strip() or 'standaard'
        normalized_components = self._normalize_components(components or [])
        article = {
            'id': article_id,
            'title': (title or '').strip(),
            'category': (category or '').strip(),
            'size': size or 'klein',
            'components': normalized_components,
            'order_global': self._first_global_order(existing_articles),
            'order_in_group': self._first_group_order(existing_articles, normalized_group),
            'created_at': now,
            'updated_at': now
        }
        if normalized_group:
            article['group'] = normalized_group
        if thumbnail:
            article['thumbnail'] = thumbnail

        self._write_article(article)
        return article

    def update_article(self, article_id, **kwargs):
        filepath = self._article_filepath(article_id)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Article {article_id} not found")

        with open(filepath, 'r', encoding='utf-8-sig') as file:
            article = json.load(file)

        original_group = (article.get('group') or 'standaard').strip() or 'standaard'

        for key in ['title', 'components', 'category', 'size', 'group', 'thumbnail', 'order_global', 'order_in_group']:
            if key not in kwargs:
                continue
            if key == 'group' and not kwargs[key]:
                article.pop('group', None)
            elif key == 'thumbnail' and not kwargs[key]:
                article.pop('thumbnail', None)
            elif key in ['title', 'category']:
                article[key] = (kwargs[key] or '').strip()
            elif key == 'components':
                article[key] = self._normalize_components(kwargs[key] or [])
            elif key in ['order_global', 'order_in_group']:
                value = kwargs[key]
                if self._is_valid_order(value):
                    article[key] = int(value)
            else:
                article[key] = kwargs[key]

        if not self._is_valid_order(article.get('order_global')):
            all_articles = self._load_all_articles_raw()
            article['order_global'] = self._next_global_order([item for item in all_articles if item.get('id') != article_id])

        new_group = (article.get('group') or 'standaard').strip() or 'standaard'
        if not self._is_valid_order(article.get('order_in_group')) or new_group != original_group:
            all_articles = self._load_all_articles_raw()
            article['order_in_group'] = self._next_group_order([item for item in all_articles if item.get('id') != article_id], new_group)

        article['updated_at'] = datetime.now().isoformat()

        self._write_article(article)
        return article

    def delete_article(self, article_id):
        filepath = self._article_filepath(article_id)
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    def get_all_articles(self):
        articles = self._load_all_articles_raw()
        self._normalize_existing_orders(articles)
        return sorted(
            articles,
            key=lambda item: (
                item.get('order_global', 10**9),
                -self._created_timestamp(item)
            )
        )

    def reset_article_order(self):
        articles = self._load_all_articles_raw()
        sorted_by_created_desc = sorted(
            articles,
            key=lambda item: item.get('created_at', ''),
            reverse=True
        )

        group_positions = {}
        now = datetime.now().isoformat()
        changed = 0

        for index, article in enumerate(sorted_by_created_desc):
            article_id = article.get('id')
            if not article_id:
                continue

            next_global = (index + 1) * 1000
            group_name = (article.get('group') or 'standaard').strip() or 'standaard'
            group_positions.setdefault(group_name, 0)
            group_positions[group_name] += 1
            next_group = group_positions[group_name] * 1000

            has_change = False
            if article.get('order_global') != next_global:
                article['order_global'] = next_global
                has_change = True
            if article.get('order_in_group') != next_group:
                article['order_in_group'] = next_group
                has_change = True

            if has_change:
                article['updated_at'] = now
                self._write_article(article)
                changed += 1

        return changed

    def reset_single_article_order(self, article_id):
        target_id = (article_id or '').strip()
        if not target_id:
            return None

        articles = self._load_all_articles_raw()
        self._normalize_existing_orders(articles)

        target_article = next((item for item in articles if item.get('id') == target_id), None)
        if not target_article:
            return None

        current_sorted = sorted(
            articles,
            key=lambda item: (
                item.get('order_global', 10**9),
                -self._created_timestamp(item)
            )
        )
        default_sorted = sorted(
            articles,
            key=lambda item: (
                -self._created_timestamp(item),
                item.get('id', '')
            )
        )

        default_index = next((idx for idx, item in enumerate(default_sorted) if item.get('id') == target_id), None)
        if default_index is None:
            return None

        reordered = [item for item in current_sorted if item.get('id') != target_id]
        insert_index = min(max(default_index, 0), len(reordered))
        reordered.insert(insert_index, target_article)

        now = datetime.now().isoformat()
        changed = 0
        for index, article in enumerate(reordered):
            next_global = (index + 1) * 1000
            if article.get('order_global') != next_global:
                article['order_global'] = next_global
                article['updated_at'] = now
                self._write_article(article)
                changed += 1

        return changed

    def reorder_articles(self, article_ids, group_name=None):
        ordered_ids = [str(item).strip() for item in (article_ids or []) if str(item).strip()]
        if not ordered_ids:
            return 0

        articles = self._load_all_articles_raw()
        by_id = {item.get('id'): item for item in articles if item.get('id')}
        now = datetime.now().isoformat()
        changed = 0

        if group_name is None:
            for index, article_id in enumerate(ordered_ids):
                article = by_id.get(article_id)
                if not article:
                    continue
                next_order = (index + 1) * 1000
                if article.get('order_global') != next_order:
                    article['order_global'] = next_order
                    article['updated_at'] = now
                    self._write_article(article)
                    changed += 1
            return changed

        normalized_group = (group_name or 'standaard').strip() or 'standaard'
        for index, article_id in enumerate(ordered_ids):
            article = by_id.get(article_id)
            if not article:
                continue
            article_group = (article.get('group') or 'standaard').strip() or 'standaard'
            if article_group != normalized_group:
                continue
            next_order = (index + 1) * 1000
            if article.get('order_in_group') != next_order:
                article['order_in_group'] = next_order
                article['updated_at'] = now
                self._write_article(article)
                changed += 1

        return changed

    def get_group_usage(self):
        usage = {}
        for article in self.get_all_articles():
            group_name = (article.get('group') or 'standaard').strip() or 'standaard'
            usage[group_name] = usage.get(group_name, 0) + 1
        return usage

    def get_category_usage(self):
        usage = {}
        for article in self.get_all_articles():
            category_name = (article.get('category') or '').strip()
            if not category_name:
                continue
            usage[category_name] = usage.get(category_name, 0) + 1
        return usage

    def reassign_group(self, source_group, target_group='standaard'):
        source = (source_group or '').strip()
        target = (target_group or 'standaard').strip() or 'standaard'
        if not source:
            return 0

        changed = 0
        for article in self.get_all_articles():
            current_group = (article.get('group') or 'standaard').strip() or 'standaard'
            if current_group != source:
                continue
            self.update_article(article['id'], group=target)
            changed += 1
        return changed

    def rename_group(self, source_group, target_group):
        source = (source_group or '').strip()
        target = (target_group or '').strip()
        if not source or not target or source == target:
            return 0

        changed = 0
        for article in self.get_all_articles():
            current_group = (article.get('group') or 'standaard').strip() or 'standaard'
            if current_group != source:
                continue
            self.update_article(article['id'], group=target)
            changed += 1
        return changed

    def clear_category(self, category_name):
        source = (category_name or '').strip()
        if not source:
            return 0

        changed = 0
        for article in self.get_all_articles():
            current_category = (article.get('category') or '').strip()
            if current_category != source:
                continue
            self.update_article(article['id'], category='')
            changed += 1
        return changed

    def rename_category(self, source_category, target_category):
        source = (source_category or '').strip()
        target = (target_category or '').strip()
        if not source or not target or source == target:
            return 0

        changed = 0
        for article in self.get_all_articles():
            current_category = (article.get('category') or '').strip()
            if current_category != source:
                continue
            self.update_article(article['id'], category=target)
            changed += 1
        return changed

    def _normalize_components(self, components):
        normalized = [item for item in (components or []) if isinstance(item, dict)]
        has_video = any((item.get('type') == 'video' and (item.get('src') or '').strip()) for item in normalized)
        if has_video:
            normalized = [item for item in normalized if item.get('type') != 'image']
        return normalized
