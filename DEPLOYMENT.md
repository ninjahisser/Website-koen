# Deployment Guide - Het Voorlaatste Nieuws

## Overview
- **Frontend**: GitHub Pages (static HTML/CSS/JS)
- **Backend**: PythonAnywhere (Flask API)
- **Username**: SethVdB

---

## Part 1: Deploy Backend to PythonAnywhere

### 1. Create PythonAnywhere Account
1. Go to https://www.pythonanywhere.com/
2. Sign up with username: `SethVdB` (already configured in config.js)
3. Choose the free "Beginner" account

### 2. Upload Your Code
**Option A - Using Git (Recommended):**
```bash
# On PythonAnywhere Console
cd ~
git clone https://github.com/yourusername/yourrepo.git HetVoorlaatsteNieuws
cd HetVoorlaatsteNieuws
```

**Option B - Manual Upload:**
1. Go to "Files" tab
2. Create folder: `/home/SethVdB/HetVoorlaatsteNieuws`
3. Upload all files from your local `Uitwerking` folder

### 3. Set Up Virtual Environment
```bash
# In PythonAnywhere Bash console
cd ~/HetVoorlaatsteNieuws
mkvirtualenv --python=/usr/bin/python3.10 hvln-env
pip install -r backend/requirements.txt
```

### 4. Configure Web App
1. Go to **Web** tab
2. Click **Add a new web app**
3. Choose **Manual configuration** (not Flask wizard)
4. Choose **Python 3.10**

### 5. Configure WSGI File
1. In Web tab, click on WSGI configuration file link
2. **Delete all content** and replace with:

```python
import sys
import os

# Add your project directory to the sys.path
project_home = '/home/SethVdB/HetVoorlaatsteNieuws'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

backend_path = os.path.join(project_home, 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from backend.server import app as application
```

3. Save the file

### 6. Set Virtual Environment Path
In the Web tab, under "Virtualenv" section:
- Enter: `/home/SethVdB/.virtualenvs/hvln-env`

### 7. Reload and Test
1. Click the green **Reload** button
2. Visit: `https://SethVdB.pythonanywhere.com/api/articles`
3. You should see your articles JSON!

---

## Part 2: Deploy Frontend to GitHub Pages

### 1. Create GitHub Repository
```bash
# In your local project folder
cd "f:\LUCA-3\Stage\HetVoorlaatsteNieuws\Uitwerking"
git init
git add .
git commit -m "Initial commit"
```

### 2. Push to GitHub
```bash
# Create repo on GitHub first, then:
git remote add origin https://github.com/yourusername/het-voorlaatste-nieuws.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Pages
1. Go to your GitHub repository settings
2. Click **Pages** (left sidebar)
3. Under "Source", select **main** branch
4. Choose **/ (root)** folder
5. Click **Save**

### 4. Configure for GitHub Pages
Since your frontend files are in the `frontend/` folder, you have two options:

**Option A - Move frontend files to root** (Recommended):
```bash
# Move frontend files to root
mv frontend/* .
mv frontend/.* . 2>/dev/null || true
rmdir frontend
git add .
git commit -m "Move frontend to root for GitHub Pages"
git push
```

**Option B - Change GitHub Pages source folder:**
- In GitHub Pages settings, select `/frontend` as source folder (if available)

### 5. Test Your Site
Your site will be available at:
- `https://yourusername.github.io/het-voorlaatste-nieuws/`

---

## Part 3: Verify Everything Works

### Backend Test Endpoints
Test these URLs work:
- `https://SethVdB.pythonanywhere.com/api/articles`
- `https://SethVdB.pythonanywhere.com/api/groups`
- `https://SethVdB.pythonanywhere.com/api/site`

### Frontend Test
1. Open your GitHub Pages URL
2. Check browser console (F12) for any errors
3. Verify articles load from PythonAnywhere API
4. Test CMS functionality

---

## Troubleshooting

### Backend Issues

**"Internal Server Error":**
- Check PythonAnywhere error log (Web tab → Error log)
- Verify virtual environment path is correct
- Make sure all files uploaded correctly

**"ModuleNotFoundError":**
- Check requirements.txt installed: `pip list` in console
- Verify WSGI path configuration

**CORS Errors:**
- Already configured with `CORS(app)` in server.py
- Should work fine

### Frontend Issues

**"Failed to load articles":**
- Check config.js has correct URL
- Verify PythonAnywhere backend is running
- Check browser console for CORS/network errors

**404 Not Found:**
- Make sure frontend files are in root or correct folder
- Check GitHub Pages settings

---

## Important Files

- `backend/requirements.txt` - Python dependencies
- `frontend/js/config.js` - API URL configuration (already set!)
- `pythonanywhere_wsgi.py` - PythonAnywhere WSGI config
- `.gitignore` - Files to exclude from Git

---

## Cost Summary

- PythonAnywhere: **FREE** (beginner account)
- GitHub Pages: **FREE**
- **Total: $0/month** 🎉

---

## Maintenance

### Update Backend Code
```bash
# SSH to PythonAnywhere
cd ~/HetVoorlaatsteNieuws
git pull
# Click "Reload" button in Web tab
```

### Update Frontend Code
```bash
# Local machine
git add .
git commit -m "Update frontend"
git push
# GitHub Pages auto-updates in ~1 minute
```

---

## Need Help?
- PythonAnywhere forums: https://www.pythonanywhere.com/forums/
- GitHub Pages docs: https://docs.github.com/pages
