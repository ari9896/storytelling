# Storytelling

A standalone MERN starter with a copy of the PolyLang storytelling sandbox. The sample story and discussion run locally in React; comments reset on refresh. The backend is ready for future API routes and an optional MongoDB connection.

## Run locally

Dependencies are already installed. Open two terminals in this folder:

```powershell
# Terminal 1: API on http://localhost:5016
npm run dev
```

```powershell
# Terminal 2: app on http://localhost:5173
cd frontend
npm run dev
```

Open `http://localhost:5173` for the home page and story list. The sample stories live at `/stories/the-letter-at-the-station` and `/stories/tales-of-matriarch`. `http://localhost:5016/api/health` checks the API.

The root `package.json` holds backend dependencies and uses ES modules. The `frontend/package.json` holds React and Vite dependencies. Frontend routes live in `frontend/src/App.jsx`; story card metadata lives in `frontend/src/data/stories.js`.

To connect MongoDB later, copy `.env.example` to `.env` and set `MONGO_URI`. The API starts without a database while the story is still a local prototype.
