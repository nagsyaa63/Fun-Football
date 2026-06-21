# Fun Football - Quick Start Guide

## 🚀 What Changed?

### New Structure
```
Before: Single page (index.html) with everything
After: Three pages - Home, Predictions, Leaderboard
```

### Navigation
- **Hamburger Menu** (☰) - Opens side navigation with all features
- **Fixed Header** - Stays at top when scrolling
- **Direct Links** - Quick access to Predictions and Leaderboard from header

## 📱 User Journey

### 1. Home Page (`/` or `/index.html`)
- Welcome message
- User stats card (when logged in)
- Two main buttons:
  - ⚽ **View Predictions** → Takes you to predictions page
  - 🏆 **View Leaderboard** → Takes you to leaderboard page
- Three feature cards explaining the app
- Footer with social links

### 2. Predictions Page (`/predictions.html`)
- All match predictions
- Color-coded cards:
  - 🟢 Green = Open for predictions
  - 🟠 Orange = Locked
  - 🟡 Yellow = Finished
- Save predictions for each match
- See results and your earned points

### 3. Leaderboard Page (`/leaderboard.html`)
- Global and league leaderboards
- Four tabs: Overall, Giant Slayer, MVP, Average
- Your ranking and stats
- Giant Slayer spotlight

## 🎨 Key Features

### Header (All Pages)
```
[☰ Menu] [⚽ Logo] [App Name]        [⚽ Predictions] [🏆 Leaderboard] [🌙 Theme] [👤 Profile] [Log in]
```

### Side Navigation
Click hamburger (☰) to open:
- 🏠 Home
- ⚽ Predictions
- 🏆 Leaderboard
- 👤 Profile (logged in)
- 🔑 Log in / Sign up
- ❓ How Scoring Works
- 🏟️ Friend Leagues
- 🌙 Toggle Theme

### Footer (All Pages)
- **Brand**: Logo and tagline
- **Social**: Instagram, Facebook, Contact
- **Links**: Home, Predictions, Leaderboard, Admin

## 🎯 Testing the New UI

### Desktop
1. Open `http://localhost:PORT/` in browser
2. Click hamburger - side nav should slide in
3. Click "View Predictions" - should go to predictions page
4. Click "View Leaderboard" - should go to leaderboard page
5. Use header links to navigate
6. Toggle theme (🌙) - should switch dark/light

### Mobile (or resize browser to ~375px)
1. Hamburger always visible
2. Header links may be hidden (very small screens)
3. Side nav is primary navigation
4. Match cards stack vertically
5. Footer columns stack
6. All buttons full-width

## 🔧 Files Modified

### HTML
- ✅ `public/index.html` - Complete redesign
- ✅ `public/predictions.html` - New file
- ✅ `public/leaderboard.html` - New file

### CSS
- ✅ `public/css/styles.css` - Enhanced with new components

### JavaScript
- ✅ `public/js/shared.js` - New shared utilities
- ✅ `public/js/home.js` - New home page logic
- ✅ `public/js/predictions.js` - New predictions logic
- ✅ `public/js/leaderboard.js` - New leaderboard logic
- ℹ️ `public/js/app.js` - Original (can keep for reference)

## 💡 Quick Fixes

### Side nav not opening?
Check browser console for errors in `shared.js`

### Header not fixed?
Check CSS - `.site-header` should have `position: fixed`

### Pages not loading?
Check that all `<script>` tags include `shared.js` first:
```html
<script src="/js/shared.js"></script>
<script src="/js/home.js"></script>
```

### Theme not persisting?
Check localStorage in browser dev tools for `ff_theme` key

### Mobile view issues?
Test at these widths:
- 320px (small phone)
- 375px (iPhone)
- 768px (tablet)
- 1024px (desktop)

## 🎨 Color Scheme

### Match Cards (Predictions)
- **Open**: Green left border (`--primary`)
- **Locked**: Orange left border (`--warn`)
- **Finished**: Yellow left border (`--accent`)

### Status Tags
- **Open**: Green background with "Open"
- **Locked**: Orange background with "Locked"
- **Finished**: Gray background with "Finished"

## 📊 API Endpoints (Unchanged)
All existing API endpoints still work:
- `GET /api/matches` - Get matches
- `POST /api/predictions` - Save prediction
- `GET /api/leaderboards` - Get leaderboards
- `POST /api/users/join` - Login/signup
- etc.

## ✅ Checklist

- [ ] Home page displays correctly
- [ ] Hamburger menu works
- [ ] Navigation between pages works
- [ ] Predictions can be saved
- [ ] Leaderboard displays
- [ ] Login/signup works
- [ ] Profile modal works
- [ ] Theme toggle works
- [ ] Mobile responsive
- [ ] Footer links work
- [ ] All modals open/close
- [ ] Sidenav closes when clicking outside

## 🐛 Common Issues

### "FF is not defined"
Make sure `shared.js` is loaded before other JS files

### Sidenav won't close
Click outside or press ESC key

### Stats card not showing buttons
Only shows when user is logged in

### Header overlapping content
Check `main.container` has `margin-top: 80px`

---

**Ready to Go!** 🎉

The new structure is cleaner, more organized, and mobile-friendly. Users can now navigate easily between different sections of the app.
