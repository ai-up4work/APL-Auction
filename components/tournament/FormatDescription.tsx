// File: components/admin/FormatDescription.tsx
"use client";

type FormatType = "single_elimination" | "double_elimination" | "round_robin" | "group_knockout";

const ACCENT = "var(--color-theme-orange)";
const LINE = "var(--color-border-overlay)";
const TEXT = "var(--color-outline)";
const BOX_FILL = "var(--color-surface-container)";

function Box({ x, y, w = 34, h = 16, highlight = false }: { x: number; y: number; w?: number; h?: number; highlight?: boolean }) {
  return (
    <rect
      x={x} y={y} width={w} height={h} rx={4}
      fill={highlight ? "rgba(201,151,31,0.15)" : BOX_FILL}
      stroke={highlight ? ACCENT : LINE}
      strokeWidth={highlight ? 1.5 : 1}
    />
  );
}

function Elbow({ x1, y1, x2, y2, highlight = false }: { x1: number; y1: number; x2: number; y2: number; highlight?: boolean }) {
  const midX = (x1 + x2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`}
      fill="none"
      stroke={highlight ? ACCENT : LINE}
      strokeWidth={highlight ? 1.75 : 1}
    />
  );
}

function SingleElimDiagram() {
  // winning path: leaf 0 -> semi 0 -> final
  return (
    <svg viewBox="0 0 220 110" className="w-full h-auto">
      {[8, 34, 60, 86].map((y, i) => <Box key={i} x={6} y={y} highlight={i === 0} />)}
      <Box x={80} y={21} highlight />
      <Box x={80} y={73} />
      <Box x={154} y={47} w={38} highlight />
      <Elbow x1={40} y1={16} x2={80} y2={29} highlight />
      <Elbow x1={40} y1={42} x2={80} y2={29} />
      <Elbow x1={40} y1={68} x2={80} y2={81} />
      <Elbow x1={40} y1={94} x2={80} y2={81} />
      <Elbow x1={114} y1={29} x2={154} y2={55} highlight />
      <Elbow x1={114} y1={81} x2={154} y2={55} />
      <text x={173} y={44} textAnchor="middle" fontSize="7" fill={ACCENT} fontWeight={700}>WIN</text>
    </svg>
  );
}

function DoubleElimDiagram() {
  // winning path: stays unbeaten through the winners bracket into the grand final
  return (
    <svg viewBox="0 0 220 130" className="w-full h-auto">
      {/* winners bracket, top */}
      <Box x={4} y={4} w={28} h={14} highlight />
      <Box x={4} y={26} w={28} h={14} />
      <Box x={44} y={14} w={28} h={14} highlight />
      {/* losers bracket, bottom */}
      {[70, 92].map((y, i) => <Box key={`l${i}`} x={4} y={y} w={28} h={14} />)}
      <Box x={44} y={81} w={28} h={14} />
      {/* grand final */}
      <Box x={140} y={48} w={50} h={16} highlight />
      <Elbow x1={32} y1={11} x2={44} y2={21} highlight />
      <Elbow x1={32} y1={33} x2={44} y2={21} />
      <Elbow x1={32} y1={77} x2={44} y2={88} />
      <Elbow x1={32} y1={99} x2={44} y2={88} />
      <Elbow x1={72} y1={21} x2={140} y2={54} highlight />
      <Elbow x1={72} y1={88} x2={140} y2={62} />
      <text x={4} y={126} fontSize="7" fill={TEXT} fontStyle="italic">2 losses = eliminated</text>
    </svg>
  );
}

function RoundRobinDiagram() {
  const cx = 100, cy = 55, r = 38;
  const points = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const lines: React.ReactElement[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      lines.push(<line key={`${i}-${j}`} x1={points[i].x} y1={points[i].y} x2={points[j].x} y2={points[j].y} stroke={LINE} strokeWidth={0.75} />);
    }
  }
  return (
    <svg viewBox="0 0 200 110" className="w-full h-auto">
      {lines}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={7} fill={i === 0 ? "rgba(201,151,31,0.2)" : BOX_FILL} stroke={i === 0 ? ACCENT : LINE} strokeWidth={1} />
      ))}
    </svg>
  );
}

function GroupKnockoutDiagram() {
  // winning path: Group A's top finisher advances through the knockout final
  return (
    <svg viewBox="0 0 220 110" className="w-full h-auto">
      {/* group A */}
      <rect x={4} y={6} width={70} height={44} rx={6} fill="none" stroke={ACCENT} strokeWidth={1} strokeOpacity={0.5} />
      <text x={10} y={17} fontSize="7" fill={TEXT} fontWeight={700}>GROUP A</text>
      <circle cx={16} cy={24} r={5} fill="rgba(201,151,31,0.2)" stroke={ACCENT} strokeWidth={1.5} />
      <circle cx={56} cy={24} r={5} fill={BOX_FILL} stroke={LINE} />
      <circle cx={16} cy={40} r={5} fill={BOX_FILL} stroke={LINE} />
      <circle cx={56} cy={40} r={5} fill={BOX_FILL} stroke={LINE} />
      {/* group B */}
      <rect x={4} y={58} width={70} height={44} rx={6} fill="none" stroke={LINE} strokeWidth={1} />
      <text x={10} y={69} fontSize="7" fill={TEXT} fontWeight={700}>GROUP B</text>
      {[76, 76, 92, 92].map((y, i) => <circle key={i} cx={16 + (i % 2) * 40} cy={y} r={5} fill={BOX_FILL} stroke={LINE} />)}
      {/* funnel into knockout */}
      <path d="M 78 20 L 110 45" stroke={ACCENT} strokeWidth={1.5} fill="none" />
      <path d="M 78 90 L 110 45" stroke={LINE} strokeWidth={1} fill="none" />
      <Box x={112} y={37} w={32} h={16} highlight />
      <Elbow x1={144} y1={45} x2={170} y2={45} highlight />
      <Box x={170} y={37} w={40} h={16} highlight />
      <text x={190} y={49} textAnchor="middle" fontSize="7" fill={ACCENT} fontWeight={700}>WIN</text>
    </svg>
  );
}

const FORMAT_INFO: Record<FormatType, { title: string; blurb: string; points: string[]; Diagram: () => React.ReactElement }> = {
  single_elimination: {
    title: "Single Elimination",
    blurb: "Lose once, you're out.",
    points: [
      "Every match eliminates the loser — winner advances to the next round.",
      "Seed 1 and seed 2 can't meet before the Final; top seeds are kept apart as long as possible.",
      "Odd team counts get automatic byes for the strongest seeds.",
    ],
    Diagram: SingleElimDiagram,
  },
  double_elimination: {
    title: "Double Elimination",
    blurb: "You need two losses to be eliminated.",
    points: [
      "Everyone starts in the Winners Bracket — one loss drops you to the Losers Bracket instead of ending your run.",
      "A second loss (in either bracket) eliminates you.",
      "The Winners Bracket champion faces the Losers Bracket champion in the Grand Final. If the Losers side wins, there's one more decider match since the Winners champ now has a loss too.",
    ],
    Diagram: DoubleElimDiagram,
  },
  round_robin: {
    title: "Round Robin",
    blurb: "Everyone plays everyone — no elimination.",
    points: [
      "Every team plays every other team exactly once.",
      "Ranked by points at the end (win/draw/loss), with score difference as a tiebreak.",
      "Good for group stages or leagues where one bad match shouldn't end your tournament.",
    ],
    Diagram: RoundRobinDiagram,
  },
  group_knockout: {
    title: "Groups + Knockout",
    blurb: "Round robin groups, then a single-elimination playoff.",
    points: [
      "Teams are split into groups and play round robin within each group.",
      "The top finishers from every group (you choose how many) qualify.",
      "Qualifiers are seeded into a single-elimination bracket — group winners are kept apart from each other in the first knockout round.",
    ],
    Diagram: GroupKnockoutDiagram,
  },
};

export default function FormatDescription({ format }: { format: FormatType }) {
  const info = FORMAT_INFO[format];
  const Diagram = info.Diagram;
  return (
    <section className="rounded-xl border border-border-overlay bg-surface-container-low p-4 flex flex-col md:flex-row gap-4">
      <div className="w-full md:w-[220px] shrink-0 rounded-lg border border-border-overlay/60 bg-background/40 p-3">
        <Diagram />
      </div>
      <div className="flex-1">
        <h3 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-theme-orange">{info.title}</h3>
        <p className="font-body-md text-sm text-on-surface mt-1 mb-2">{info.blurb}</p>
        <ul className="flex flex-col gap-1.5">
          {info.points.map((p, i) => (
            <li key={i} className="flex gap-2 text-xs text-on-surface-variant">
              <span className="text-theme-orange mt-0.5">•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}