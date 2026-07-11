# 🔑 Tokens Guide — GitHub Edit/Delete Only for accessible-board-games + Neon DB Both Tokens

You asked: "access all and edit delete in GitHub there is a token for really neon to version"

## PART 1: GitHub Token — Only for accessible-board-games (Not All Repos)

You already shared a classic token `ghp_eUM0...` that has access to ALL your repos. That's okay but for security, better to create **Fine-Grained PAT** that only has access to `accessible-board-games`.

### How to Create Token for ONLY accessible-board-games (Lenovo Tab Friendly):

1. **Go to:** https://github.com/settings/tokens?type=beta
   (This is Fine-grained personal access tokens)

2. **Tap:** Generate new token

3. **Form:**
   - **Token name:** `accessible-board-games-edit-delete`
   - **Expiration:** 30 days (or 7 days)
   - **Description:** Token for editing accessible-board-games repo only

4. **Repository access:** Select **Only select repositories** → Choose **Mahicouragw/accessible-board-games** (tap it)

5. **Permissions:** (Very Important for edit/delete)
   - Click **Repository permissions**
   - Set:
     - **Contents:** Read and write (to edit/delete files)
     - **Metadata:** Read-only (auto)
     - **Pull requests:** Read and write (optional, for versioning)
     - **Workflows:** Read and write (for APK builds)
   - You can also tap **Select all** for that repo if you want full control

6. **Generate token** → Copy token `github_pat_...` (starts with `github_pat_`)

7. **Use token to edit/delete:**
   - This token can ONLY edit `accessible-board-games`, not your other repos
   - To edit file via API (I can do for you if you paste):
     ```bash
     # Example: Delete a file via API
     curl -X DELETE -H "Authorization: token YOUR_FINE_GRAINED_TOKEN" \
     https://api.github.com/repos/Mahicouragw/accessible-board-games/contents/old-file.zip \
     -d '{"message":"delete old zip","sha":"file-sha"}'
     ```

### Classic vs Fine-Grained:

- **Classic `ghp_...`** you shared: Has access to ALL repos with repo scope (edit/delete anywhere) — works but risky
- **Fine-grained `github_pat_...`** : Only `accessible-board-games` — safer, recommended

**Delete old classic token after creating fine-grained:** https://github.com/settings/tokens → Delete `fix-accessible-board-games`

---

## PART 2: Neon Database — Both DATABASE_URL and API Key

You need **both** for full version management.

### What is What:

1. **DATABASE_URL** (Connection String) — Used by your app to connect to DB:
   - Example: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
   - Where to add:
     - Vercel → Project → Settings → Environment Variables → Add `DATABASE_URL`
     - Local `.env` file: `DATABASE_URL=postgresql://...`

2. **NEON_API_KEY** — Used to manage database versions/branches via API:
   - Example: `napi_xxx...`
   - Where to get: Neon Dashboard → https://console.neon.tech → Your project → Settings → API Keys → Create
   - What it does: Create branches for versioning (e.g., `v1`, `v2`, `testing`), restore, etc.

### How to Get Both (Lenovo Tab Steps):

#### A. Get DATABASE_URL:

1. Go to https://console.neon.tech → Login
2. Tap your project `accessible-board-games` (or create new)
3. Tap **Dashboard** → **Connection String** → Copy **Connection string** (with pooling, with password)
4. It looks like: `postgresql://alex:AbC123@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require`
5. This is your `DATABASE_URL` — add to Vercel and `.env`

#### B. Get NEON_API_KEY:

1. Same Neon dashboard → Top right avatar → **Account settings** → **API keys** (or https://console.neon.tech/app/settings/api-keys)
2. Tap **Create new API key** → Name: `accessible-board-games-versioning` → Create
3. Copy key: `napi_...` — this is secret, don't share publicly
4. Save in `.env` as:
   ```
   NEON_API_KEY=napi_xxx
   NEON_PROJECT_ID=your-project-id (from Neon dashboard URL)
   ```

### How Neon Versioning Works (Database Branching):

Neon has **Git-like branching for databases**:

- **Main branch:** Your production DB (players, scores etc)
- **Create branch for testing:** You can create `dev` or `v2` branch to test new features without breaking main
- **API Example:**

```bash
# List branches
curl -H "Authorization: Bearer $NEON_API_KEY" \
  https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches

# Create new branch "v2-features" from main
curl -X POST -H "Authorization: Bearer $NEON_API_KEY" -H "Content-Type: application/json" \
  -d '{"branch":{"name":"v2-features","parent_id":"br-main-id"}}' \
  https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches
```

I added script `scripts/neon-branch.js` in your repo to do this easily.

### Your Current Setup:

- **GitHub repo:** https://github.com/Mahicouragw/accessible-board-games (I pushed fixed code, removed ZIPs, added DB + APK)
- **Vercel:** https://accessible-board-games.vercel.app → 200 LIVE, but needs DATABASE_URL for multiplayer full features (currently guest mode)
- **APK:** Being built via GitHub Actions → Actions tab → Build APK → Download artifact

### What to Do Next:

1. **Delete old classic token** `ghp_eUM0...` you shared (security)
2. **Create fine-grained token** for only `accessible-board-games` if you want edit/delete only that repo
3. **Create Neon project** → Get `DATABASE_URL` + `NEON_API_KEY`
4. **Add DATABASE_URL to Vercel** env vars → Redeploy → Multiplayer works
5. **Use `scripts/neon-branch.js` to version your database:**

```bash
# After setting NEON_API_KEY and NEON_PROJECT_ID in .env
node scripts/neon-branch.js list
node scripts/neon-branch.js create v2-new-games
```

---

### Quick Token Links (Tap on Lenovo Tab):

- **GitHub Fine-Grained Token (only accessible-board-games):** https://github.com/settings/tokens?type=beta
- **GitHub Classic Token (all repos, like you shared):** https://github.com/settings/tokens/new
- **Neon Dashboard (get DATABASE_URL):** https://console.neon.tech
- **Neon API Keys (get napi_...):** https://console.neon.tech/app/settings/api-keys

Paste your Neon DATABASE_URL here if you want me to set it up for you (I will add to Vercel env instructions).
