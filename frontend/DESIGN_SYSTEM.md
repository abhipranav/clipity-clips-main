# Premium UI/UX Design System

## Overview

A cinematic editorial design system for Clipity - a premium video clip extraction tool. This system emphasizes warmth, craft, and confidence while avoiding blue, purple, and pink hues.

---

## Color Palette

### Light Mode (Warm Ivory)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#f9f7f4` | Main background (warm ivory) |
| `--bg-secondary` | `#faf8f5` | Cards, elevated surfaces |
| `--bg-tertiary` | `#f0ece5` | Subtle backgrounds, hover states |
| `--surface-glass` | `rgba(255, 255, 255, 0.7)` | Glassmorphism surfaces |
| `--surface-solid` | `#ffffff` | Opaque cards |
| `--text-primary` | `#1a1a1a` | Headlines, primary text |
| `--text-secondary` | `#4a4a4a` | Body text |
| `--text-tertiary` | `#7a7a7a` | Meta text, timestamps |
| `--text-muted` | `#9a9a9a` | Placeholders, disabled |
| `--accent-primary` | `#c4785a` | Copper/ember orange - primary accent |
| `--accent-light` | `#e8a88a` | Light copper - hover states |
| `--accent-dark` | `#a05a3c` | Deep copper - active states |
| `--accent-gradient` | `linear-gradient(135deg, #c4785a, #d48a6c)` | Premium buttons |
| `--success` | `#2d5a3d` | Deep forest green |
| `--success-light` | `#4a7a5a` | Success hover |
| `--caution` | `#c9a227` | Muted amber |
| `--caution-light` | `#e8c84a` | Caution hover |
| `--error` | `#b54242` | Rich brick red |
| `--error-light` | `#d67272` | Error hover |
| `--border-subtle` | `rgba(0, 0, 0, 0.06)` | Subtle borders |
| `--border-default` | `rgba(0, 0, 0, 0.1)` | Standard borders |
| `--border-strong` | `rgba(0, 0, 0, 0.15)` | Emphasis borders |

### Dark Mode (Deep Charcoal)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0f0f0f` | Main background (near black) |
| `--bg-secondary` | `#1a1a1a` | Cards, elevated surfaces |
| `--bg-tertiary` | `#242424` | Subtle backgrounds |
| `--surface-glass` | `rgba(30, 30, 30, 0.7)` | Glassmorphism surfaces |
| `--surface-solid` | `#1a1a1a` | Opaque cards |
| `--text-primary` | `#f5f5f5` | Headlines, primary text |
| `--text-secondary` | `#b0b0b0` | Body text |
| `--text-tertiary` | `#808080` | Meta text, timestamps |
| `--text-muted` | `#606060` | Placeholders, disabled |
| `--accent-primary` | `#e89b7a` | Warm copper - brighter in dark |
| `--accent-light` | `#f5bca0` | Light copper |
| `--accent-dark` | `#c4785a` | Deep copper |
| `--accent-gradient` | `linear-gradient(135deg, #e89b7a, #f5bca0)` | Premium buttons |
| `--success` | `#4a8a5a` | Muted forest green |
| `--success-light` | `#6aaa7a` | Success hover |
| `--caution` | `#e8c84a` | Bright amber for visibility |
| `--caution-light` | `#f5e070` | Caution hover |
| `--error` | `#e07070` | Light brick red |
| `--error-light` | `#f09090` | Error hover |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Subtle borders |
| `--border-default` | `rgba(255, 255, 255, 0.12)` | Standard borders |
| `--border-strong` | `rgba(255, 255, 255, 0.18)` | Emphasis borders |

### Semantic Colors (Both Modes)

| Status | Light | Dark |
|--------|-------|------|
| Queued | `#c9a227` | `#e8c84a` |
| Running | `#c4785a` | `#e89b7a` |
| Completed | `#2d5a3d` | `#4a8a5a` |
| Failed | `#b54242` | `#e07070` |

---

## Typography

### Font Stack

```css
--font-display: "Fraunces", Georgia, serif;
--font-body: "Manrope", system-ui, sans-serif;
--font-mono: "IBM Plex Mono", monospace;
```

### Type Scale

| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Hero | 3rem (48px) | 700 | 1.1 | -0.02em | Landing headlines |
| H1 | 2.25rem (36px) | 700 | 1.2 | -0.01em | Page titles |
| H2 | 1.5rem (24px) | 700 | 1.3 | 0 | Section headers |
| H3 | 1.25rem (20px) | 600 | 1.4 | 0 | Card titles |
| H4 | 1rem (16px) | 600 | 1.4 | 0 | Subsection headers |
| Body Large | 1.125rem (18px) | 400 | 1.6 | 0 | Lead paragraphs |
| Body | 1rem (16px) | 400 | 1.6 | 0 | Standard text |
| Body Small | 0.875rem (14px) | 400 | 1.5 | 0 | Secondary text |
| Caption | 0.75rem (12px) | 500 | 1.4 | 0.02em | Labels, meta |
| Overline | 0.75rem (12px) | 600 | 1.4 | 0.08em | Section labels (uppercase) |
| Mono | 0.875rem (14px) | 500 | 1.5 | 0 | Code, timestamps |

---

## Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 0.25rem (4px) | Tight gaps |
| `--space-2` | 0.5rem (8px) | Icon gaps, tight padding |
| `--space-3` | 0.75rem (12px) | Small padding |
| `--space-4` | 1rem (16px) | Default padding |
| `--space-5` | 1.25rem (20px) | Component gaps |
| `--space-6` | 1.5rem (24px) | Card padding |
| `--space-8` | 2rem (32px) | Section gaps |
| `--space-10` | 2.5rem (40px) | Large sections |
| `--space-12` | 3rem (48px) | Page sections |
| `--space-16` | 4rem (64px) | Hero spacing |
| `--space-20` | 5rem (80px) | Major sections |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small buttons, inputs |
| `--radius-md` | 10px | Cards, containers |
| `--radius-lg` | 16px | Large cards, modals |
| `--radius-xl` | 24px | Hero sections |
| `--radius-full` | 9999px | Pills, avatars |

---

## Shadows

### Light Mode

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.04)` |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.06)` |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.08)` |
| `--shadow-xl` | `0 16px 48px rgba(0, 0, 0, 0.1)` |
| `--shadow-glow` | `0 0 20px rgba(196, 120, 90, 0.3)` |

### Dark Mode

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.4)` |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.5)` |
| `--shadow-xl` | `0 16px 48px rgba(0, 0, 0, 0.6)` |
| `--shadow-glow` | `0 0 30px rgba(232, 155, 122, 0.25)` |

---

## Premium Effects

### Glassmorphism

```css
.glass {
  background: var(--surface-glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-default);
}
```

### Subtle Gradient Overlays

```css
/* Hero gradient for depth */
.hero-gradient {
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--bg-primary) 100%
  );
}

/* Card hover lift */
.card-hover {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

### Premium Button Styles

```css
/* Primary Button */
.btn-primary {
  background: var(--accent-gradient);
  color: white;
  box-shadow: 0 4px 14px rgba(196, 120, 90, 0.35);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(196, 120, 90, 0.45);
}

.btn-primary:active {
  transform: translateY(0);
}
```

---

## Animation Guidelines

### Timing

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 150ms | Micro-interactions |
| `--duration-base` | 250ms | Standard transitions |
| `--duration-slow` | 400ms | Page transitions |
| `--duration-slower` | 600ms | Hero animations |

### Easing

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entering elements |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Standard transitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful bounces |

### Motion Patterns

1. **Page Transitions**: Fade + 8px vertical slide, 400ms ease-out
2. **Card Entrances**: Staggered fade-up, 50ms delay between items
3. **Button Hovers**: Scale 1.02 + shadow increase, 150ms
4. **Loading States**: Shimmer animation, 1.5s infinite
5. **Success States**: Checkmark draw + subtle pulse

---

## Component Patterns

### Cards

```css
.card {
  background: var(--surface-solid);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all 0.25s ease;
}

.card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
}
```

### Status Pills

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pill-queued {
  background: rgba(201, 162, 39, 0.12);
  color: var(--caution);
}

.pill-running {
  background: rgba(196, 120, 90, 0.12);
  color: var(--accent-primary);
}

.pill-completed {
  background: rgba(45, 90, 61, 0.12);
  color: var(--success);
}

.pill-failed {
  background: rgba(181, 66, 66, 0.12);
  color: var(--error);
}
```

### Input Fields

```css
.input {
  background: var(--surface-solid);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-body);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.input:hover {
  border-color: var(--border-strong);
}

.input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(196, 120, 90, 0.15);
}
```

---

## Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large screens |

---

## Accessibility

- All interactive elements must have visible focus states
- Color contrast minimum 4.5:1 for text
- Support `prefers-reduced-motion` media query
- Dark mode respects `prefers-color-scheme` by default
- Manual theme toggle always available

---

## Theme Implementation

### CSS Variables Strategy

```css
:root {
  /* Light mode as default */
  --bg-primary: #f9f7f4;
  /* ... other light vars */
}

[data-theme="dark"] {
  --bg-primary: #0f0f0f;
  /* ... other dark vars */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg-primary: #0f0f0f;
    /* ... other dark vars */
  }
}
```

### Theme Toggle Behavior

1. Default: Follow system preference
2. Manual selection: Store in `localStorage`
3. Toggle available in user menu or settings
4. Smooth transition between modes (300ms)
