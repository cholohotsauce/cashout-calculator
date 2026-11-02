/**
 * One line of bar-side commentary under the cash-out total. Picked by how good the night was
 * (FOH dollars per hour), with a couple of exact-total easter eggs. The pick is stable for a given
 * cash-out, so the line doesn't change every time the screen re-renders.
 */

const TIERS: { below: number; lines: string[] }[] = [
  {
    below: 8,
    lines: [
      "Slow night. The ice machine worked harder than the register.",
      "Quiet one. At least the bathrooms got cleaned. Probably.",
      "Character-building shift. Character doesn't pay rent, though.",
    ],
  },
  {
    below: 18,
    lines: [
      "Solid shift. Nobody cried in the walk-in.",
      "Respectable. The regulars came through.",
      "Steady night. Somebody remembered the limes.",
    ],
  },
  {
    below: 30,
    lines: [
      "Good night. Tip your bartender. Oh wait.",
      "Strong shift. Somebody ring the bell.",
      "Nice. That's a lot of well-poured drinks.",
    ],
  },
  {
    below: Infinity,
    lines: [
      "Legendary. Frame this one.",
    ],
  },
];

const EXACT: Record<number, string> = {
  2100: "Blackjack. The Ace approves.",
  77700: "Lucky sevens. Drinks are still not on the house.",
};

/** Small string hash so the same cash-out always gets the same line. */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function cashOutQuip(totalTips: number, fohRate: number, seed = "") {
  const exact = EXACT[Math.round(totalTips * 100)];
  if (exact) return exact;
  if (totalTips <= 0) return "";
  const tier = TIERS.find((t) => fohRate < t.below) ?? TIERS[TIERS.length - 1];
  return tier.lines[hash(seed) % tier.lines.length];
}
