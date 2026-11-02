# PAOZ Highfield Assembly website

Website and content management system for **PAOZ Highfield Assembly** (Pentecostal Assemblies of Zimbabwe), 2407 Egypt, Highfield, Harare.

**Live site:** https://paoz-highfield.web.app  
**Admin:** https://paoz-highfield.web.app/admin

## Features

- Scroll-animated home page in PAOZ green, with service times and the next gathering worked out automatically
- Pages: I'm New, About (vision, mission, core values, history, leadership), Sermons, Events, Ministries, Gallery, Give and Contact
- Prayer request and visitor connection forms that save to a private pastoral inbox, with WhatsApp as a fallback
- Admin area with Google sign-in and role-based access:
  - **Webmaster:** everything, including leaders and the admin list
  - **Media:** sermons, gallery and serving departments
  - **Events:** events, which hide automatically after they end
  - **Pastoral care:** prayer requests and connection cards
- Photos are resized in the browser and stored in Firestore as a small and a large copy, loaded lazily so the site stays light on mobile data
- Works on Firebase's free Spark plan, with no bank card needed

## Tech

Plain HTML, CSS and JavaScript (no build step), Firebase Hosting, Firebase Authentication (Google), and Cloud Firestore with security rules. The public site reads Firestore through the REST API, so visitors don't download the Firebase SDK.

```
├── firebase.json       hosting + rules config
├── firestore.rules     who can read and change what
├── SETUP.md            step-by-step setup and admin guide
└── public/
    ├── index.html      public site
    ├── admin.html      admin area
    ├── images/
    └── js/
        ├── cms-config.js   Firebase web config (public by design)
        ├── site-data.js    built-in content and fallbacks
        ├── site.js         renders the site
        ├── cms-public.js   loads content from Firestore
        └── admin.js        admin area
```

## Deploy

```bash
npm install -g firebase-tools
firebase login
firebase use --add      # pick paoz-highfield
firebase deploy
```

See [SETUP.md](SETUP.md) for the full guide, including how to add admins.

> The Firebase `apiKey` in `public/js/cms-config.js` is a public identifier, not a secret. Access is controlled by `firestore.rules`.
