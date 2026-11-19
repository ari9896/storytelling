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


### Comment reactions

Signed-in readers can use React below a comment or reply to choose an emoji. Counts are visible to everyone; the current user's choice is highlighted. Selecting another emoji replaces the old choice, and clicking the selected emoji removes it. Reactions persist in the comment's `reactions` array with one entry per user, updated atomically. Discussion responses expose counts and the current user's choice. Hovering over a reaction shows up to ten public profiles; on touchscreens, tap its count. View more opens a scrollable list that loads 50 profiles at a time. Names open the existing user cards. The participant endpoint returns only profile IDs, current usernames, and current pictures, and checks chapter access and comment visibility.

Deleted comments cannot receive reactions. Comment restrictions also prevent adding or changing reactions (removing one's own remains allowed). Chapter access is checked on the server, and reactions never satisfy the comment requirement for unlocking chapters. Existing comments work without a migration. Run `node --test backend/lib/commentReactions.test.js` for the offline reaction checks.
