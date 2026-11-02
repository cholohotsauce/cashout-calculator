/**
 * One line of bar-side commentary under the cash-out total. Usually picked by how good the night
 * was (FOH dollars per hour); sometimes it's an inside joke about who's on the tip-out or which
 * regular showed up. A few exact totals are easter eggs. The pick is stable for a given cash-out,
 * so the line doesn't change every time the screen re-renders.
 */

const TIERS: { below: number; lines: string[] }[] = [
  {
    below: 8,
    lines: [
      "Slow night. The ice machine worked harder than the register.",
      "Quiet one. At least the bathrooms got cleaned. Probably.",
      "Character-building shift. Character doesn't pay rent, though.",
      "Slow night. The machine printed receipts out of pure boredom.",
      "Slow one. Even the fruit flies clocked out early.",
    ],
  },
  {
    below: 18,
    lines: [
      "Solid shift. Nobody cried in the walk-in.",
      "Respectable. The regulars came through.",
      "Steady night. Somebody remembered the limes.",
      "Not bad. The machine only froze twice.",
      "Solid night. Only three people asked for “something fruity, but not too sweet.”",
    ],
  },
  {
    below: 30,
    lines: [
      "Good night. Tip your bartender. Oh wait.",
      "Strong shift. Somebody ring the bell.",
      "Nice. That's a lot of well-poured drinks.",
      "Good night. Somebody finally laughed at the bartender's jokes.",
      "Good night. The kitchen earned every cent of their cut.",
    ],
  },
  {
    below: Infinity,
    lines: [
      "Legendary. Frame this one.",
      "Big night. The machine needs a cigarette.",
      "Big night. Your feet hate you. Your wallet doesn't.",
      "Monster shift. Somebody buy the kitchen a round.",
    ],
  },
];

const EXACT: Record<number, string> = {
  2100: "Blackjack. The Ace approves.",
  10000: "A clean hundred. Suspiciously round.",
  77700: "Lucky sevens. Drinks are still not on the house.",
};

type Ctx = { names: Set<string>; weekday: number; h: number };

/** Inside jokes. Each one says whether it applies tonight. */
const INSIDE: { when: (c: Ctx) => boolean; line: string }[] = [
  // Big Dog is a Monday regular, so he shows up most on Mondays and now and then otherwise.
  { when: (c) => c.weekday === 1 || c.h % 6 === 0, line: "Big Dog only burped twice tonight." },
  { when: (c) => c.names.has("daniel"), line: "Daniel did not find his future wife tonight." },
  { when: (c) => c.names.has("nat") && c.names.has("archie"), line: "Nat only called Archie an idiot once tonight. Good shift then!" },
];

/** Small string hash so the same cash-out always gets the same line. */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function cashOutQuip({
  totalTips,
  fohRate,
  names = [],
  weekday = -1,
  seed = "",
}: {
  totalTips: number;
  fohRate: number;
  /** Who's on the tip-out tonight. */
  names?: string[];
  /** Day of the shift, 0 = Sunday. */
  weekday?: number;
  seed?: string;
}) {
  const exact = EXACT[Math.round(totalTips * 100)];
  if (exact) return exact;
  if (totalTips <= 0) return "";
  const h = hash(seed);
  const ctx: Ctx = { names: new Set(names.map((n) => n.trim().toLowerCase())), weekday, h };
  const inside = INSIDE.filter((j) => j.when(ctx));
  // Roughly one cash-out in three gets an inside joke when one applies, so they stay a surprise.
  if (inside.length > 0 && (h >>> 3) % 3 === 0) return inside[(h >>> 5) % inside.length].line;
  const tier = TIERS.find((t) => fohRate < t.below) ?? TIERS[TIERS.length - 1];
  return tier.lines[h % tier.lines.length];
}
