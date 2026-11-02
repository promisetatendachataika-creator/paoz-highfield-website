# PAOZ Highfield Assembly website: CMS setup

The website works on its own straight away. These steps switch on the **admin area** (`/admin`), where leaders sign in and update the site without touching code.

Everything runs on **Firebase's free Spark plan**, with **no bank card** needed. It covers hosting, Google sign-in, the database and photo storage. Photos are resized automatically and saved in the database itself.

Allow about 30 minutes the first time.

---

## What's in this folder

```
highfield-cms/
├── firebase.json        hosting + database settings
├── firestore.rules      who can read/change what (security)
├── SETUP.md             this guide
└── public/              the website itself
    ├── index.html       the public site
    ├── admin.html       the admin area
    ├── images/          photos and logo
    └── js/
        ├── cms-config.js   ← your Firebase settings (already filled in)
        ├── site-data.js    built-in content (schedule, ministries, contacts, fallbacks)
        ├── site.js         draws the site
        ├── cms-public.js   loads content from the database
        └── admin.js        the admin area
```

---

## Step 1: Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with the church's Google account (or yours).
2. **Create a project.**
   - Name: `paoz-highfield` or similar.
   - You can switch Google Analytics off.
3. **Create the database.**
   - Left menu: **Build → Firestore Database → Create database**.
   - Choose **Production mode**.
   - Pick the location closest to Zimbabwe, for example `africa-south1` (Johannesburg) if it's listed, otherwise `europe-west1`.
   - The location can't be changed later.
4. **Switch on Google sign-in.**
   - Go to **Build → Authentication → Get started → Google → Enable**.
   - Choose a support email, then **Save**.
5. **Register the website.**
   - Click the ⚙️ icon, then **Project settings → General**.
   - Under **Your apps**, click the **Web** icon (`</>`). Name it "Highfield website" and click **Register app**.
   - Firebase shows a block with `apiKey`, `authDomain`, `projectId` and `appId`.
   - Copy those four values into `public/js/cms-config.js`.
6. **Make yourself the first admin.**
   - Go to **Firestore Database → Data → Start collection**.
   - Collection ID: `admins`.
   - Document ID: your Google email, **all lowercase**, e.g. `name@gmail.com`.
   - Add a field: name `roles`, type **array**, then add one item of type **string** with the value `super`.
   - Click **Save**.

> The `apiKey` is not a secret. It's normal for it to be in the website. Security comes from `firestore.rules`.

---

## Step 2: Sermon notes and recordings (Google Drive)

Photos upload straight into the admin. **PDF notes and audio recordings** go on Google Drive instead, because they're too big for the database:

1. Upload the file to the church's Google Drive.
2. Right-click it and choose **Share → General access → Anyone with the link**.
3. Click **Copy link** and paste it into the sermon's **Sermon notes link** or **Audio link** box in the admin.

---

## Step 3: Put the site online

You need **Node.js** (LTS version) installed from <https://nodejs.org>. Then run these in a terminal inside the `highfield-cms` folder:

```bash
npm install -g firebase-tools     # once per computer
firebase login                    # opens a browser to sign in
firebase use --add                # pick your paoz-highfield project
firebase deploy                   # uploads the site and the security rules
```

When it finishes you'll get two addresses:

- The website: `https://<your-project>.web.app`
- The admin area: `https://<your-project>.web.app/admin`

After any change to the files, run `firebase deploy` again.

**Using a custom web address (e.g. a .co.zw name):** go to **Hosting → Add custom domain** and follow the steps. Then add the same domain under **Authentication → Settings → Authorized domains**, so sign-in works there too.

---

## Step 4: First sign-in

1. Open `/admin` and click **Sign in with Google**, using the email from step 1.6.
2. Go to **Setup & import**:
   - Click **Import leaders**, **Import gallery photos** and **Import serving departments**. This copies everything already on the site into the database, so it can be edited from now on.
   - Do this once.
3. Go to **Admins** and add the other leaders' Google emails with their roles.

---

## Roles

| Role | Can change |
|---|---|
| **Webmaster** (`super`) | Everything, including leaders and the admin list |
| **Media** (`media`) | Sermons, gallery photos and serving departments |
| **Events** (`events`) | Events |
| **Pastoral care** (`pastoral`) | Prayer requests and connection cards (read, mark done, delete) |

Private prayer requests are only visible to people with the **Pastoral care** or **Webmaster** role. The database rules enforce this, not just the admin screen.

---

## Weekly routine

### After Sunday: add the sermon (Media team)

1. Open `/admin`, then **Sermons**, then **Add sermon**.
2. Fill in the title, preacher, date and scripture.
3. Paste the **Facebook or YouTube link** of the live stream.
4. If there are written notes, attach the **PDF**. Add a cover picture if you have one.
5. Click **Add sermon**. It appears on the Sermons page within a minute.

### Photos (Media team)

1. Go to **Gallery**.
2. Choose a category, then drag in several photos at once. They're resized automatically before upload, so the site stays fast on mobile data.
3. Click **Edit** on any photo to improve its caption or mark it **wide**.

### Events (Events coordinator)

1. Go to **Events**, then **Add event**.
2. Fill in the date, time, venue and a short description. You can add a flyer and an optional registration link, such as a Google Form.
3. Tick **Feature at the top** for big events.

Events **hide themselves** the day after they end, so nobody needs to delete them. Visitors can tap **Add to Google Calendar** on any event.

### Prayer requests and visitors (Pastoral team)

- New items show a red count in the side menu.
- Pray or follow up, then click **Mark as prayed** or **Mark as followed up**.

---

## Good to know

- **Still edited in code:** the weekly schedule, ministries, contacts, giving details and page text. Change these in `public/js/site-data.js` and `public/index.html`, then run `firebase deploy`. These could move into the admin later.
- **Free limits (Firebase Spark):**
  - 50,000 database reads a day. Each visit reads roughly one item per sermon, event, photo and leader, which is enough for several hundred visits a day.
  - 1 GB of storage, which is roughly 4,000–5,000 photos.
  - About 10 GB a month of downloads. Thumbnails load first and the large photo only when someone opens it, which keeps usage low.
- **Deleting a photo** in the admin removes both stored copies, freeing the space.
- **Photos that won't upload:** the admin shrinks every photo automatically. If one still fails, send it to yourself on WhatsApp first (which compresses it) and upload that copy.
- **If the database is unreachable,** the site falls back to its built-in content and forms fall back to WhatsApp, so it never shows a blank page.
- **Spam:** the forms have a hidden spam trap and strict size limits in the rules. If spam ever becomes a problem, Firebase **App Check** can be switched on later.
