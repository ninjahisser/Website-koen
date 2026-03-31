import json
import os
from datetime import datetime
import uuid


class ArticleManager:
    def __init__(self, articles_dir):
        self.articles_dir = articles_dir
        os.makedirs(articles_dir, exist_ok=True)

    def create_article(self, title, category, components, size="klein", group=None):
        article_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()
        article = {
            'id': article_id,
            'title': (title or '').strip(),
            'category': (category or '').strip(),
            'size': size or 'klein',
            'components': components or [],
            'created_at': now,
            'updated_at': now
        }
        if group:
            article['group'] = group

        filepath = os.path.join(self.articles_dir, f'{article_id}.json')
        with open(filepath, 'w', encoding='utf-8') as file:
            json.dump(article, file, ensure_ascii=False, indent=2)
        return article

    def update_article(self, article_id, **kwargs):
        filepath = os.path.join(self.articles_dir, f'{article_id}.json')
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Article {article_id} not found")

        with open(filepath, 'r', encoding='utf-8') as file:
            article = json.load(file)

        for key in ['title', 'components', 'category', 'size', 'group']:
            if key not in kwargs:
                continue
            if key == 'group' and not kwargs[key]:
                article.pop('group', None)
            elif key in ['title', 'category']:
                article[key] = (kwargs[key] or '').strip()
            elif key == 'components':
                article[key] = kwargs[key] or []
            else:
                article[key] = kwargs[key]

        article['updated_at'] = datetime.now().isoformat()

        with open(filepath, 'w', encoding='utf-8') as file:
            json.dump(article, file, ensure_ascii=False, indent=2)
        return article

    def delete_article(self, article_id):
        filepath = os.path.join(self.articles_dir, f'{article_id}.json')
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    def get_all_articles(self):
        articles = []
        for filename in os.listdir(self.articles_dir):
            if not filename.endswith('.json'):
                continue
            filepath = os.path.join(self.articles_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as file:
                articles.append(json.load(file))
        return sorted(articles, key=lambda item: item.get('created_at', ''), reverse=True)
