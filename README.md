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


### Gore screening for new image uploads

Create a Sightengine account and obtain API keys from https://dashboard.sightengine.com/api-credentials. Set `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET` in the root `.env` for local development and in Render's Environment settings for deployment. Keep these credentials server-side. Restart or redeploy after changing them.

Profile pictures, story thumbnails, and new chapter images are checked before any images in the request are uploaded to Cloudinary. Existing stored images are not rescanned. Missing credentials, API failures, timeouts, and invalid moderation responses block new image uploads with a retry message. Text edits that reuse existing images still work.

Only Sightengine's `gore-2.0` model is requested. The initial policy rejects scores of 0.70 or higher for very bloody content, exposed organs, serious injuries, or corpses. It does not filter nudity or reject minor injuries, general horror, or skull imagery alone. Scores are not guarantees; tune the threshold in `backend/lib/imageModeration.js` after reviewing real results. Animated GIFs are sampled by the provider, so not every frame is guaranteed to be checked.

Run the offline mocked moderation checks with `node --test backend/lib/imageModeration.test.js`. These tests do not call Sightengine, Cloudinary, or MongoDB.
