// Critter generator: deterministic, original mascot faces drawn as inline SVG.
// critterSVG(i, { size, mood }) -> SVG string. mood: "idle" | "happy" | "dizzy".
(function () {
  const INK = "#1B1A2E";
  const BODIES = ["#FFF6E9", "#FFC2A8", "#FFFFFF", "#FFE3A3", "#C9F0DC", "#FFD1E6"];
  const TOPS = [
    "M60 26 L60 10 M52 8 L68 8",
    "M40 28 Q34 10 46 12 M80 28 Q86 10 74 12",
    "M48 26 Q60 4 72 26",
    "M30 30 L22 16 M90 30 L98 16",
    "M60 26 Q70 12 60 6",
    "M44 26 L50 14 L56 26 L62 14 L68 26 L74 14"
  ];
  const MOUTHS = [
    "M48 86 Q60 96 72 86", "M50 88 L70 88", "M46 84 Q60 100 74 84",
    "M52 90 Q60 82 68 90", "M48 88 Q54 94 60 88 Q66 94 72 88", "M56 88 A4 4 0 1 0 64 88"
  ];

  function critterSVG(i, opts) {
    opts = opts || {};
    const mood = opts.mood || "idle";
    const size = opts.size || "100%";
    const body = opts.body || BODIES[(i * 5) % BODIES.length];
    const rx = [40, 18, 28, 10, 34][i % 5];
    const cyclops = i % 7 === 3;
    const look = [-4, 0, 4, 2, -2][i % 5];
    const py = 60 + [0, 3, -2, 2][i % 4];
    const top = TOPS[i % TOPS.length];
    const mouth = MOUTHS[(i * 3) % MOUTHS.length];

    let eyes;
    if (mood === "happy") {
      eyes = `<path d="M34 62 Q44 50 54 62 M66 62 Q76 50 86 62" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    } else if (mood === "dizzy") {
      eyes = `<path d="M36 52 L52 68 M52 52 L36 68 M68 52 L84 68 M84 52 L68 68" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    } else if (cyclops) {
      eyes = `<g class="eye"><circle cx="60" cy="60" r="18" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${60 + look}" cy="${py}" r="6" fill="${INK}"/></g>`;
    } else {
      const r2 = i % 4 === 1 ? 9 : 12;
      eyes = `<g class="eye"><circle cx="44" cy="60" r="12" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="76" cy="60" r="${r2}" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${44 + look}" cy="${py}" r="5" fill="${INK}"/><circle cx="${76 + look}" cy="${py}" r="5" fill="${INK}"/></g>`;
    }
    const m = mood === "happy" ? `<path d="M44 80 Q60 100 76 80 Z" fill="${INK}"/>` :
      mood === "dizzy" ? `<path d="M46 90 Q53 84 60 90 Q67 96 74 90" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` :
      `<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;

    return `<svg class="critter" aria-hidden="true" viewBox="0 0 120 120" width="${size}" style="max-width:100%;height:auto">
      <path d="${top}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="18" y="26" width="84" height="80" rx="${rx}" fill="${body}" stroke="${INK}" stroke-width="4"/>
      ${eyes}${m}
    </svg>`;
  }

  window.critterSVG = critterSVG;
})();
