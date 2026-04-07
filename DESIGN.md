# Design System Strategy: The Electric Monolith

## 1. Overview & Creative North Star
The "Electric Monolith" is the creative North Star for this design system. It is a philosophy of **High-Octane Minimalism**. We are moving away from the "safe" layouts of modern SaaS and toward a high-end, editorial experience that feels both brutalist and refined.

This system rejects the "card-on-grey-background" cliché. Instead, we treat the screen as a single, cohesive slate where hierarchy is dictated by sheer tonal contrast and aggressive typography. By utilizing pill-shaped primitives against a deep, void-like background, we create a UI that feels like a precision instrument—sharp, intentional, and unapologetically bold.

## 2. Colors: Tonal Architecture
The palette is built on the tension between the atmospheric `#0c0e11` (Surface) and the radioactive energy of `#bffc00` (Primary).

### The "No-Line" Rule
**Traditional 1px borders are strictly prohibited.** Sectioning must be achieved through "Tonal Carving." To separate content, transition from `surface` to `surface-container-low` or `surface-container-high`. This creates a sophisticated, seamless flow where the eye follows value changes rather than structural "cages."

### Surface Hierarchy & Nesting
Treat the interface as a physical stack of materials:
* **Base:** `surface` (#0c0e11) — The foundation.
* **The Cut-Out:** Use `surface-container-lowest` (#000000) for recessed areas like search bars or code blocks.
* **The Lift:** Use `surface-container-highest` (#23262a) for elevated floating elements.
* **The Pulse:** Use `primary` (#eaffb7) and `primary_container` (#bffc00) sparingly to draw the eye to the "Single Source of Truth" on the page.

### The "Glass & Gradient" Rule
While the design is "flat," we introduce "Visual Soul" through subtle environmental effects. Floating overlays (Modals/Popovers) should use a 12% opacity `surface_bright` with a `24px` backdrop blur. This ensures the high-visibility `primary` accents feel integrated into the environment rather than hovering awkwardly above it.

## 3. Typography: Editorial Dominance
We use **Inter** not as a utility font, but as a brand signature.

* **Display & Headline Scale:** Must use `Font-Weight: 800 (Extra Bold)` with a `Letter-Spacing: 0.04em`. This "breathing" space between heavy characters mimics high-end fashion mastheads.
* **Body Scale:** `body-lg` (1rem) is your workhorse. Keep line heights generous (1.6) to balance the density of the bold headers.
* **Label Scale:** Use `label-md` in all-caps for functional UI elements (buttons, tags) to maintain the "instrument" aesthetic.

## 4. Elevation & Depth: Tonal Layering
In this system, "Elevation" is a color, not a shadow.

* **The Layering Principle:** To create a card, do not reach for a shadow. Place a `surface-container-low` pill-shape onto a `surface` background. The subtle shift from `#0c0e11` to `#111417` is enough for the modern eye to perceive depth.
* **Ambient Shadows:** If a floating action button (FAB) requires a shadow for extreme contrast, use a "Neon Glow" approach. The shadow should be `primary` at 5% opacity with a 40px blur—never black.
* **The Ghost Border Fallback:** For disabled states or secondary containers, use `outline-variant` at 15% opacity. It should be felt, not seen.

## 5. Components: Pill-Shaped Primitives
All interactive components follow a `full` (9999px) roundedness scale.

* **Buttons:**
* *Primary:* `primary_container` background with `on_primary_fixed` text. No border.
* *Secondary:* `surface-container-highest` background.
* *Tertiary:* Ghost style—text only in `primary`, becoming `surface-variant` on hover.
* **Input Fields:** Use `surface-container-lowest` (pure black) for the field body. The active state is signaled by a 2px `primary` bottom-bar or a subtle `primary` glow.
* **Chips:** Selection chips should use `secondary_container` to provide a "muted acid" look that doesn't compete with the main CTA.
* **Cards & Lists:** **Forbid dividers.** Use `1.5rem` to `2rem` of vertical whitespace to separate list items. If a container is needed, use a `surface-container-low` pill.
* **The "Acid" Indicator:** Use a small 4x4px `primary` circle next to active line items or menu options to indicate selection, rather than highlighting the whole row.

## 6. Do’s and Don’ts

### Do:
* **Embrace Negative Space:** Give the bold typography room to scream.
* **Use High Contrast:** Place `on_background` white text directly against the `#0c0e11` slate for maximum readability.
* **Asymmetric Layouts:** Shift your grid. Place a large `display-lg` headline on the left and a small `body-sm` description on the far right to create editorial tension.

### Don’t:
* **No 1px Borders:** Never use a solid line to separate sections. Use color blocks.
* **No "Grey" Shadows:** Traditional drop shadows will muddy the "Acid" aesthetic.
* **No Rounded Corners < 1rem:** Unless it's a tiny checkbox, stick to the pill-shape (`full`). Sharp corners or small radii break the fluid, edgy nature of the system.
* **No Gradients in Text:** Keep typography flat and solid to maintain the "Monolith" authority.