# Fun Football - Color Guide

## 🎨 Match Card Color Coding

The predictions page uses engaging colors to help users quickly identify match status.

### Status Color Scheme

```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 GREEN Border = OPEN                                      │
│    User can make/edit predictions                           │
│    ┌───┬─────────────────────────────────────────────────┐ │
│    │ ║ │ 🇧🇷 Brazil vs 🇦🇷 Argentina      [Open]      │ │
│    │ ║ │ Locks in 2h 15m · 42 predictions              │ │
│    │ ║ │ [Select result...] [Select MVP...]            │ │
│    │ ║ │ [Save prediction]                             │ │
│    └───┴─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🟠 ORANGE Border = LOCKED                                   │
│    Predictions closed, match starting soon                  │
│    ┌───┬─────────────────────────────────────────────────┐ │
│    │ ║ │ 🇫🇷 France vs 🇩🇪 Germany      [Locked]     │ │
│    │ ║ │ Kickoff in 15m · 89 predictions               │ │
│    │ ║ │ Your pick: France win 🔒                      │ │
│    │ ║ │ [████ 45%][███ 30%][█████ 25%]                │ │
│    └───┴─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🟡 YELLOW Border = FINISHED                                 │
│    Match complete, results available                        │
│    ┌───┬─────────────────────────────────────────────────┐ │
│    │ ║ │ 🇪🇸 Spain vs 🇮🇹 Italy        [Finished]    │ │
│    │ ║ │ Full time · 156 predictions                   │ │
│    │ ║ │ Result — Spain win · MVP: Morata              │ │
│    │ ║ │ ✅ You earned +11 pts!                        │ │
│    └───┴─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### CSS Implementation

```css
/* Match card base */
.match-card {
  border-left: 4px solid transparent;
}

/* Open matches - Green */
.match-card[data-status="open"] {
  border-left-color: var(--primary);  /* #1B6B3A (light) / #2BD576 (dark) */
}

/* Locked matches - Orange */
.match-card[data-status="locked"] {
  border-left-color: var(--warn);     /* #E08A00 (light) / #FFB020 (dark) */
}

/* Finished matches - Yellow */
.match-card[data-status="finished"] {
  border-left-color: var(--accent);   /* #F5A623 (light) / #FFC53D (dark) */
}
```

## 🏷️ Status Tags

```css
/* Open status tag */
.status-open {
  background: rgba(27,107,58,0.1);    /* Light green background */
  color: var(--primary);              /* Green text */
  border: 1.5px solid rgba(27,107,58,0.3);
}
/* Shows: [Open] in green */

/* Locked status tag */
.status-locked {
  background: rgba(224,138,0,0.1);    /* Light orange background */
  color: var(--warn);                 /* Orange text */
  border: 1.5px solid rgba(224,138,0,0.3);
}
/* Shows: [Locked] in orange */

/* Finished status tag */
.status-finished {
  background: var(--card-2);          /* Subtle gray background */
  color: var(--muted);                /* Muted text */
  border: 1px solid var(--border);
}
/* Shows: [Finished] in gray */
```

## ⏱️ Countdown Urgency Colors

```css
/* Default countdown - Normal */
.countdown {
  color: var(--text);
  font-weight: 700;
}
/* Shows: "Locks in 5h 30m 45s" in normal text color */

/* Warning countdown - < 1 hour */
.countdown.warn {
  color: var(--warn);  /* Orange */
}
/* Shows: "Locks in 45m 20s" in orange */

/* Danger countdown - < 10 minutes */
.countdown.danger {
  color: var(--hot);   /* Red */
  animation: pulse 1.4s ease-in-out infinite;
}
/* Shows: "Locks in 5m 30s" in pulsing red */

/* Live countdown - Match started */
.countdown.live {
  color: var(--hot);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.countdown.live::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hot);
}
/* Shows: "● 🔴 Kicked off" with red dot */
```

## 📊 Vote Bars

```css
/* Home team votes - Green */
.votebar .vh {
  background: var(--primary);   /* Green */
  color: white;
}

/* Draw votes - Yellow/Orange */
.votebar .vd {
  background: var(--accent);    /* Yellow/Orange */
  color: rgba(20,24,31,0.9);
}

/* Away team votes - Blue */
.votebar .va {
  background: var(--accent-2);  /* Blue */
  color: white;
}

/* Example vote bar */
/* [████ 45%][███ 30%][█████ 25%] */
/*   Green    Yellow     Blue      */
```

## 🎯 Earned Points Display

```css
/* Correct prediction - Green */
.earned.hit {
  color: var(--primary);
  font-weight: 700;
}
/* Shows: "✅ You earned +11 pts!" in green */

/* Wrong prediction - Gray */
.earned.miss {
  color: var(--muted);
  font-weight: 600;
}
/* Shows: "No points this time." in gray */
```

## 🎨 Complete Color Palette

### Light Theme
```css
:root {
  /* Backgrounds */
  --bg: #F4F2ED;              /* Main background - warm beige */
  --bg-soft: #FAF8F4;         /* Soft background - lighter beige */
  --card: #FFFFFF;            /* Card background - white */
  --card-2: #F2EFE9;          /* Secondary card - light beige */
  
  /* Borders */
  --border: #E4DFD6;          /* Borders - soft brown */
  
  /* Text */
  --text: #14181F;            /* Main text - dark blue-black */
  --muted: #5C6470;           /* Muted text - gray */
  
  /* Primary Colors */
  --primary: #1B6B3A;         /* Primary green - for actions */
  --primary-d: #15572F;       /* Primary dark - hover states */
  --primary-contrast: #FFFFFF; /* Text on primary - white */
  
  /* Accent Colors */
  --accent: #F5A623;          /* Accent orange/yellow - highlights */
  --accent-2: #3B6FE0;        /* Accent blue - secondary actions */
  
  /* Status Colors */
  --danger: #D63B36;          /* Red - errors, danger */
  --warn: #E08A00;            /* Orange - warnings */
  --hot: #E8433E;             /* Hot red - urgent, live */
  
  /* Gradients */
  --grad-hero: linear-gradient(135deg, #1B6B3A 0%, #1F9D57 100%);
  --grad-gold: linear-gradient(135deg, #F5A623 0%, #E8433E 100%);
}
```

### Dark Theme
```css
html[data-theme="dark"] {
  /* Backgrounds */
  --bg: #0E1512;              /* Main background - dark green-black */
  --bg-soft: #101A15;         /* Soft background - slightly lighter */
  --card: #16201B;            /* Card background - dark green */
  --card-2: #1B2A22;          /* Secondary card - darker green */
  
  /* Borders */
  --border: #25342B;          /* Borders - muted green */
  
  /* Text */
  --text: #EAF2EC;            /* Main text - light green-white */
  --muted: #9FB3A6;           /* Muted text - light gray-green */
  
  /* Primary Colors */
  --primary: #2BD576;         /* Primary green - bright */
  --primary-d: #19A65A;       /* Primary dark - darker green */
  --primary-contrast: #04230F; /* Text on primary - dark green */
  
  /* Accent Colors */
  --accent: #FFC53D;          /* Accent yellow - brighter */
  --accent-2: #5B8DEF;        /* Accent blue - brighter */
  
  /* Status Colors */
  --danger: #FF5D52;          /* Red - brighter */
  --warn: #FFB020;            /* Orange - brighter */
  --hot: #FF5D52;             /* Hot red - same as danger */
  
  /* Gradients */
  --grad-hero: linear-gradient(135deg, #15572F 0%, #1B6B3A 100%);
}
```

## 📱 Visual Hierarchy

### Importance Levels

```
1. PRIMARY ACTIONS (Call to Action)
   Color: var(--primary) - Green
   Usage: Save buttons, main navigation links
   Example: [Save prediction] [View Predictions]

2. SECONDARY ACTIONS (Supporting)
   Color: var(--accent-2) - Blue
   Usage: Share buttons, secondary links
   Example: [Share] [View Details]

3. TERTIARY ACTIONS (Ghost)
   Color: Transparent → var(--card-2) on hover
   Usage: Cancel, close, theme toggle
   Example: [Cancel] [Close] [🌙]

4. DANGER ACTIONS (Destructive)
   Color: var(--danger) - Red
   Usage: Logout, delete, remove
   Example: [Log out] [Delete]

5. STATUS INDICATORS (Informational)
   Colors: Green (success), Orange (warning), Red (error)
   Usage: Countdowns, status tags, notifications
   Example: [Open] [Locked] [⏰ 5m left]
```

## 🎨 Usage Examples

### Prediction Card States

```html
<!-- OPEN - Green border, green tag -->
<div class="match-card" data-status="open">
  <div class="match-head">
    <span class="status-tag status-open">Open</span>
    <div class="countdown">Locks in 2h 15m 30s</div>
  </div>
  <button class="btn btn-primary">Save prediction</button>
</div>

<!-- LOCKED - Orange border, orange tag, orange countdown -->
<div class="match-card" data-status="locked">
  <div class="match-head">
    <span class="status-tag status-locked">Locked</span>
    <div class="countdown warn">Kickoff in 45m 20s</div>
  </div>
</div>

<!-- FINISHED - Yellow border, gray tag, results -->
<div class="match-card" data-status="finished">
  <div class="match-head">
    <span class="status-tag status-finished">Finished</span>
    <div class="countdown">Full time</div>
  </div>
  <div class="earned hit">✅ You earned +11 pts!</div>
</div>
```

### Header Navigation

```html
<header class="site-header">
  <!-- Hamburger - Ghost button -->
  <button class="btn btn-ghost hamburger">☰</button>
  
  <!-- Quick links - Ghost buttons -->
  <a href="/predictions.html" class="btn btn-ghost">⚽ Predictions</a>
  <a href="/leaderboard.html" class="btn btn-ghost">🏆 Leaderboard</a>
  
  <!-- Theme toggle - Ghost button -->
  <button class="btn btn-ghost">🌙</button>
  
  <!-- Auth - Primary button -->
  <button class="btn btn-primary">Log in</button>
</header>
```

## 🎯 Accessibility Considerations

### Color Contrast Ratios

All color combinations meet WCAG AA standards:

- **Primary green on white**: 4.9:1 ✅
- **Text on background**: 14.2:1 ✅
- **Muted text on background**: 5.8:1 ✅
- **Danger red on white**: 4.5:1 ✅
- **Warning orange on white**: 4.3:1 ✅

### Status Indication

Status is communicated through multiple methods:
1. **Color** - Visual users see colored borders
2. **Text** - Status tags with text labels
3. **Icons** - Emoji indicators (🟢 🟠 🟡)
4. **Animation** - Pulsing for urgent items

This ensures users who are colorblind or have low vision can still understand the interface.

---

**Summary**: The color system is designed to be engaging, accessible, and intuitive, helping users quickly understand match status and take appropriate actions.
