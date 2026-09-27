import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(parent_dir, "backend")

for p in [backend_dir, parent_dir, current_dir]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.main import app
except Exception:
    try:
        from main import app
    except Exception:
        import main
        app = main.app
