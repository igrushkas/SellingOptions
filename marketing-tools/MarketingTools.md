# Marketing Tools — Multi-Business AI Marketing Dashboard

## Project Overview
A standalone React app that provides 25 AI-powered marketing skills for growing any business. Supports multiple businesses, competitor tracking, workflow automation, and video generation. Secured with Google OAuth and Firebase Firestore for cloud storage.

**Primary use**: Run marketing skills (CRO, SEO, copywriting, strategy, growth) against your businesses using OpenAI, Perplexity, and Gemini APIs.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| Vite | 6 | Build tool & dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Firebase Auth | 11.3+ | Google OAuth login |
| Firebase Firestore | 11.3+ | Cloud database |
| Firebase Hosting | — | Deployment (free tier) |
| Lucide React | 0.474+ | Icons |
| React Markdown | 9+ | Render AI output |

## AI Integrations

| Service | Model | API Endpoint | Used For |
|---------|-------|-------------|----------|
| OpenAI | gpt-4o | api.openai.com/v1/chat/completions | 18 skills: copywriting, CRO, strategy, psychology, pricing, ads |
| Perplexity | sonar-pro | api.perplexity.ai/chat/completions | 6 skills: SEO audit, competitor analysis, content strategy, programmatic SEO, analytics, schema markup |
| Gemini | gemini-2.0-flash | generativelanguage.googleapis.com | Video script generation, image content |
| Veo 3 | veo-3 | (not yet public API) | Video generation (placeholder) |
| n8n | — | User's webhook URLs | Workflow automation: social posting, emails, lead capture |

All API calls are **client-side** — the user enters their own API keys in Settings. No backend server needed.

## Design System

**Inspired by**: Mindset365 dashboard layout (sidebar + top bar + content area) with a unique teal/navy palette.

| Element | Color |
|---------|-------|
| Base background | `#0a1628` |
| Sidebar | `#0b1929` |
| Cards | `#111d2e` |
| Card border | `rgba(6,182,212,0.12)` |
| Primary accent (teal) | `#06b6d4` |
| Secondary accent (amber) | `#f59e0b` |
| Success (emerald) | `#10b981` |
| Error (rose) | `#f43f5e` |
| Text primary | `#f1f5f9` |
| Text secondary | `#94a3b8` |
| Text muted | `#64748b` |
| Banner gradient | `linear-gradient(135deg, #0891b2, #1d4ed8)` |

**Category colors**: CRO=emerald, Content=blue, SEO=purple, Strategy=amber, Growth=pink, Ads=red

## Architecture

### Authentication Flow
```
User opens app → Firebase Auth check →
  Not logged in → LoginPage (Google OAuth) →
  Logged in → Main dashboard with sidebar navigation
```

### Firestore Database Schema
```
users/{uid}/
  profile/apiKeys          → { openai, perplexity, gemini, n8nWebhook }
  businesses/{bizId}/
    name, url, description, audience, goals, completedSkills[], createdAt
    skillOutputs/{skillId}/ → { output, createdAt }
    competitors/{compId}/   → { name, url, description, pricing[], keyFeatures[], strengths, weaknesses, snapshots[], lastUpdated }
```

### Component Tree
```
App.jsx (auth guard, state management, data subscriptions)
├── LoginPage.jsx (Google OAuth sign-in)
├── Sidebar.jsx (left navigation: MAIN/TOOLS/SUPPORT sections)
├── TopBar.jsx (search, business switcher, user avatar)
│
├── [Dashboard page]
│   ├── Welcome banner (gradient, personalized greeting)
│   ├── KPI cards (skills done, businesses, competitors, progress %)
│   ├── BusinessForm.jsx (add/edit business profiles)
│   └── ProgressTracker.jsx (7-day growth plan with daily skill cards)
│
├── [Skills page]
│   ├── SkillsGrid.jsx (category filters, search, 25 skill cards)
│   │   └── SkillCard.jsx (icon, name, description, category, priority, AI engine)
│   └── SkillWorkspace.jsx (skill execution: inputs → AI → markdown output)
│       └── OutputPanel.jsx (markdown renderer, copy, download)
│
├── [Competitors page]
│   └── CompetitorMonitor.jsx
│       ├── CompetitorCard.jsx (pricing, features, strengths/weaknesses)
│       ├── CompetitorForm.jsx (add/edit)
│       ├── ComparisonMatrix (side-by-side feature/pricing table)
│       └── "Research with AI" (Perplexity auto-fill)
│
├── [Automation page]
│   └── AutomationPanel.jsx (7 n8n recipes with trigger buttons)
│
├── [Video Studio page]
│   └── VideoGenerator.jsx (script gen → video gen, 3-step flow)
│
├── [Settings page]
│   └── ApiKeysPanel.jsx (OpenAI, Perplexity, Gemini, n8n keys)
│
└── [Help page] (getting started guide)
```

## File Structure

```
marketing-tools/
├── index.html                          # HTML entry
├── package.json                        # Dependencies & scripts
├── vite.config.js                      # Vite + React + Tailwind
├── MarketingTools.md                   # This documentation file
├── public/favicon.svg                  # App favicon
├── src/
│   ├── main.jsx                        # React entry point
│   ├── App.jsx                         # Root component (auth, routing, state)
│   ├── index.css                       # Theme + utility styles
│   ├── firebase.js                     # Firebase config (Auth + Firestore)
│   ├── components/
│   │   ├── LoginPage.jsx               # Google OAuth sign-in
│   │   ├── Sidebar.jsx                 # Left navigation
│   │   ├── TopBar.jsx                  # Top bar with business switcher
│   │   ├── BusinessForm.jsx            # Add/edit business
│   │   ├── ProgressTracker.jsx         # 7-day plan tracker
│   │   ├── ApiKeysPanel.jsx            # API key management
│   │   ├── SkillsGrid.jsx             # Skill cards grid with filters
│   │   ├── SkillCard.jsx              # Individual skill card
│   │   ├── SkillWorkspace.jsx         # Skill execution workspace
│   │   ├── OutputPanel.jsx            # AI output renderer
│   │   ├── CompetitorMonitor.jsx      # Competition tracking
│   │   ├── AutomationPanel.jsx        # n8n automation recipes
│   │   └── VideoGenerator.jsx         # Video script + generation
│   ├── data/
│   │   └── marketingSkills.js          # 25 skills with embedded AI prompts
│   └── services/
│       ├── authService.js              # Google OAuth
│       ├── firestoreService.js         # Firestore CRUD
│       ├── openaiService.js            # OpenAI API
│       ├── perplexityService.js        # Perplexity API
│       ├── geminiService.js            # Gemini API
│       └── n8nService.js              # n8n webhooks
```

## 25 Marketing Skills

### By Category
| Category | Skills | AI Engine |
|----------|--------|-----------|
| **CRO** (6) | page-cro, signup-flow-cro, form-cro, onboarding-cro, popup-cro, paywall-upgrade-cro | OpenAI |
| **Content** (5) | copywriting, copy-editing, email-sequence, social-content, content-strategy | OpenAI (content-strategy: Perplexity) |
| **SEO** (5) | seo-audit, schema-markup, programmatic-seo, analytics-tracking, competitor-alternatives | Perplexity |
| **Strategy** (5) | marketing-ideas, marketing-psychology, pricing-strategy, launch-strategy, product-marketing-context | OpenAI |
| **Growth** (3) | free-tool-strategy, referral-program, ab-test-setup | OpenAI |
| **Ads** (1) | paid-ads | OpenAI |

### By Priority (7-Day Plan)
| Day | Focus | Skills |
|-----|-------|--------|
| 1 | Foundation | seo-audit, analytics-tracking |
| 2 | Landing Page | page-cro, copywriting, schema-markup |
| 3 | Sign-up & Content | signup-flow-cro, content-strategy, product-marketing-context |
| 4 | Distribution | social-content, competitor-alternatives, programmatic-seo |
| 5 | Growth | free-tool-strategy, marketing-ideas, email-sequence |
| 6 | Optimization | ab-test-setup, form-cro, pricing-strategy, marketing-psychology |
| 7 | Scale | referral-program, launch-strategy, paid-ads |

### Skill Data Structure
```js
{
  id: 'page-cro',
  name: 'Landing Page CRO',
  description: '...',
  category: 'cro',           // cro|content|seo|strategy|growth|ads
  priority: 'week1',         // week1|secondary|advanced
  day: '2',
  icon: 'Target',            // Lucide icon name
  aiEngine: 'openai',        // openai|perplexity|gemini
  systemPrompt: '...',       // AI system prompt from SKILL.md framework
  questions: [...],           // Skill-specific input fields
  relatedSkills: [...],       // Cross-references
  automatable: true,          // Can trigger n8n
  videoCapable: false,        // Can generate video
}
```

## Multi-Business Support
- **Business Switcher** in TopBar — dropdown to switch active business
- **Add New Business** — form on Dashboard page
- Each business has its own: progress tracker, completed skills, saved outputs, competitor list
- API keys shared across businesses (stored at user level)
- All data synced in real-time via Firestore

## n8n Automation Recipes
| Recipe | Webhook Path | Trigger Type |
|--------|-------------|-------------|
| Social Auto-Post | /social-post | Manual button |
| Email Welcome | /email-welcome | Webhook |
| Lead Capture | /lead-capture | Webhook |
| Weekly Content | /weekly-content | Schedule |
| SEO Report | /seo-report | Schedule |
| Video Pipeline | /video-pipeline | Manual button |
| Competitor Watch | /competitor-watch | Schedule |

## Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Commands
```bash
cd marketing-tools/
npm install          # Install dependencies
npm run dev          # Dev server (localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build
```

## Deployment
Firebase Hosting (free tier):
```bash
firebase deploy --only hosting
```
Build output: `dist/`

## Key Relationships
- **App.jsx** is the orchestrator — manages auth state, Firestore subscriptions, and page routing
- **Sidebar.jsx** controls navigation via `activePage` state in App
- **SkillWorkspace.jsx** calls AI services based on `skill.aiEngine` and saves output via `firestoreService.js`
- **CompetitorMonitor.jsx** uses Perplexity API for AI research and Firestore for persistence
- **AutomationPanel.jsx** triggers n8n webhooks using the base URL from Settings
- **ProgressTracker.jsx** reads `completedSkills` from the active business document
- All components read from App.jsx state (lifted state pattern) — no global state library
