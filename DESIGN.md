# Design System Specification: Atmospheric Depth & Tonal Precision
 
## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Ethereal Observer."** 
 
This system rejects the flat, sterile nature of standard SaaS dashboards in favor of a cinematic, high-end editorial experience. It is designed to feel like a premium physical object—think matte-black obsidian layered with pulses of light. We achieve this through a "depth-first" philosophy. Instead of using lines to separate ideas, we use light, blur, and tonal shifts. By utilizing intentional asymmetry and expansive negative space, we move away from "grid-restricted" layouts and toward a fluid, immersive environment.
 
## 2. Colors & Surface Philosophy
The palette is rooted in the absence of light, using high-chroma accents to guide the eye.
 
### The Palette
- **Background:** `#0e0e0e` (Primary Canvas)
- **Primary (Aurora):** `#4ff5df` (Teal-to-Cyan core)
- **Surface Tiers:** From `surface_container_lowest` (#000000) to `surface_container_highest` (#262626).
- **Accents:** `secondary` (#afefdd) and `tertiary` (#d6fff6) for softer interaction states.
 
### The "No-Line" Rule
**1px solid borders are strictly prohibited for sectioning.** 
Visual boundaries must be created through background color shifts. For example, a card using `surface_container_low` should sit directly on a `background` canvas. The contrast between these two hex codes provides enough definition for the eye without creating the "boxed-in" feeling of a traditional border.
 
### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, semi-opaque materials. 
*   **Base:** `surface` (#0e0e0e)
*   **Primary Containers:** `surface_container` (#1a1919)
*   **Floating Elements:** `surface_bright` (#2c2c2c)
Use `surface_container_lowest` (#000000) for "sunken" elements like search bars or input fields to create a sense of physical indentation.
 
### The "Glass & Gradient" Rule
To capture the "Aurora" essence, high-priority cards should utilize a **Subtle Aurora Glow**. This is achieved by placing a blurred `primary` or `primary_container` gradient (#22dbc6) *behind* the card (z-index -1) rather than inside it. Use `backdrop-blur-xl` on the card itself to allow the "aurora" to bleed through the edges of the surface.
 
## 3. Typography: The Editorial Voice
We use **Inter** not as a utility font, but as a luxury typographic mark.
 
*   **Headings (Display/Headline):** Must use `letter-spacing: 0.02em` or higher. This increased tracking creates an expansive, premium feel found in high-fashion mastheads.
*   **The Scale:**
    *   **Display-LG (3.5rem):** Reserved for hero moments.
    *   **Headline-MD (1.75rem):** Used for section starts.
    *   **Label-SM (0.6875rem):** Used for metadata, always in uppercase with `0.05em` tracking.
*   **Hierarchy Strategy:** Brand identity is conveyed through high contrast in size. Pair a `Display-MD` headline with a `body-sm` description to create a sophisticated, intentional typographic "gap."
 
## 4. Elevation & Depth
In this system, elevation is a function of light, not lines.
 
### The Layering Principle
Hierarchy is established by stacking `surface-container` tiers. 
- **Level 0:** `surface` (The floor)
- **Level 1:** `surface_container_low` (General layout blocks)
- **Level 2:** `surface_container_highest` (Interactive cards)
 
### Ambient Shadows
Shadows should feel like light occlusion, not "ink."
- **Color:** Always use a tinted shadow. Instead of black, use a 4% opacity version of `on_surface` (#ffffff).
- **Values:** `0px 24px 48px rgba(255, 255, 255, 0.06)`. This creates a soft "lift" that mimics a studio lighting environment.
 
### The "Ghost Border" Fallback
If accessibility requirements demand a border, use the **Ghost Border**:
- **Token:** `outline_variant` (#494847) at **15% opacity**. It should be barely perceptible, serving only to define a shape against a complex background.
 
## 5. Components
 
### Buttons: High-Priority Action
- **Primary:** A teal-to-cyan gradient background. No border. Text color is `on_primary` (#00594f).
- **Secondary:** Transparent background with a `Ghost Border`.
- **Corner Radius:** Always `rounded-xl` (1.5rem) to maintain the soft-tech aesthetic.
 
### Cards & Lists
- **Rule:** **No divider lines.**
- **Implementation:** Use `surface_container_low` for the list container and `surface_container` for the individual item on hover. Separate items using 8px of vertical white space from the Spacing Scale.
- **Aurora Cards:** Key featured cards get a `primary_dim` glow behind them to signify "High Priority."
 
### Input Fields
- **State:** Unfocused inputs should be `surface_container_lowest` (#000000).
- **Focus State:** The `Ghost Border` becomes 100% opaque `primary` (#4ff5df) with a subtle 4px outer glow of the same color.
 
### Chips & Tags
- **Style:** Small, pill-shaped (`full` roundedness). 
- **Color:** `secondary_container` (#0b5345) background with `on_secondary_container` text. This provides a low-contrast, sophisticated look.
 
## 6. Do's and Don'ts
 
### Do:
*   **DO** use whitespace as a structural element. If a section feels crowded, increase the padding rather than adding a border.
*   **DO** use "Aurora" glows sparingly. If everything glows, nothing is important.
*   **DO** ensure text contrast against dark surfaces meets WCAG AA standards by using `on_surface_variant` (#adaaaa) for secondary text.
 
### Don't:
*   **DON'T** use pure white (#ffffff) for large blocks of body text. It causes "halations" on dark backgrounds. Use `on_surface_variant` or `secondary_dim`.
*   **DON'T** use standard 4px or 8px corners. This system relies on the "organic" feel of the 12px-24px (`rounded-xl`) range.
*   **DON'T** use 100% opaque black for shadows. It will muddy the deep charcoal background.