# Design System Strategy: High-Performance Editorial
 
## 1. Overview & Creative North Star: "The Architectural Curator"
This design system is built upon the concept of **The Architectural Curator**. We are moving away from the "web-as-a-grid" mentality and toward a "web-as-a-gallery" experience. The goal is to blend the precision of financial performance with the soul of high-end editorial print.
 
The North Star is **Precision through Intentional Density**. While we maintain a sense of luxury, we leverage a compact spacing logic to ensure data and narrative flow efficiently. By leveraging asymmetric layouts, overlapping high-quality imagery, and a sophisticated teal-based palette, we create an environment that feels both technologically advanced and humanly curated. Every element should feel intentional, never "default."
 
---
 
## 2. Colors: Tonal Depth & The "No-Line" Rule
Our palette is rooted in deep, intellectual teals and refreshing aquatic mints. We avoid the clinical coldness of pure greys.
 
### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Traditional borders create a "boxed-in" feeling that kills the editorial flow. 
- **Definition through Tone:** Separate sections using background shifts. A transition from `surface` to `surface-container-low` provides a sophisticated, seamless boundary.
- **Surface Hierarchy:** Treat the UI as a series of physical layers. Use the `surface-container` tiers (Lowest to Highest) to "nest" content. An inner card should sit on a tier slightly lighter or darker than its parent to create organic depth.
 
### Glass & Signature Textures
- **Glassmorphism:** For floating elements (menus, tooltips), use `surface` at 70% opacity with a `24px` backdrop blur. This ensures the editorial background "bleeds through," maintaining visual continuity.
- **Signature Gradients:** Move beyond flat fills for high-impact areas. Use a subtle linear gradient from `primary` (#095857) to `primary-container` at a 135-degree angle to give CTAs a "lit from within" premium feel.
 
---
 
## 3. Typography: Editorial Authority
We utilize **Plus Jakarta Sans** as our primary voice—a typeface that balances geometric clarity with modern warmth.
 
- **Display Scale:** Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) for hero statements. This mimics high-end magazine headers.
- **The Hierarchy of Trust:** 
    - **Headlines:** Use `headline-lg` in `on_surface` (Plus Jakarta Sans) for section titles to anchor the eye.
    - **Body:** `body-lg` (1rem) is your workhorse. Use it for narrative descriptions.
    - **Labels:** `label-md` utilizes **Inter** for technical data, like ROI Calculator inputs or "Trusted By" captions.
- **Intentional Contrast:** Pair a large `display-md` headline with a much smaller `body-md` subtext. This dramatic scale difference is a hallmark of premium editorial design.
 
---
 
## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "software-like." We use **Ambient Depth**.
 
- **The Layering Principle:** Stacking `surface-container-lowest` cards on a `surface-container-low` background creates a "soft lift."
- **Ambient Shadows:** If an element must float (e.g., a modal), use a shadow tinted with `on_surface`: `0px 20px 40px rgba(0, 32, 31, 0.06)`. This mimics natural light passing through a high-end architectural space.
- **The "Ghost Border":** If a boundary is required for accessibility, use `outline-variant` at **15% opacity**. It should be felt, not seen.
- **Roundedness:** We employ a subtle roundedness (Level 1) across the system. This provides a professional, precision-engineered feel that avoids the playfulness of higher radii while remaining more approachable than sharp corners.
 
---
 
## 5. Components: Functional Clarity
 
### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), `on_primary` text, subtle rounding.
- **Secondary:** Ghost style. No background, `ghost border` (15% opacity), and `primary` text.
- **Interaction:** On hover, increase the gradient intensity; do not use a simple "darker" color.
 
### ROI Calculator Inputs
- **Fields:** Use `surface_container_highest` as a background. Forgo the bottom border; use a subtle `surface_variant` fill. 
- **States:** Focus state should utilize a 2px `primary` bottom-bar only, avoiding a full-box highlight.
 
### Cards & Lists
- **The "No-Divider" Rule:** Never use horizontal lines to separate list items. Use our compact spacing (Level 2) or alternating tonal backgrounds (`surface` to `surface-container-low`) to create distinction.
- **Imagery:** High-performance visuals should maintain the consistent system roundedness. Overlay `title-sm` text directly on imagery using a `surface` glassmorphism pill for a "curated" look.
 
### Chips
- Use `tertiary_container` with `on_tertiary_container` for a high-contrast, professional "tag" look.
 
---
 
## 6. Do’s and Don’ts
 
### Do:
- **Do** lean into asymmetry. Offset your text columns from your imagery to create a dynamic, editorial feel.
- **Do** use `primary_fixed_dim` for background accents to break up long scrolling pages.
- **Do** ensure all "Trusted By" logos are rendered in a uniform `on_surface_variant` with 50% opacity to maintain minimalism.
 
### Don’t:
- **Don’t** use pure black (#000000). Always use `on_surface` to keep the palette sophisticated and integrated.
- **Don’t** use standard 1px grey dividers. They make a premium site look like a bootstrap template.
- **Don’t** over-expand the whitespace. Use the refined Spacing Level 2 to maintain a balance between editorial "breath" and high-performance information density.