/**
 * Custom category icons — a single, consistent line-icon set replacing the
 * emoji, which rendered differently on every OS and read as casual. One stroke
 * weight, one style, brand colour — the minimal monochrome look real grocery
 * apps use. Inline SVG so it inherits currentColor, scales cleanly, needs no
 * dependency, and works offline.
 *
 * Keyed by department slug, with a basket fallback so a new category always
 * has an icon.
 */
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, React.ReactNode> = {
  // Meat & Eggs — drumstick
  "meat-eggs": (
    <>
      <path d="M13.8 4.6a4.3 4.3 0 0 0-6 6l.5.6-3.1 3.1a2.1 2.1 0 1 0 3 3l3.1-3.1.6.5a4.3 4.3 0 0 0 6-6 4.3 4.3 0 0 0-4.1-4.1Z" />
      <path d="M7.2 14.2 4.8 16.6" />
    </>
  ),
  // Fruits & Vegetables — apple + leaf
  "fruits-vegetables": (
    <>
      <path d="M12 8.5c-1.2-1.8-4-2.2-5.6-.8-1.9 1.6-1.4 5.6.8 8.3 1.3 1.6 2.8 2.5 4.8 2.5s3.5-.9 4.8-2.5c2.2-2.7 2.7-6.7.8-8.3-1.6-1.4-4.4-1-5.6.8Z" />
      <path d="M12 8.5V6c0-1.4 1.1-2.6 2.6-2.6" />
    </>
  ),
  // Rice — bowl with steam
  rice: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0Z" />
      <path d="M9 8.5c0-1 1-1.2 1-2.2M12 8.5c0-1 1-1.2 1-2.2M15 8.5c0-1 1-1.2 1-2.2" />
    </>
  ),
  // Flour & Flatbreads — wheat stalk
  "flour-flatbreads": (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c-1.8 0-2.8-1.3-2.8-2.9C11 9.1 12 10.4 12 12ZM12 12c1.8 0 2.8-1.3 2.8-2.9C13 9.1 12 10.4 12 12Z" />
      <path d="M12 8.5c-1.8 0-2.8-1.3-2.8-2.9C11 5.6 12 6.9 12 8.5ZM12 8.5c1.8 0 2.8-1.3 2.8-2.9C13 5.6 12 6.9 12 8.5Z" />
    </>
  ),
  // Lentils & Beans — two beans
  "lentils-beans": (
    <>
      <circle cx="9.2" cy="10" r="3.1" />
      <circle cx="14.8" cy="14" r="3.1" />
    </>
  ),
  // Spices — jar with grains
  spices: (
    <>
      <rect x="7.5" y="9" width="9" height="11" rx="2" />
      <path d="M8.8 9V7.2a1 1 0 0 1 1-1h4.4a1 1 0 0 1 1 1V9" />
      <circle cx="10.4" cy="13" r=".55" fill="currentColor" stroke="none" />
      <circle cx="13.2" cy="14.2" r=".55" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="16.2" r=".55" fill="currentColor" stroke="none" />
    </>
  ),
  // Oil & Ghee — bottle
  "oil-ghee": (
    <>
      <path d="M10.2 3.5h3.6v2.2l1 2.1V19a1.8 1.8 0 0 1-1.8 1.8h-2A1.8 1.8 0 0 1 9.2 19V7.8l1-2.1Z" />
      <path d="M9.2 11h5.6" />
    </>
  ),
  // Dairy — milk carton
  "dairy-fresh": (
    <>
      <path d="M8 9.2 12 4l4 5.2" />
      <path d="M8 9.2h8V19a1.2 1.2 0 0 1-1.2 1.2H9.2A1.2 1.2 0 0 1 8 19V9.2Z" />
      <path d="M12 4v5.2" />
    </>
  ),
  // Snacks & Sweets — cookie
  "snacks-sweets": (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="10" cy="10" r=".6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="11" r=".6" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="14" r=".6" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="14.5" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  // Instant Food — bowl with chopsticks
  "instant-food": (
    <>
      <path d="M4 13h16a8 8 0 0 1-16 0Z" />
      <path d="M13.5 4.5 18 11M16.5 3.5 20 11" />
    </>
  ),
  // Pickles — jar with contents
  pickles: (
    <>
      <rect x="7.5" y="8" width="9" height="12" rx="2" />
      <path d="M8.8 8V6.6a1 1 0 0 1 1-1h4.4a1 1 0 0 1 1 1V8" />
      <path d="M10 12.5c1.4 0 2 1 2 2.4M14 12c-1.2.2-1.6 1-1.6 2.2" />
    </>
  ),
  // Beverages — teacup with steam
  beverages: (
    <>
      <path d="M6 9h11l-.8 9.2A2 2 0 0 1 14.2 20H8.8a2 2 0 0 1-2-1.8L6 9Z" />
      <path d="M17 11a2.2 2.2 0 0 1 0 4.2" />
      <path d="M9.5 6c0-1 1-1.2 1-2.2M12.5 6c0-1 1-1.2 1-2.2" />
    </>
  ),
  // Household & Pooja — shopping bag
  household: (
    <>
      <path d="M6 8.5h12l-1 11.3a1.2 1.2 0 0 1-1.2 1.1H8.2A1.2 1.2 0 0 1 7 19.8L6 8.5Z" />
      <path d="M9 8.5v-1a3 3 0 0 1 6 0v1" />
    </>
  ),
};

const DEFAULT_ICON = (
  <>
    <path d="M5 9h14l-1.1 9.1a2 2 0 0 1-2 1.7H8.1a2 2 0 0 1-2-1.7L5 9Z" />
    <path d="M9 9 12 4l3 5" />
  </>
);

export function CategoryIcon({
  slug,
  className = "size-5",
}: {
  slug: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...STROKE}>
      {ICONS[slug] ?? DEFAULT_ICON}
    </svg>
  );
}

/**
 * A soft, natural tint per department — grounded in the real colour of the
 * food (leaf-green produce, clay meat, wheat-gold rice, paprika spices) and
 * kept low-saturation so the set stays cohesive and premium rather than loud.
 * Mostly greens, with a few earthy accents where the food genuinely is that
 * colour. Returns background + foreground for an icon chip.
 */
export function categoryTint(slug: string): { bg: string; fg: string } {
  const T: Record<string, [string, string]> = {
    "meat-eggs": ["hsl(12 45% 93%)", "hsl(10 48% 38%)"], // clay
    "fruits-vegetables": ["hsl(96 46% 90%)", "hsl(100 50% 30%)"], // leaf
    rice: ["hsl(43 52% 90%)", "hsl(36 46% 37%)"], // wheat cream
    "flour-flatbreads": ["hsl(38 52% 90%)", "hsl(32 46% 38%)"], // gold
    "lentils-beans": ["hsl(72 40% 88%)", "hsl(74 42% 30%)"], // olive
    spices: ["hsl(28 62% 91%)", "hsl(22 58% 40%)"], // paprika amber
    "oil-ghee": ["hsl(54 48% 90%)", "hsl(48 44% 35%)"], // ghee yellow
    "dairy-fresh": ["hsl(162 34% 90%)", "hsl(164 36% 30%)"], // mint
    "snacks-sweets": ["hsl(346 30% 93%)", "hsl(344 32% 44%)"], // soft rose
    "instant-food": ["hsl(176 34% 89%)", "hsl(180 38% 28%)"], // teal
    pickles: ["hsl(82 46% 88%)", "hsl(82 46% 30%)"], // lime olive
    beverages: ["hsl(140 26% 89%)", "hsl(142 32% 30%)"], // sage
    household: ["hsl(150 30% 89%)", "hsl(152 36% 30%)"], // green
  };
  const [bg, fg] = T[slug] ?? ["hsl(140 30% 91%)", "hsl(150 35% 30%)"];
  return { bg, fg };
}
