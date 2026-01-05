Project scaffold: Django REST backend + Vite React frontend

Backend (backend/)
- Python virtualenv recommended
- Install: pip install -r requirements.txt
- Copy .env.example -> .env and edit
- Run migrations: python manage.py migrate
- Start server: python manage.py runserver 8000

Frontend (frontend/)
- Node 18+ recommended
- Install: npm install
- Start dev server: npm run dev
- Open: http://localhost:5173 (proxies /api to Django)

Quick setup (PowerShell):

```powershell
# backend
cd "./backend"
python -m venv venv
.\venv\Scripts\Activate
pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 127.0.0.1:8000

Load example fixture data (optional):

```powershell
# from project root
cd .\backend
python manage.py loaddata fixtures/initial_data.json
```

This creates sample Units, Slots and one Allocation so the frontend timetable shows content immediately. You can edit or remove the fixtures after loading.

**Git (exclude env)**

Create a repository that ignores environment files and common build artifacts. From the project root run:

```powershell
# initialize repo (if not already)
git init

# make sure .gitignore is present (it excludes .env and venv)
git add .
git commit -m "Initial scaffold (exclude .env)"

# If you accidentally added an env file, remove it from the index and commit:
git rm --cached backend/.env
git commit -m "Remove backend .env from repo"
```

The `.gitignore` in the project root already excludes `.env`, `backend/venv`, `frontend/node_modules`, `db.sqlite3`, and other common files.

# frontend (new terminal)
cd "./frontend"
npm install
npm run dev
```