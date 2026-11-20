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


### Reader, writer, and admin roles

New signups default to reader; clients cannot choose a privileged signup role. Admins can open Users, choose a user, select Reader or Writer under Story upload access, and save. User cards update immediately. Existing administrator accounts keep their role in this control.

Writers and admins can create stories through the Upload stories button. Editing and soft deletion remain limited to the story's creator. Writer status does not grant access to user administration, feedback administration, or comment moderation, and writers still need to comment to unlock other authors' chapters. Returning to a browser tab refreshes the signed-in user's role; a page refresh also picks up role changes. Demoting a writer removes permission to upload new stories while preserving ownership and editing of their existing stories.

Run `node --test backend/lib/userRoles.test.js` for offline role and ownership checks.


### Story content ratings

Stories have a `contentRating` field: `unrated`, `everyone`, `teen`, or `mature`. Authors choose it in the upload/edit form, and the label appears on library cards and the reading page. Existing stories remain Unrated until their author chooses a rating; there is no automatic classification of older content. These are author-selected content labels. They do not add an age gate or block reading.

Ratings are validated on the server and saved with the story. Older clients that omit the field during an update preserve the current rating. Run `node --test backend/lib/storyRatings.test.js` for offline validation, persistence, and response checks.


### Mature story visibility

Mature stories are hidden from the library and its featured-story link by default, for guests and every account role. Signed-in users can enable Show mature stories in the profile menu. The boolean `showMatureStories` preference is saved to the user account and restored at login. Missing preferences on older accounts are treated as off. The library API applies the filter using the authenticated account's preference, and responses are private and uncached. Everyone, Teen, and Unrated stories remain visible.

Changing the toggle refreshes the library without reloading the page. Turning it off or signing out clears the previous library display while the filtered list loads. This controls discovery in the library; direct story links remain readable, and author/editor access is unchanged. It is not age verification. Run `node --test backend/lib/maturePreferences.test.js` for offline preference and visibility checks.


### Story invitations

A story's creator can use Invite readers on the reading page, search a username prefix (at least two characters), and invite a matching reader. Search results show at most ten public usernames and current pictures. Recipients receive a `story_invite` bell notification linking directly to the story; existing chapter access and reading-position restoration still apply. The bell refreshes when opened, on focus, and every 30 seconds.

Allow story invitations is on by default and can be disabled in the profile menu. Opted-out recipients and the sender are excluded. Invitations to Mature stories can be sent and viewed regardless of Show mature stories; that setting applies only to library discovery. Mature invitations are labeled Mature, and the separate invitation opt-out is always respected.

A unique partial notification index prevents more than one unread invitation per recipient/story, including concurrent sends. Authors can send up to 20 invitations per rolling 24 hours, reserved atomically using a private per-account quota array; failed or duplicate inserts release their reservation. Reading an invitation allows a later invitation within the daily limit. Only story creators can search invitees or send invitations. The invitation index is created automatically along with the existing notification index migration.

Run `node --test backend/lib/storyInvitations.test.js` for offline invitation, privacy, preference, quota, and destination checks.


### Private chapter drafts and publishing

New chapters in the editor start as Draft. Save changes stores unfinished titles/text and images without publishing them. The chapter visibility selector switches between Draft (private) and Published (visible to readers), taking effect on save. Published chapters need a title and text and must form the beginning of the chapter sequence; publish earlier chapters before later ones. To unpublish an earlier chapter, first mark later chapters Draft. Existing chapters without a status remain published, and update requests that omit an existing chapter's status preserve it. New API chapters without an explicit status are drafts.

A private Your drafts section on the home page links the creator back to their editor, including stories with no published chapters. Stories containing only drafts are excluded from the public library and direct reader requests. Public chapter lists, discussions, comments, reaction endpoints, bookmark restoration, invitations, and notifications exclude draft chapters. The creator's protected editor returns all chapters, including incomplete drafts. Other users, including other admins, cannot access that editor.

Saving drafts sends no new-chapter notifications. Publishing a previously saved draft sends the usual notification to participating readers, using chapter IDs and unique notification indexes to avoid duplicates for the same recipient/chapter. Comments and reading-progress markers are preserved when chapters are unpublished or republished. The library description comes from the first published chapter, never private draft text.

This adds publication controls for whole chapters; edits to a chapter that remains Published become public when saved. It does not keep a separate private revision of a published chapter.

Run `node --test backend/lib/chapterDrafts.test.js` for offline publication, privacy, persistence, progression, and notification checks.
