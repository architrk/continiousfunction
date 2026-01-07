# Continuous Function - Comprehensive Visual Testing Checklist

## Instructions
Print this checklist and go through each item systematically. Use multiple browser windows side-by-side to compare pages. Take screenshots of any inconsistencies.

**Required Tools:**
- Ruler/measurement extension (e.g., PixelParallel, Dimensions)
- Color picker extension (e.g., ColorZilla)
- Screenshot tool with annotation
- Responsive design mode in DevTools

---

## 1. HOMEPAGE VISUAL AUDIT

### 1.1 Hero Section

#### Typography
- [ ] **Main heading "Continuous Function"**
  - [ ] Font family: Correct serif/sans-serif as per design
  - [ ] Font size: Desktop ___px, Tablet ___px, Mobile ___px
  - [ ] Font weight: Appears bold/medium as intended
  - [ ] Line height: Visually balanced, not cramped
  - [ ] Letter spacing: Not too tight or loose
  - [ ] Color: Correct hex value _______
  - [ ] Anti-aliasing: Smooth edges, no pixelation
  - [ ] Alignment: Centered/left-aligned as intended
  - [ ] No text wrapping in unexpected places
  - [ ] No orphans (single word on last line)

- [ ] **Tagline/Subtitle text**
  - [ ] Font size smaller than main heading (visual hierarchy clear)
  - [ ] Color: Lighter than heading for contrast
  - [ ] Line length: Comfortable to read (45-75 characters)
  - [ ] Spacing below heading: ___px (measure with ruler tool)
  - [ ] Text doesn't touch edges on mobile
  - [ ] Punctuation properly formatted

#### Spacing & Layout
- [ ] **Hero container**
  - [ ] Top padding/margin: ___px from nav
  - [ ] Bottom padding: ___px before next section
  - [ ] Left/right padding on mobile: ≥16px
  - [ ] Vertically centered (if design intends)
  - [ ] Background color fills entire viewport width
  - [ ] No horizontal scrollbar at any breakpoint

- [ ] **CTA Button ("Explore 18 Core Concepts")**
  - [ ] Button position: Centered below text
  - [ ] Top margin from tagline: ___px
  - [ ] Button width: Consistent with design (not too wide/narrow)
  - [ ] Min width on mobile: Touch-friendly (≥44px height)
  - [ ] Border radius: Consistent rounded corners ___px
  - [ ] No text overflow inside button
  - [ ] Icon (if present) aligned with text
  - [ ] Icon spacing from text: ___px

#### Colors
- [ ] **Background**
  - [ ] Hex value: _______
  - [ ] No banding or gradient artifacts
  - [ ] Consistent across page reload

- [ ] **Text colors**
  - [ ] Heading: _______ (AA contrast ratio ≥4.5:1)
  - [ ] Body text: _______
  - [ ] Button text: _______
  - [ ] All pass WebAIM contrast checker

#### Visual Effects
- [ ] **Animations (if any)**
  - [ ] Fade-in plays smoothly (not jarring)
  - [ ] Duration feels appropriate (not too slow/fast)
  - [ ] No content jumping during animation
  - [ ] Respects prefers-reduced-motion setting
  - [ ] Works consistently across browsers

---

### 1.2 Knowledge Graph Section

#### Graph Rendering
- [ ] **SVG Canvas**
  - [ ] Graph visible (not blank white box)
  - [ ] Centered horizontally in container
  - [ ] Appropriate height: Not squished or too tall
  - [ ] No clipping of nodes at edges
  - [ ] Preserves aspect ratio on resize
  - [ ] Border/shadow (if any) renders correctly

- [ ] **Nodes**
  - [ ] Circles are perfectly round (not elliptical)
  - [ ] Uniform size or intentional size variation
  - [ ] Node diameter: ___px (consistent across all)
  - [ ] Fill color: Matches category colors in palette
  - [ ] Stroke color and width consistent
  - [ ] No overlapping node labels
  - [ ] Labels readable (font size ≥10px)
  - [ ] Labels positioned correctly (centered/below/above)
  - [ ] Emoji icons (if used) display correctly, not blank squares

- [ ] **Edges/Links**
  - [ ] Lines connect correct nodes
  - [ ] Line color: Subtle, not overpowering nodes
  - [ ] Line thickness: ___px
  - [ ] No jagged lines (anti-aliasing works)
  - [ ] Arrowheads (if directional) point correct direction
  - [ ] No stray disconnected lines

#### Interactive States
- [ ] **Hover on node**
  - [ ] Cursor changes to pointer
  - [ ] Node highlight: Brightens/scales/changes color
  - [ ] Transition smooth (not instant)
  - [ ] Connected nodes also highlight (if designed)
  - [ ] Tooltip appears (if applicable)
  - [ ] Tooltip positioned to not clip viewport edge
  - [ ] Hover state reverts on mouse-out

- [ ] **Drag node**
  - [ ] Node follows cursor smoothly
  - [ ] Other nodes readjust positions (force simulation)
  - [ ] No flickering during drag
  - [ ] Release leaves node in new position
  - [ ] Doesn't break graph layout

#### Section Layout
- [ ] **Container**
  - [ ] Section heading visible and styled
  - [ ] Heading top margin: ___px
  - [ ] Heading bottom margin: ___px
  - [ ] Background color distinct from hero section
  - [ ] Full viewport width or contained (as designed)
  - [ ] Vertical rhythm maintained with adjacent sections

---

### 1.3 Five Pillars Section

#### Card Grid Layout
- [ ] **Grid container**
  - [ ] Cards arranged in row/grid (not stacked on desktop)
  - [ ] Desktop: 5 cards in __ rows (1 row expected if 5 pillars)
  - [ ] Tablet: Cards wrap to 2-3 per row
  - [ ] Mobile: 1 card per row (stacked vertically)
  - [ ] Gap between cards: Consistent horizontal ___px, vertical ___px
  - [ ] Grid centered on page
  - [ ] No uneven card widths in same row
  - [ ] Cards align at top (not stretched to different heights)

#### Individual Card Visual
- [ ] **Card container (x5 - check ALL)**
  1. Sequence Modeling
     - [ ] Background: Correct color/image
     - [ ] Border: Style, width ___px, color _______
     - [ ] Border radius: ___px (consistent with design system)
     - [ ] Shadow: No harsh shadows, subtle depth
     - [ ] Padding: Internal spacing ___px (top/right/bottom/left)
     - [ ] Width: Equal to sibling cards
     - [ ] Height: Equal or content-aware (if variable)
     - [ ] No pixelated images/backgrounds

  2. Optimization
     - [ ] (Repeat all above checks)

  3. Generative Physics
     - [ ] (Repeat all above checks)

  4. Geometric Deep Learning
     - [ ] (Repeat all above checks)

  5. Mechanistic Interpretability
     - [ ] (Repeat all above checks)

- [ ] **Card typography (check on ALL 5 cards)**
  - [ ] **Title**
    - [ ] Font size: ___px
    - [ ] Font weight: Bold enough to stand out
    - [ ] Color: High contrast against background
    - [ ] Not touching top edge of card
    - [ ] No awkward line breaks
    - [ ] Truncates gracefully if too long (…)

  - [ ] **Description**
    - [ ] Font size: Smaller than title ___px
    - [ ] Line height: Readable (1.5-1.8 typically)
    - [ ] Color: Lighter than title
    - [ ] Text doesn't overflow card boundary
    - [ ] Consistent number of lines across cards (or left-aligned if variable)
    - [ ] Spacing below title: ___px

- [ ] **Icon/Image (if present on cards)**
  - [ ] Size: ___px × ___px
  - [ ] Positioned consistently (top-left/center/top-right)
  - [ ] Margin from card edges: ___px
  - [ ] Not stretched or squished
  - [ ] High resolution (no blurriness)
  - [ ] Color matches card theme

#### Interactive States (Per Card)
- [ ] **Hover**
  - [ ] Cursor: Pointer appears
  - [ ] Visual change: Lift (transform), brightness, border color, etc.
  - [ ] Transition: Smooth animation ___ms duration
  - [ ] Shadow increases (depth effect)
  - [ ] No layout shift (other cards don't move)
  - [ ] Hover state consistent across all 5 cards

- [ ] **Click/Active**
  - [ ] Pressed state (if any) shows briefly
  - [ ] Navigation occurs immediately
  - [ ] No broken link appearance

#### Spacing Between Sections
- [ ] **Five Pillars section to next section**
  - [ ] Bottom padding: ___px
  - [ ] Visual separation clear (background color change, divider, etc.)
  - [ ] Maintains page rhythm

---

### 1.4 Navigation Bar (Global)

#### Layout
- [ ] **Nav container**
  - [ ] Full viewport width
  - [ ] Height: ___px (consistent across pages)
  - [ ] Position: Fixed/sticky/static as designed
  - [ ] Background: Solid color or transparent
  - [ ] Blur effect (if glassmorphism) renders correctly
  - [ ] Border bottom (if any): ___px, color _______
  - [ ] Z-index: Appears above page content on scroll

- [ ] **Logo/Site title**
  - [ ] Positioned left side (typical)
  - [ ] Left margin: ___px from viewport edge
  - [ ] Vertically centered in nav bar
  - [ ] Clickable (cursor pointer)
  - [ ] Returns to homepage on click
  - [ ] Size: Not too large or small ___px height
  - [ ] SVG/image crisp (not pixelated)

- [ ] **Nav links**
  - [ ] Positioned right side (typical)
  - [ ] Right margin: ___px from viewport edge
  - [ ] Vertically centered in nav bar
  - [ ] Horizontal spacing between links: ___px
  - [ ] Link order matches design/sitemap
  - [ ] Text not clipping on any link

#### Typography
- [ ] **Nav link text**
  - [ ] Font size: ___px
  - [ ] Font weight: Medium/Semibold
  - [ ] Color: _______ (contrasts with nav background)
  - [ ] Letter spacing: Appropriate (not too tight)
  - [ ] Active page: Different style (bold, underline, color)
  - [ ] Text-transform: Capitalized/uppercase as designed

#### Interactive States
- [ ] **Link hover**
  - [ ] Underline appears or color changes
  - [ ] Transition smooth ___ms
  - [ ] Cursor pointer
  - [ ] No layout shift (underline doesn't push content)

- [ ] **Mobile menu icon (hamburger)**
  - [ ] Appears at correct breakpoint (≤768px typically)
  - [ ] Icon: Clear 3-line hamburger or X when open
  - [ ] Size: ___px × ___px (touch-friendly ≥44px)
  - [ ] Color: Visible against nav background
  - [ ] Right-aligned (standard position)
  - [ ] Margin from edge: ___px

- [ ] **Mobile menu dropdown**
  - [ ] Slides/fades in smoothly
  - [ ] Background: Solid or slightly transparent
  - [ ] Full width or partial overlay
  - [ ] Links stacked vertically
  - [ ] Spacing between links: ___px
  - [ ] Close button/X visible and functional
  - [ ] Closes when clicking link or outside menu
  - [ ] Scrollable if many links (doesn't overflow viewport)

---

### 1.5 Footer

#### Layout
- [ ] **Footer container**
  - [ ] Full viewport width
  - [ ] Background color: _______ (distinct from body)
  - [ ] Top border/divider (if any): ___px, color _______
  - [ ] Internal padding: ___px top, ___px bottom
  - [ ] Sticks to bottom (not floating mid-page on short pages)

- [ ] **Footer content**
  - [ ] Centered or aligned as designed
  - [ ] Columns (if multi-column): Equal width, aligned tops
  - [ ] Gap between columns: ___px
  - [ ] Stacks vertically on mobile

#### Typography & Links
- [ ] **Footer text**
  - [ ] Font size: ___px (typically smaller than body)
  - [ ] Color: _______ (muted, readable)
  - [ ] Line height: Readable
  - [ ] Copyright symbol (©) displays correctly
  - [ ] Year is current or correct

- [ ] **Footer links**
  - [ ] Color: _______ (underlined or distinct from plain text)
  - [ ] Hover: Changes color/underline
  - [ ] Spacing between links: ___px
  - [ ] External links: Icon indicator (if designed)
  - [ ] Social media icons: Uniform size, aligned, correct platforms

---

## 2. FOUNDATIONS INDEX PAGE (/foundations)

### 2.1 Page Header

- [ ] **Hero/Header section**
  - [ ] Heading: "18 Core Concepts" or similar
  - [ ] Font size: ___px (larger than body)
  - [ ] Color: _______
  - [ ] Centered or left-aligned
  - [ ] Top margin: ___px
  - [ ] Bottom margin: ___px before concept grid
  - [ ] Background (if any): Consistent with design

- [ ] **Subtitle/Description**
  - [ ] Present (if designed)
  - [ ] Font size: ___px
  - [ ] Color: Lighter than heading
  - [ ] Max width: Constrained for readability
  - [ ] Spacing below heading: ___px

### 2.2 Concept Cards Grid

#### Grid Layout
- [ ] **Grid container**
  - [ ] Desktop: __ columns (3-4 typical)
  - [ ] Tablet: __ columns (2-3)
  - [ ] Mobile: __ columns (1-2)
  - [ ] Horizontal gap: ___px
  - [ ] Vertical gap: ___px (measure multiple rows)
  - [ ] Grid centered on page
  - [ ] No uneven widths in same row
  - [ ] Last row: Cards left-aligned or centered (check design intent)

- [ ] **Card count**
  - [ ] Total cards: 19 visible (matches data)
  - [ ] All cards render (none hidden/missing)
  - [ ] No duplicate cards

#### Individual Concept Card (Check on 5+ random cards)

**Card 1: ________________ (concept name)**
- [ ] **Container**
  - [ ] Background: _______ (white, light gray, etc.)
  - [ ] Border: ___px, color _______, radius ___px
  - [ ] Shadow: Subtle, not harsh
  - [ ] Padding: ___px all sides (or specify t/r/b/l)
  - [ ] Height: Equal to siblings or content-based
  - [ ] No overflow (content clipped)

- [ ] **Icon/Emoji**
  - [ ] Size: ___px × ___px
  - [ ] Positioned: Top-left/top-center/above title
  - [ ] Margin: ___px from edges
  - [ ] Displays correctly (not broken emoji)
  - [ ] Color/style matches concept category

- [ ] **Category Badge**
  - [ ] Text: Matches data (e.g., "Efficiency", "Architecture")
  - [ ] Background color: Matches MATH_COLORS palette
  - [ ] Positioned: Top-right/below icon/above title
  - [ ] Size: ___px height
  - [ ] Border radius: ___px (pill-shaped or rounded)
  - [ ] Font size: ___px
  - [ ] Font weight: Medium/bold
  - [ ] Text color: Contrasts with badge background
  - [ ] Padding: ___px horizontal, ___px vertical

- [ ] **Title**
  - [ ] Text: Concept name clear and complete
  - [ ] Font size: ___px
  - [ ] Font weight: Bold/semibold
  - [ ] Color: _______
  - [ ] Line height: Comfortable (not cramped)
  - [ ] Doesn't wrap awkwardly
  - [ ] Spacing below icon/badge: ___px
  - [ ] Spacing above description: ___px

- [ ] **Description**
  - [ ] Text: Visible and readable
  - [ ] Font size: ___px (smaller than title)
  - [ ] Color: _______ (lighter than title)
  - [ ] Line height: ___
  - [ ] Lines: Truncates at __ lines (if clamped)
  - [ ] Ellipsis (...) if truncated
  - [ ] No orphan words
  - [ ] Spacing from bottom: ___px

**Repeat for Cards 2-5:**
- [ ] Card 2: ________________
- [ ] Card 3: ________________
- [ ] Card 4: ________________
- [ ] Card 5: ________________

#### Card Interactive States (Check ALL cards)
- [ ] **Hover**
  - [ ] Lift effect: Transform translateY(-___px)
  - [ ] Shadow deepens
  - [ ] Transition: Smooth ___ms
  - [ ] Border color changes (if applicable)
  - [ ] Cursor: Pointer
  - [ ] No layout shift to adjacent cards

- [ ] **Focus (keyboard)**
  - [ ] Visible focus outline: ___px, color _______
  - [ ] Outline offset: ___px (doesn't overlap card)
  - [ ] Consistent across all cards

- [ ] **Active/Pressed**
  - [ ] Brief scale-down or color shift
  - [ ] Navigates on click release

### 2.3 Spacing & Rhythm

- [ ] **Section spacing**
  - [ ] Top: Nav to header: ___px
  - [ ] Header to grid: ___px
  - [ ] Grid to footer: ___px
  - [ ] Visual balance (not cramped or too spacious)

- [ ] **Responsive breakpoints**
  - [ ] At 1280px: Grid changes to __ columns
  - [ ] At 768px: Grid changes to __ columns
  - [ ] At 480px: Grid changes to __ columns
  - [ ] Smooth transitions (no sudden jumps)
  - [ ] Padding adjusts on mobile (≥16px sides)

---

## 3. INDIVIDUAL CONCEPT PAGE (/foundations/[id])

### 3.1 Page Header

- [ ] **Concept title**
  - [ ] Font size: ___px (large, h1 typically)
  - [ ] Font weight: Bold
  - [ ] Color: _______
  - [ ] Alignment: Left/centered
  - [ ] Top margin: ___px from nav
  - [ ] No widows/orphans

- [ ] **Icon/Emoji**
  - [ ] Size: ___px
  - [ ] Positioned: Before/above title or separate
  - [ ] Margin from title: ___px
  - [ ] Displays correctly

- [ ] **Category badge**
  - [ ] Same styling as concept cards
  - [ ] Background color consistent with category
  - [ ] Positioned: Below title/inline with title
  - [ ] Margin: ___px from adjacent elements

- [ ] **Breadcrumb (if present)**
  - [ ] Format: Home > Foundations > [Concept Name]
  - [ ] Font size: ___px (small)
  - [ ] Color: _______ (muted)
  - [ ] Separators (> or /) render correctly
  - [ ] Links clickable and styled
  - [ ] Positioned above title
  - [ ] Margin: ___px bottom

### 3.2 Content Area

#### Typography Hierarchy
- [ ] **Headings (H2, H3, H4)**
  - [ ] **H2 (section headings)**
    - [ ] Font size: ___px
    - [ ] Font weight: ___
    - [ ] Color: _______
    - [ ] Margin top: ___px
    - [ ] Margin bottom: ___px
    - [ ] Clear visual hierarchy (smaller than H1)

  - [ ] **H3 (subsections)**
    - [ ] Font size: ___px (smaller than H2)
    - [ ] Font weight: ___
    - [ ] Color: _______
    - [ ] Margin top: ___px
    - [ ] Margin bottom: ___px

  - [ ] **H4 (if used)**
    - [ ] Font size: ___px
    - [ ] Distinct from H3 (size, weight, or color)
    - [ ] Proper hierarchy maintained

- [ ] **Body text**
  - [ ] Font family: _______ (readable serif/sans-serif)
  - [ ] Font size: ___px (16-18px standard)
  - [ ] Line height: ___ (1.6-1.8 for readability)
  - [ ] Color: _______ (not pure black, #333 or similar)
  - [ ] Max width: ___px (65-75 characters per line)
  - [ ] Alignment: Left (not justified unless designed)
  - [ ] Paragraph spacing: ___px between paragraphs
  - [ ] No awkward hyphenation

- [ ] **Links (inline)**
  - [ ] Color: _______ (distinct from body text)
  - [ ] Underline: Present or appears on hover
  - [ ] Hover: Color changes/underline
  - [ ] Visited: Different color (if applicable)
  - [ ] Cursor: Pointer

- [ ] **Lists (ul, ol)**
  - [ ] Bullet/number style: Consistent
  - [ ] Indentation: ___px from left margin
  - [ ] Spacing between items: ___px
  - [ ] Nested lists: Further indented correctly
  - [ ] List marker color matches text

- [ ] **Code blocks**
  - [ ] Background: _______ (light gray/dark if dark theme)
  - [ ] Border: ___px, color _______ or none
  - [ ] Border radius: ___px
  - [ ] Padding: ___px
  - [ ] Font family: Monospace (Consolas, Monaco, etc.)
  - [ ] Font size: ___px (slightly smaller than body)
  - [ ] Syntax highlighting: Colors render correctly
  - [ ] Scrollable if long (horizontal scroll appears)
  - [ ] Copy button (if present): Positioned top-right, functional

- [ ] **Inline code**
  - [ ] Background: _______ (distinct from regular text)
  - [ ] Padding: ___px horizontal
  - [ ] Border radius: ___px
  - [ ] Font family: Monospace
  - [ ] Font size: ___px
  - [ ] Color: Readable against background

#### Math Rendering (KaTeX)

**Test on at least 5 different equations on the page:**

- [ ] **Inline math ($...$)**
  - [ ] **Equation 1:** ________________
    - [ ] Renders as formatted math (not raw LaTeX)
    - [ ] Aligned with text baseline
    - [ ] Font size matches surrounding text
    - [ ] No overflow out of container
    - [ ] Symbols (√, ∫, ∑, etc.) display correctly
    - [ ] Greek letters (α, β, θ, etc.) render

  - [ ] **Equation 2-5:** (Repeat checks)

- [ ] **Block math ($$...$$)**
  - [ ] **Equation 1:** ________________
    - [ ] Centered on page
    - [ ] Larger than inline math
    - [ ] Margin above: ___px
    - [ ] Margin below: ___px
    - [ ] No horizontal overflow (scrollable if wide)
    - [ ] Fractions: Numerator/denominator aligned correctly
    - [ ] Matrices: Elements aligned in grid
    - [ ] Summation/integral: Limits positioned correctly (above/below)
    - [ ] Operators: Spacing appropriate (not cramped)
    - [ ] No "Math Processing Error" message

  - [ ] **Equation 2-5:** (Repeat checks)

- [ ] **Complex expressions**
  - [ ] Nested fractions render correctly
  - [ ] Large operators (∑, ∫, ∏) scale appropriately
  - [ ] Subscripts and superscripts: Positioned correctly, readable
  - [ ] Brackets: Scale to enclosed content
  - [ ] Arrows (→, ⇒) align properly
  - [ ] Spacing in multi-line equations consistent

- [ ] **Math edge cases**
  - [ ] Long equations: Line break gracefully or scroll
  - [ ] Equation numbers (if present): Right-aligned, in parentheses
  - [ ] Math within lists: Indentation preserved
  - [ ] Math next to images: No overlap

### 3.3 Interactive Visualization Section

#### Section Container
- [ ] **Heading: "Interactive Visualization"**
  - [ ] Font size: ___px (H2 typically)
  - [ ] Margin top: ___px (clear separation from text)
  - [ ] Margin bottom: ___px before visualization
  - [ ] Color: Consistent with page headings

- [ ] **Description (if any)**
  - [ ] Explains what visualization shows
  - [ ] Font size: ___px
  - [ ] Margin below: ___px before visualization loads

#### Visualization Component (e.g., RoPEViz, KVCacheDashboard)

**Container:**
- [ ] **Wrapper div**
  - [ ] Width: Full content width or constrained
  - [ ] Height: Appropriate (not squished, not huge)
  - [ ] Background: _______ (if not transparent)
  - [ ] Border: ___px, color _______ (if any)
  - [ ] Border radius: ___px
  - [ ] Padding: ___px
  - [ ] Margin: ___px top/bottom (separated from text)
  - [ ] Shadow: Subtle depth (if designed)

**SVG/Canvas:**
- [ ] **Rendering area**
  - [ ] Canvas loads (not blank)
  - [ ] Dimensions: ___px width × ___px height
  - [ ] ViewBox: Preserves aspect ratio on resize
  - [ ] No clipping of visual elements
  - [ ] Background color (if any): _______
  - [ ] Grid lines (if present): ___px spacing, color _______

**Visual Elements (example: RoPEViz):**
- [ ] **Vectors/arrows**
  - [ ] Color: _______ (from MATH_COLORS palette)
  - [ ] Stroke width: ___px
  - [ ] Arrowheads: Proportional, not too large/small
  - [ ] Length: Represents data correctly
  - [ ] Smooth curves (anti-aliased)

- [ ] **Labels/Text on viz**
  - [ ] Font size: ___px (readable, not tiny)
  - [ ] Color: _______ (contrasts with background)
  - [ ] Positioned: Not overlapping visual elements
  - [ ] Axis labels: Present (X, Y if applicable)
  - [ ] Value labels: Update in real-time with sliders

- [ ] **Axes (if present)**
  - [ ] Line thickness: ___px
  - [ ] Color: _______ (subtle, not overpowering)
  - [ ] Tick marks: Evenly spaced, labeled
  - [ ] Origin (0,0): Marked clearly (if relevant)

**Controls/Sliders:**
- [ ] **Slider 1: ________ (e.g., "Position")**
  - [ ] Label: Clear text above/beside slider
  - [ ] Label font size: ___px
  - [ ] Current value display: Shows number (e.g., "5")
  - [ ] Value updates on drag
  - [ ] Slider track: Visible, colored
  - [ ] Slider thumb: ___px size (touch-friendly ≥44px)
  - [ ] Thumb color: _______ (contrasts with track)
  - [ ] Min/max labels: Present (e.g., "0" - "10")
  - [ ] Smooth dragging (no lag)
  - [ ] Responsive: Usable on mobile (large enough)

- [ ] **Slider 2: ________ (e.g., "Dimension")**
  - [ ] (Repeat all above checks)

- [ ] **Slider 3: ________ (e.g., "Global Shift")**
  - [ ] (Repeat all above checks)

- [ ] **Slider layout**
  - [ ] Stacked vertically or horizontal group
  - [ ] Spacing between sliders: ___px
  - [ ] Aligned: All sliders same width
  - [ ] Labels aligned (left/center)
  - [ ] Positioned: Below viz or side panel

**Insight/Info Box (if present):**
- [ ] **Box container**
  - [ ] Background: _______ (light blue, yellow, etc.)
  - [ ] Border: ___px, color _______ or none
  - [ ] Border radius: ___px
  - [ ] Padding: ___px
  - [ ] Margin: ___px from visualization
  - [ ] Icon (💡, ℹ️): Displays correctly, aligned left

- [ ] **Text content**
  - [ ] Font size: ___px
  - [ ] Color: _______ (readable against box background)
  - [ ] Bold keywords: Highlight important terms
  - [ ] Doesn't overflow box
  - [ ] Updates dynamically (if tied to slider values)

**Responsive behavior:**
- [ ] **Desktop (>1280px)**
  - [ ] Visualization full width or centered
  - [ ] Sliders positioned ergonomically
  - [ ] All elements visible without scroll

- [ ] **Tablet (768-1279px)**
  - [ ] Visualization scales down proportionally
  - [ ] Sliders still usable (not too small)
  - [ ] Layout stacks if needed

- [ ] **Mobile (<768px)**
  - [ ] Visualization: Maintains aspect ratio, not squished
  - [ ] Sliders: Full width, stacked vertically
  - [ ] Slider thumbs: Large enough to tap (≥44px)
  - [ ] Text labels: Not cut off
  - [ ] Scrollable if tall (doesn't overflow viewport)

**Performance:**
- [ ] **Real-time updates**
  - [ ] Dragging slider: Viz updates every frame (smooth)
  - [ ] No lag between slider and visual change
  - [ ] No flickering or redraw artifacts
  - [ ] Frame rate: ≥30 FPS (check DevTools Performance)

- [ ] **Initial load**
  - [ ] Appears within 1 second
  - [ ] No "Loading..." stuck state
  - [ ] No blank space before render

### 3.4 Prerequisites Section (if present)

- [ ] **Heading: "Prerequisites"**
  - [ ] Font size: ___px
  - [ ] Margin top: ___px
  - [ ] Margin bottom: ___px

- [ ] **Prerequisite badges/chips**
  - [ ] Each prerequisite: Clickable pill/badge
  - [ ] Background: _______ (light, matches category color)
  - [ ] Text color: _______
  - [ ] Font size: ___px
  - [ ] Padding: ___px horizontal, ___px vertical
  - [ ] Border radius: ___px (pill-shaped)
  - [ ] Spacing between badges: ___px
  - [ ] Wrap to new line if many (not overflow)
  - [ ] Hover: Darkens or lifts
  - [ ] Click: Navigates to prerequisite concept page

### 3.5 Related Concepts (if present)

- [ ] **Section layout**
  - [ ] Heading: "Related Concepts" or similar
  - [ ] Margin top: ___px from previous section
  - [ ] Background (if distinct): _______

- [ ] **Related concept cards**
  - [ ] Smaller than main concept cards
  - [ ] Grid or horizontal scroll
  - [ ] Same card styling as foundations index
  - [ ] Shows: Icon, title, (optional description)
  - [ ] Clickable, navigates correctly

---

## 4. PILLAR PAGES (/pillars/[slug])

### 4.1 Visual Consistency Check

**Test on ALL 5 pillar pages:**
1. [ ] /pillars/sequence-modeling
2. [ ] /pillars/optimization
3. [ ] /pillars/generative-physics
4. [ ] /pillars/geometric-dl
5. [ ] /pillars/mech-interp

**For each page, verify:**

#### Header
- [ ] **Page title**
  - [ ] Font size: ___px (consistent across all 5)
  - [ ] Color: _______ (same on all pages)
  - [ ] Alignment: Same position on all pages
  - [ ] Margin top/bottom: Identical spacing

- [ ] **Hero background (if any)**
  - [ ] Image/color specific to pillar theme
  - [ ] No pixelation
  - [ ] Height: ___px (consistent across pages)
  - [ ] Text overlays readable (contrast check)

#### Content Layout
- [ ] **Text content**
  - [ ] Width: Same max-width on all pages
  - [ ] Padding: Consistent left/right
  - [ ] Typography: Same font sizes for H2, H3, body
  - [ ] Spacing: Same rhythm (heading margins, paragraph gaps)

- [ ] **Images/Diagrams (if present)**
  - [ ] Size: Appropriate, not too large
  - [ ] Alignment: Centered or consistent
  - [ ] Captions: Below image, styled consistently
  - [ ] Quality: High resolution, no blur
  - [ ] Responsive: Scales on mobile, doesn't overflow

#### Related Concepts
- [ ] **Section**
  - [ ] Present on all pillar pages
  - [ ] Same position (bottom, side, etc.)
  - [ ] Heading styled identically
  - [ ] Cards: Same design as concept cards

### 4.2 Theme Colors

- [ ] **Sequence Modeling theme color: _______**
  - [ ] Used in: Title, accents, badges
  - [ ] Consistent with concept category color

- [ ] **Optimization theme color: _______**
  - [ ] (Same checks)

- [ ] **Generative Physics theme color: _______**
  - [ ] (Same checks)

- [ ] **Geometric DL theme color: _______**
  - [ ] (Same checks)

- [ ] **Mech Interp theme color: _______**
  - [ ] (Same checks)

---

## 5. RESPONSIVE DESIGN VISUAL TESTS

### 5.1 Breakpoint Testing

**Test at these specific widths (use DevTools responsive mode):**

#### 1920px (Large Desktop)
- [ ] **All pages**
  - [ ] Content not too wide (max-width constraint active)
  - [ ] No excessive whitespace on sides
  - [ ] Images/visualizations scale appropriately
  - [ ] Text line length comfortable (<80 chars)

#### 1280px (Standard Desktop)
- [ ] **Homepage**
  - [ ] Hero section: Full viewport, centered
  - [ ] Five pillars: All 5 in one row OR 3+2 rows
  - [ ] Knowledge graph: Centered, appropriate size

- [ ] **Foundations index**
  - [ ] Concept cards: __ columns (3-4)
  - [ ] Gap between cards: Consistent
  - [ ] No horizontal scroll

- [ ] **Concept page**
  - [ ] Visualization: Full content width
  - [ ] Text: Max-width active, readable
  - [ ] Sliders: Appropriately sized

#### 1024px (Tablet Landscape)
- [ ] **Homepage**
  - [ ] Five pillars: Wrap to 2-3 per row
  - [ ] Spacing adjusts (not cramped)

- [ ] **Foundations index**
  - [ ] Cards: __ columns (2-3)
  - [ ] All cards visible (no cutoff)

- [ ] **Concept page**
  - [ ] Visualization: Scales down, maintains ratio
  - [ ] Text: Still comfortable width
  - [ ] Sidebar (if any): Converts to stacked layout

#### 768px (Tablet Portrait)
- [ ] **Homepage**
  - [ ] Five pillars: 2 per row
  - [ ] Hero text: Font size reduces slightly
  - [ ] Knowledge graph: Smaller but usable

- [ ] **Foundations index**
  - [ ] Cards: 2 columns
  - [ ] Padding left/right: ≥16px

- [ ] **Nav**
  - [ ] Switches to hamburger menu
  - [ ] Logo still visible

- [ ] **Concept page**
  - [ ] Text: Full width (max-width increases)
  - [ ] Visualization: Still functional, not tiny
  - [ ] Sliders: Stack vertically

#### 480px (Mobile Large)
- [ ] **All pages**
  - [ ] Single column layout
  - [ ] No horizontal scroll
  - [ ] Touch targets: ≥44px
  - [ ] Font sizes: Readable (≥16px body)

- [ ] **Homepage**
  - [ ] Hero: Centered, text readable
  - [ ] Pillars: Stacked 1 per row
  - [ ] CTA button: Full width or centered

- [ ] **Foundations index**
  - [ ] Cards: 1 per row
  - [ ] Card height: Comfortable (not too tall)

#### 375px (Mobile Medium - iPhone SE)
- [ ] **All pages**
  - [ ] Content fits (no overflow)
  - [ ] Text doesn't touch edges (≥16px padding)
  - [ ] Buttons: Not too wide (no awkward wrapping)

- [ ] **Concept page**
  - [ ] Visualization: Maintains aspect ratio
  - [ ] Math equations: No horizontal scroll (or scrollable)
  - [ ] Sliders: Full width, usable

#### 320px (Mobile Small - Rare but test)
- [ ] **All pages**
  - [ ] No broken layouts
  - [ ] Text readable (may require zoom)
  - [ ] Critical elements functional
  - [ ] Graceful degradation

### 5.2 Orientation Testing (Mobile)

**Portrait:**
- [ ] All elements visible without excessive scroll
- [ ] Nav menu opens correctly
- [ ] Visualizations: Taller than wide (if responsive design)

**Landscape:**
- [ ] Nav bar: Doesn't take too much vertical space
- [ ] Content: Utilizes horizontal space efficiently
- [ ] Visualizations: Wider layout, not squished
- [ ] Sliders: May convert to horizontal layout

---

## 6. CROSS-PAGE CONSISTENCY

### 6.1 Typography Consistency

**Measure on 3+ different pages:**

| Element | Page 1 | Page 2 | Page 3 | Match? |
|---------|--------|--------|--------|--------|
| H1 size | ___px | ___px | ___px | [ ] |
| H2 size | ___px | ___px | ___px | [ ] |
| Body size | ___px | ___px | ___px | [ ] |
| Body color | _______ | _______ | _______ | [ ] |
| Link color | _______ | _______ | _______ | [ ] |
| Line height | ___ | ___ | ___ | [ ] |

### 6.2 Color Palette Consistency

**MATH_COLORS verification:**
- [ ] **Category colors match across all instances**
  - [ ] Sequence Modeling: _______ (same on index, card, page)
  - [ ] Optimization: _______
  - [ ] Generative Physics: _______
  - [ ] Geometric DL: _______
  - [ ] Mech Interp: _______
  - [ ] Efficiency: _______
  - [ ] Architecture: _______

- [ ] **Accent colors**
  - [ ] Primary: _______ (buttons, links)
  - [ ] Secondary: _______ (badges, highlights)
  - [ ] Background: _______ (page background consistent)
  - [ ] Card background: _______ (same on all cards)

### 6.3 Spacing System

- [ ] **Consistent spacing units**
  - [ ] Small gap: ___px (used for tight spacing)
  - [ ] Medium gap: ___px (card padding, section margins)
  - [ ] Large gap: ___px (section-to-section spacing)
  - [ ] Applied consistently across all pages

### 6.4 Component Styling

- [ ] **Buttons**
  - [ ] Same style on all pages (color, size, radius)
  - [ ] Hover state: Consistent transition and effect
  - [ ] Disabled state (if any): Same appearance

- [ ] **Cards**
  - [ ] Same border radius across all cards (___px)
  - [ ] Same shadow depth
  - [ ] Same padding (___px)
  - [ ] Same hover effect

- [ ] **Badges**
  - [ ] Same size across all instances
  - [ ] Same border radius (___px)
  - [ ] Same font size and weight
  - [ ] Color from palette (consistent)

---

## 7. ANIMATION & TRANSITIONS

### 7.1 Hover Effects

**Test on 10+ interactive elements:**

- [ ] **Duration**
  - [ ] All hover transitions: ___ms (100-300ms typical)
  - [ ] Consistent across similar elements
  - [ ] Not instant (jarring) or too slow (laggy)

- [ ] **Easing**
  - [ ] Smooth acceleration (ease-in-out or similar)
  - [ ] Not linear (robotic feel)
  - [ ] Same easing function across site

- [ ] **Properties**
  - [ ] Cards: Scale, translate, shadow, or color
  - [ ] Buttons: Background color, scale, or shadow
  - [ ] Links: Underline, color
  - [ ] No unexpected properties changing

### 7.2 Page Transitions

- [ ] **Navigation**
  - [ ] Fade-in on new page load (if designed)
  - [ ] Duration: ___ms
  - [ ] No white flash between pages
  - [ ] Smooth in all browsers

### 7.3 Visualization Animations

- [ ] **D3 force simulation (knowledge graph)**
  - [ ] Nodes animate to final position over ___ms
  - [ ] No jittery movement
  - [ ] Stabilizes and stops (not infinite oscillation)
  - [ ] Frame rate: Smooth (≥30 FPS)

- [ ] **Slider-driven animations**
  - [ ] Updates: Instant or smooth transition (___ms)
  - [ ] No stutter during drag
  - [ ] Consistent across all visualizations

### 7.4 Scroll Animations (if any)

- [ ] **Fade-in on scroll**
  - [ ] Elements appear at correct scroll position
  - [ ] Fade-in duration: ___ms
  - [ ] Once per page load (doesn't repeat on scroll up/down)
  - [ ] No layout shift as elements appear

- [ ] **Parallax effects (if any)**
  - [ ] Smooth motion
  - [ ] Doesn't break on mobile
  - [ ] Respects prefers-reduced-motion

---

## 8. VISUAL POLISH & DETAILS

### 8.1 Images

- [ ] **Quality**
  - [ ] All images: High resolution (no pixelation)
  - [ ] Retina displays: 2x images used (if applicable)
  - [ ] No compression artifacts (blockiness)

- [ ] **Loading**
  - [ ] Lazy loading: Images below fold load as you scroll
  - [ ] Placeholder: Blur-up or skeleton screen (not blank space)
  - [ ] No layout shift as images load (height reserved)

- [ ] **Styling**
  - [ ] Border radius: Consistent if rounded (___px)
  - [ ] Shadow: Subtle depth (if designed)
  - [ ] Alignment: Centered or left/right as intended
  - [ ] Captions: Positioned correctly, styled consistently

### 8.2 Icons & Emoji

- [ ] **Rendering**
  - [ ] All emoji display correctly (not boxes with ?)
  - [ ] SVG icons: Crisp edges, no blur
  - [ ] Icon size: Consistent across similar contexts
  - [ ] Color: From palette or designed color

- [ ] **Alignment**
  - [ ] Icons with text: Vertically centered
  - [ ] Spacing from text: ___px (not touching)
  - [ ] No shifting on hover

### 8.3 Shadows & Depth

- [ ] **Card shadows**
  - [ ] Offset: X ___px, Y ___px
  - [ ] Blur: ___px
  - [ ] Color: _______ with ___% opacity
  - [ ] Consistent across all cards
  - [ ] Hover: Shadow grows (offset or blur increases)

- [ ] **Button shadows**
  - [ ] Similar style to cards or no shadow
  - [ ] Pressed state: Shadow reduces (depth effect)

- [ ] **Elevation hierarchy**
  - [ ] Nav bar: Highest shadow (if sticky)
  - [ ] Modals/popovers: High shadow (above content)
  - [ ] Cards: Medium shadow
  - [ ] Page background: No shadow

### 8.4 Borders & Dividers

- [ ] **Card borders**
  - [ ] Thickness: ___px
  - [ ] Color: _______ (subtle, not harsh)
  - [ ] Consistent across all cards

- [ ] **Section dividers**
  - [ ] Horizontal lines: ___px height, color _______
  - [ ] Positioned: Between major sections
  - [ ] Margin: ___px above/below

- [ ] **Input borders**
  - [ ] Default: ___px, color _______
  - [ ] Focus: ___px, color _______ (thicker or different color)
  - [ ] Error: Red or warning color

### 8.5 Loading States

- [ ] **Visualizations**
  - [ ] Spinner or skeleton: Appears during load
  - [ ] Style: Matches design system
  - [ ] Positioned: Centered in container
  - [ ] Doesn't cause layout shift when replaced

- [ ] **Lazy-loaded images**
  - [ ] Blur-up: Low-res version shows first
  - [ ] Smooth transition to full resolution

- [ ] **Page load**
  - [ ] No FOUC (Flash of Unstyled Content)
  - [ ] Fonts load gracefully (FOUT/FOIT handled)

### 8.6 Empty States (if applicable)

- [ ] **No results**
  - [ ] Message: Clear and helpful
  - [ ] Icon/illustration: Friendly, not jarring
  - [ ] Centered on page
  - [ ] Suggests action (if applicable)

- [ ] **Missing data**
  - [ ] Placeholder text: Italicized or distinct
  - [ ] Doesn't break layout

---

## 9. FOCUS & ACCESSIBILITY VISUAL

### 9.1 Focus Indicators

**Tab through 10+ interactive elements:**

- [ ] **Visibility**
  - [ ] Outline: ___px, color _______
  - [ ] Offset: ___px from element edge
  - [ ] High contrast (visible on all backgrounds)
  - [ ] Shape: Follows element shape (rounded for rounded buttons)

- [ ] **Consistency**
  - [ ] All buttons: Same focus style
  - [ ] All links: Same focus style
  - [ ] All inputs: Same focus style
  - [ ] Visualizations: Focusable controls have focus state

- [ ] **Removal check**
  - [ ] NO `outline: none` without custom replacement
  - [ ] Custom focus: Equal or better visibility than default

### 9.2 Visual Hierarchy for Screen Readers

- [ ] **Headings**
  - [ ] Visual size matches semantic level (H1 largest, H2 smaller, etc.)
  - [ ] No skipped heading levels (H2 after H1, not H1 to H3)

- [ ] **Landmarks**
  - [ ] Visually distinct regions (header, main, footer)
  - [ ] Background colors or spacing separate regions

### 9.3 Color-Only Information

- [ ] **Links**
  - [ ] Not distinguished by color alone (underline or bold)
  - [ ] Hover: Additional visual cue (not just color change)

- [ ] **Category badges**
  - [ ] Color + text label (not color alone)
  - [ ] Colorblind-friendly palette

- [ ] **Visualizations**
  - [ ] Charts: Patterns or labels in addition to color
  - [ ] Lines: Different dashed styles if multiple lines same color

---

## 10. EDGE CASES & STRESS TESTS

### 10.1 Long Content

- [ ] **Long concept title**
  - [ ] Wraps to new line gracefully (not cut off)
  - [ ] No overflow out of card
  - [ ] Card height adjusts (or title truncates with ...)

- [ ] **Long description**
  - [ ] Clamps at __ lines (if designed)
  - [ ] Ellipsis at end if truncated
  - [ ] Full text visible on concept page

- [ ] **Long math equation**
  - [ ] Scrollable horizontally (or breaks to new line)
  - [ ] Doesn't overflow page width
  - [ ] Scroll indicator visible

- [ ] **Long pillar content**
  - [ ] Readable (max-width constraint)
  - [ ] No horizontal scroll
  - [ ] Images interspersed (not wall of text)

### 10.2 Minimal Content

- [ ] **Short description**
  - [ ] Card height: Same as others or adapts
  - [ ] Extra space: Handled gracefully (no awkward gaps)

- [ ] **Few concepts (hypothetical)**
  - [ ] Grid: Centers or left-aligns (not scattered)
  - [ ] No empty card placeholders

### 10.3 Special Characters

- [ ] **In titles**
  - [ ] Quotes (" "): Render correctly (curly vs straight)
  - [ ] Apostrophes ('): No encoding issues (‚Äô)
  - [ ] Ampersand (&): Not &amp;
  - [ ] Hyphen/en-dash/em-dash: Correct character

- [ ] **In math**
  - [ ] Greek letters: α β γ δ ε θ λ μ π σ ω
  - [ ] Operators: ≤ ≥ ≠ ≈ ∞ ∇ ∂ ∫ ∑ ∏
  - [ ] Arrows: → ← ↔ ⇒ ⇐ ⇔
  - [ ] All render correctly, not boxes

### 10.4 Browser Zoom

**Test at 200% zoom (Ctrl/Cmd + +):**
- [ ] **All pages**
  - [ ] Text readable (no overlap)
  - [ ] Images scale (or crop appropriately)
  - [ ] Layout doesn't break (no horizontal scroll)
  - [ ] Interactive elements still usable

**Test at 50% zoom (Ctrl/Cmd + -):**
- [ ] **All pages**
  - [ ] Content still centered or aligned
  - [ ] No visual glitches (tiny text, huge images)

---

## 11. PRINT STYLES (Optional)

**Test: Ctrl/Cmd + P (print preview)**

- [ ] **Layout**
  - [ ] Content: Fits within printable area
  - [ ] Navigation: Hidden (not printed)
  - [ ] Footer: Simplified or hidden

- [ ] **Styling**
  - [ ] Background images: Removed (save ink)
  - [ ] Colors: High contrast for B&W printing
  - [ ] Links: URLs shown in parentheses (if designed)
  - [ ] Math equations: Render correctly

---

## 12. FINAL VISUAL SIGN-OFF

### 12.1 Brand Consistency

- [ ] **Overall aesthetic**
  - [ ] Matches intended tone (scholarly, playful, professional)
  - [ ] Cohesive design language across all pages
  - [ ] No jarring style shifts

- [ ] **Logo/Identity**
  - [ ] Consistent placement (nav bar)
  - [ ] Correct version (color, size)
  - [ ] High resolution

### 12.2 Content Quality

- [ ] **Imagery**
  - [ ] Relevant to content
  - [ ] High quality (professional or well-designed)
  - [ ] Licensed/owned (not watermarked)

- [ ] **Icons**
  - [ ] Consistent style (all outlined, all filled, etc.)
  - [ ] From same icon set or visually cohesive

- [ ] **Placeholder content**
  - [ ] NO "Lorem ipsum" on live site
  - [ ] NO "[TODO]" or "[TK]" visible
  - [ ] All images final (not temp placeholders)

### 12.3 Overall Polish

- [ ] **Professional appearance**
  - [ ] No Comic Sans or inappropriate fonts
  - [ ] Aligned elements (use ruler tool)
  - [ ] Consistent spacing (no random gaps)
  - [ ] Balanced layouts (not top-heavy or lopsided)

- [ ] **Details**
  - [ ] Favicons: Display correctly in browser tab
  - [ ] Page titles: Unique and descriptive per page
  - [ ] Meta descriptions: Present (check page source)
  - [ ] Open Graph images: Set for social sharing (test with FB debugger)

- [ ] **Errors**
  - [ ] No broken image icons (red X or missing img)
  - [ ] No 404 links (all assets load)
  - [ ] No console errors affecting visuals
  - [ ] No deprecated browser warnings

---

## TESTING SIGN-OFF

**Tester Name:** ________________
**Date:** ________________
**Browser(s) Tested:** ________________
**Device(s) Tested:** ________________

**Summary of Issues Found:** _____ Critical, _____ High, _____ Medium, _____ Low

**Overall Visual Quality Rating:** ☐ Excellent ☐ Good ☐ Fair ☐ Poor

**Ready for Launch?** ☐ Yes ☐ No (specify blockers): ________________

**Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

## Additional Resources

### Browser Extensions for Visual Testing

- **PixelParallel** - On-screen ruler for measuring spacing
- **ColorZilla** - Color picker and eyedropper tool
- **Viewport Resizer** - Quick responsive testing
- **WhatFont** - Identify fonts and sizes
- **Accessibility Insights** - Automated A11y checks
- **Lighthouse** - Performance and quality audits

### Recommended Testing Order

1. **Quick smoke test** (10 min): Homepage → 3 random concept pages → Build passes
2. **Homepage deep dive** (30 min): All sections, all interactive elements
3. **Foundations pages** (45 min): Index + 5 concept pages with visualizations
4. **Responsive testing** (30 min): 6 breakpoints on key pages
5. **Cross-page consistency** (20 min): Typography, colors, spacing checks
6. **Edge cases** (15 min): Long content, special characters, zoom
7. **Final polish** (10 min): Overall aesthetic review

**Total time estimate: ~2.5 hours for thorough visual QA**

---

`★ Key Testing Insights`

1. **Math rendering failures are user-facing catastrophes** - KaTeX issues show raw LaTeX to users (e.g., `\frac{1}{2}` instead of ½). These pass code tests but destroy credibility. Check every concept page for "Math Processing Error" or visible LaTeX syntax.

2. **Responsive breakpoints hide edge cases** - Test at exact breakpoint boundaries (768px, 767px, 769px) where CSS Grid/Flexbox can "snap" incorrectly. Also test landscape mobile orientation where vertical space is constrained.

3. **Visual consistency reveals architectural debt** - If you find concept count mismatches ("17" vs "18" vs "19" in different places), it indicates hardcoded values instead of a single source of truth. Log these as tech debt to prevent future divergence.

4. **Interactive visualizations have three failure modes** - (1) Don't load (SSR mismatch), (2) Load but don't respond to input (event handlers missing), (3) Respond but lag/flicker (performance issue). Test all three for every viz component.
