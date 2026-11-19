# INDIA DRIVE 🇮🇳 (Indian GTA version)

A tiny **2D top-down GTA-style open-world prototype** set in a Mumbai-inspired city.
Pure vanilla JavaScript + Canvas. **No dependencies. No build step.**

> Not GTA 6 — a weekend-sized playable proto: drive autos through honking traffic,
> run parcel missions for cash, and dodge the havaldar when your wanted stars go up.

## ▶ Run it locally

No install needed. Either of:

```bash
# Option 1 — Node
npx serve .          # then open http://localhost:3000

# Option 2 — Python
python3 -m http.server 8000   # then open http://localhost:8000

# Option 3 — just double-click index.html (works over file:// too)
```

## 🎮 Controls

| Key | Action |
|-----|--------|
| `W A S D` / Arrows | Walk / drive |
| `SHIFT` | Sprint |
| `E` | Enter / exit vehicle (near a moving one = carjack: driver thrown out, +1★) |
| `H` | Horn — scatters pedestrians, freezes traffic (very Mumbai) |
| `M` | Sound on/off |
| `P` | Pause |

## 🔊 Sound system
Real-time WebAudio synth (no files):
- Engine rumble that pitches up with speed
- Two-tone Indian horns from you and the AI traffic (they honk when you block them)
- Police siren with LFO wail when cops are on you
- Distant city honks as ambient
- Crash noise bursts, cash register blips, busted jingle

## 🌆 Mumbai flavor

- **Left-hand traffic** with auto-rickshaws, BEST-style buses, scooters and
  trucks that say *HORN OK PLEASE*
- Landmark-style building signs: *Marine Drive Dhaba, Bandra Bakery, Colaba Cafe,
  Chowpatty Corner…*
- Constant two-tone honking from AI traffic that you blocking the road will trigger
- Parcel missions between road-side stalls for ₹350 a delivery

## 🎨 Services

- **🎨 Pay-N-Spray** (green marker, ₹300): drive in with a wanted level — the car
  gets resprayed and your stars go to zero
- **☕ Chai stalls** (orange marker, ₹50): stand next to one on foot to heal +40

## 🌆 Day / night
A full cycle every ~2.5 minutes: dusk tints to deep blue night, headlights sweep
the roads and streetlamps glow at intersections.

## 🚓 Crime & police

- Running over pedestrians, ramming traffic, or carjacking raises your **wanted stars (1–5)**
- 1★: foot cops chase. 2★+: patrol cars hunt you down and ram
- Stay out of sight for a few seconds and stars decay; get caught → **BUSTED**
  (₹150 "chai-paani" fine) or get reckless → **WASTED**

## 🗺 Roadmap ideas

- [ ] Sikkim-style hilly map with hairpin roads (or Chennai / Bengaluru palette swaps)
- [ ] Local-train line crossing the city
- [ ] Money-based upgrades: scooter → car → SUV
- [ ] Pay-n-Spray to drop wanted level
- [ ] Day/night cycle with headlights

## 🧪 Dev

Smoke-tested headlessly with a DOM/canvas stub (`node tests` style harness in development).
All game logic lives in `js/game.js` (~700 lines) — tweak `TILE`, `ROAD_STEP`,
`VEH` speeds or police scalars at the top of the file to tune the city.
