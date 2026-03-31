# PythonAnywhere WSGI Configuration File
# This file tells PythonAnywhere how to run your Flask application

import sys
import os

# Add your project directory to the sys.path
project_home = '/home/SethVdB/HetVoorlaatsteNieuws'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Add the backend directory to sys.path
backend_path = os.path.join(project_home, 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Import Flask app
from backend.server import app as application
