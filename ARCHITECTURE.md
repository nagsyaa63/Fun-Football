# Fun Football - Architecture Overview

## 📐 Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         FIXED HEADER                             │
│  [☰] [⚽ Logo] [App Name]  [Predictions] [Leaderboard] [🌙] [👤] │
└─────────────────────────────────────────────────────────────────┘
     │
     ├─[Click ☰]→ SIDE NAVIGATION PANEL
     │            ┌──────────────────────┐
     │            │ Menu            [✕]  │
     │            ├──────────────────────┤
     │            │ 🏠 Home              │
     │            │ ⚽ Predictions       │
     │            │ 🏆 Leaderboard      │
     │            │ 👤 Profile          │
     │            │ 🔑 Log in           │
     │            │ ❓ How Scoring      │
     │            │ 🏟️ Leagues         │
     │            │ ─────────────────   │
     │            │ 🌙 Toggle Theme     │
     │            └──────────────────────┘
     │
┌────┴─────────────────────────────────────────────────────────────┐
│                         MAIN CONTENT                              │
│                      (Changes by page)                            │
└───────────────────────────────────────────────────────────────────┘
│
┌───────────────────────────────────────────────────────────────────┐
│                           FOOTER                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐            │
│  │  Brand   │  │  Social      │  │  Quick Links   │            │
│  │  ⚽       │  │  📸 Instagram│  │  Home          │            │
│  │  Fun FB  │  │  👍 Facebook │  │  Predictions   │            │
│  │          │  │  ✉️ Contact  │  │  Leaderboard   │            │
│  └──────────┘  └──────────────┘  └────────────────┘            │
└───────────────────────────────────────────────────────────────────┘
```

## 🏠 Home Page (`/index.html`)

```
┌───────────────────────────────────────────────────────────────────┐
│                      Welcome to Fun Football                      │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 👤 Your Stats Card (when logged in)                         │ │
│  │ 🏆 Title: Champion · Points: 150 · Matches: 10 · Acc: 80%  │ │
│  │ Progress: ████████░░ 80% to next title                     │ │
│  │                                                              │ │
│  │ [⚽ View Predictions]  [🏆 View Leaderboard]               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│  │    ⚽     │  │    🏆     │  │    🗡️    │                   │
│  │   Make   │  │  Compete  │  │   Giant   │                   │
│  │   Pred   │  │    on     │  │  Slayer   │                   │
│  │  ictions │  │  Boards   │  │   Points  │                   │
│  │          │  │           │  │           │                   │
│  │ [Start]  │  │  [View]   │  │  [Learn]  │                   │
│  └───────────┘  └───────────┘  └───────────┘                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 📢 Promo Box (admin configurable)                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## ⚽ Predictions Page (`/predictions.html`)

```
┌───────────────────────────────────────────────────────────────────┐
│                    ⚽ Match Predictions                            │
│  Predict each match's result + MVP. Bold calls score more.       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ⏰ Lock Banner (if matches locking soon)                        │
│  3 matches lock within 6h - make your predictions!               │
│                                                                   │
│  🟢 Open — predict now                                 [5]       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🇧🇷 Brazil vs 🇦🇷 Argentina              [Group A] [Open] │ │
│  │ Locks in 2h 15m 30s · 42 predictions                        │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ 🏆 Match result:  [Select team...]                          │ │
│  │ ⭐ MVP:           [Select player...]                         │ │
│  │ [Save prediction]  ✓ saved                                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  🔒 Locked — awaiting result                          [3]       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🇫🇷 France vs 🇩🇪 Germany                [R16] [Locked]   │ │
│  │ 🔒 Locked · kickoff in 45m 20s · 89 predictions             │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ What 89 predictors picked:                                  │ │
│  │ [████ 45%][███ 30%][█████ 25%]                              │ │
│  │ 🇫🇷 45% · 🤝 30% · 🇩🇪 25%                                  │ │
│  │ Your pick: France win 🔒                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ✅ Finished — results in                             [2]       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🇪🇸 Spain vs 🇮🇹 Italy                [Final] [Finished]  │ │
│  │ Full time · 156 predictions                                 │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ What 156 predictors picked:                                 │ │
│  │ [███ 35%][██ 20%][█████ 45%]                                │ │
│  │                                                              │ │
│  │ Result — Spain win · ⭐ MVP: Morata                         │ │
│  │ 🗡️ Only 35% backed Spain → correct picks earned +8 pts     │ │
│  │ ✅ You earned +11 pts (🗡️ 8 + ⭐ 3)!                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## 🏆 Leaderboard Page (`/leaderboard.html`)

```
┌───────────────────────────────────────────────────────────────────┐
│                       🏆 Leaderboard                              │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 🗡️ Giant Slayer Spotlight                                   │ │
│  │ Boldest call: Draw in Brazil vs Argentina — only 12%        │ │
│  │ backed it, earning +9 pts for the 18 who did! 👏            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Showing: [🌍 Global ▼]                                          │
│                                                                   │
│  [Overall] [🗡️ Giant Slayer] [⭐ MVP] [📊 Average]              │
│  Total points = Giant Slayer + MVP points.                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  #  │ Player              │ M  │ Acc │ Points              │ │
│  ├─────┼────────────────────┼────┼─────┼────────────────────┤ │
│  │ 🥇  │ messi_fan10 🇦🇷    │ 15 │ 87% │ 245 pts            │ │
│  │ 🥈  │ cr7_lover           │ 14 │ 79% │ 210 pts            │ │
│  │ 🥉  │ football_king       │ 15 │ 73% │ 195 pts            │ │
│  │  4  │ you_username YOU    │ 12 │ 75% │ 150 pts            │ │
│  │  5  │ soccer_pro          │ 10 │ 80% │ 140 pts            │ │
│  │ ... │ ...                 │... │ ...│ ...                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  📍 Your standing: #4 of 1,234 · 150 pts                         │
│  🕒 Last updated: Jun 21, 2026, 10:30 AM IST                     │
│                                                                   │
│  Titles: 🐐 GOAT · 1000+ | 👑 Champion · 500+                   │
└───────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │
       ├── Load shared.js (utilities, auth, sidenav)
       │   └── Initialize theme, sidenav, event listeners
       │
       ├── Load page-specific JS (home/predictions/leaderboard)
       │   │
       │   ├── GET /api/public/settings
       │   │   └── Configure page title, settings
       │   │
       │   ├── GET /api/teams
       │   │   └── Load team list
       │   │
       │   ├── GET /api/matches?userId=X
       │   │   └── Load matches with user predictions
       │   │
       │   ├── GET /api/leaderboards
       │   │   └── Load ranking data
       │   │
       │   ├── GET /api/users/:id/stats
       │   │   └── Load user stats
       │   │
       │   └── Render page content
       │
       └── User Interactions
           │
           ├── POST /api/predictions
           │   └── Save match prediction
           │
           ├── POST /api/users/join
           │   └── Login / signup
           │
           ├── POST /api/users/profile
           │   └── Update profile
           │
           ├── POST /api/leagues
           │   └── Create league
           │
           └── POST /api/leagues/join
               └── Join league
```

## 📁 File Dependencies

```
index.html
├── css/styles.css
├── js/shared.js
└── js/home.js

predictions.html
├── css/styles.css
├── js/shared.js
└── js/predictions.js

leaderboard.html
├── css/styles.css
├── js/shared.js
└── js/leaderboard.js
```

## 🎨 Component Breakdown

### Shared Components (All Pages)
1. **Fixed Header**
   - Hamburger button
   - Logo + app name
   - Quick links
   - Theme toggle
   - Auth/profile button

2. **Side Navigation**
   - Menu items
   - Close button
   - Backdrop overlay

3. **Modals**
   - Auth modal (login/signup)
   - Profile modal
   - Scoring explainer
   - Leagues modal

4. **Footer**
   - Brand section
   - Social links
   - Quick links

### Home Page Components
1. Stats card with action buttons
2. Feature cards (3 columns)
3. Promo box

### Predictions Page Components
1. Lock banner
2. Match groups (Open/Locked/Finished)
3. Match cards with:
   - Header (teams, stage, status)
   - Body (form or results)
   - Vote bars
   - Countdowns

### Leaderboard Page Components
1. Spotlight section
2. League selector
3. Tab navigation
4. Rankings table
5. User standing
6. Titles legend

## 🔐 Authentication Flow

```
User Not Logged In
       │
       ├── Click [Log in] or [🔑 Log in]
       │        ↓
       │   Auth Modal Opens
       │        ↓
       │   Enter username + password
       │        ↓
       │   Click [Continue]
       │        ↓
       │   POST /api/users/join
       │        ↓
       ├── Success?
       │   ├── Yes → Save user to localStorage
       │   │        → Update UI (show profile, hide auth)
       │   │        → Load user data (stats, leagues)
       │   │        → Show success toast
       │   │
       │   └── No  → Show error message in modal
       │
User Logged In
       │
       ├── Click [👤 Profile]
       │        ↓
       │   Profile Modal Opens
       │        ↓
       │   Edit profile
       │        ↓
       │   Click [Save]
       │        ↓
       │   POST /api/users/profile
       │        ↓
       │   Update localStorage
       │        ↓
       │   Show success toast
       │
       └── Click [Log out]
                ↓
           Clear localStorage
                ↓
           Update UI (show auth, hide profile)
                ↓
           Reload data
```

## 🎯 Routing

```
Browser URL               →  File                →  JavaScript
────────────────────────────────────────────────────────────────
/                         →  index.html          →  home.js
/index.html               →  index.html          →  home.js
/predictions.html         →  predictions.html    →  predictions.js
/leaderboard.html         →  leaderboard.html    →  leaderboard.js
/admin                    →  admin.html          →  admin.js
```

## 💾 LocalStorage Usage

```javascript
localStorage Items:
├── ff_theme          // 'light' or 'dark'
└── ff_user           // { id, username, token, fanTeamId }
```

## 🎨 CSS Variables (Theme System)

```css
Light Theme:
--bg: #F4F2ED
--card: #FFFFFF
--text: #14181F
--primary: #1B6B3A
--accent: #F5A623

Dark Theme:
--bg: #0E1512
--card: #16201B
--text: #EAF2EC
--primary: #2BD576
--accent: #FFC53D
```

---

This architecture provides a clean, scalable foundation for the Fun Football application with clear separation of concerns and easy maintenance.
