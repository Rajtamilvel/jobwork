import os
import sys

# Ensure backend directory is in sys.path so all imports (main, database, models) resolve
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app
