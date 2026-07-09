// lib/pointsTableAggregator.js
//
// Mirrors the role scorecardAggregator.js plays for CricketScorecard:
// takes raw DB rows and shapes them into exactly what the presentational
// component (PointsTable.jsx) expects to render — rank, short, name,
// image, color, colorSoft, p/w/l/t/nr, pts, nrr.

/**
 * Net run rate = (runs scored per over) − (runs conceded per over),
 * computed from cumulative totals rather than averaging per-match NRRs
 * (averaging per-match NRR is a common scoring bug — it overweights
 * low-scoring matches).
 */
export function computeNrr(runsScored, ballsFaced, runsConceded, ballsBowled) {
  const oversFaced = ballsFaced / 6;
  const oversBowled = ballsBowled / 6;
  const scoreRate = oversFaced > 0 ? runsScored / oversFaced : 0;
  const concedeRate = oversBowled > 0 ? runsConceded / oversBowled : 0;
  return scoreRate - concedeRate;
}

/** #RRGGBB (or #RGB) -> "rgba(r,g,b,alpha)", for the same colorSoft treatment DEFAULT_TEAMS used. */
export function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(122,129,148,${alpha})`; // fallback neutral
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * @param {Array} teams - rows from `teams` table: { id, code, name, color, logo }
 * @param {Map} standingsByTeamId - Map<team_id, standings row>. Teams with
 *   no row yet (haven't played) are included with all-zero stats.
 * @param {Object} opts - scoring rule overrides
 * @returns {Array} teams shaped for PointsTable.jsx, sorted + ranked
 *   (rank 1 = top of table): sort by points desc, then NRR desc.
 */
export function buildPointsTable(
  teams,
  standingsByTeamId,
  { pointsForWin = 2, pointsForTie = 1, pointsForNoResult = 1 } = {}
) {
  const rows = teams.map((team) => {
    const s = standingsByTeamId.get(team.id) || {};

    const played = s.played ?? 0;
    const won = s.won ?? 0;
    const lost = s.lost ?? 0;
    const tied = s.tied ?? 0;
    const noResult = s.no_result ?? 0;

    const runsScored = s.runs_scored ?? 0;
    const ballsFaced = s.balls_faced ?? 0;
    const runsConceded = s.runs_conceded ?? 0;
    const ballsBowled = s.balls_bowled ?? 0;

    // Prefer a stored `points` value if present (lets you override for
    // penalties/deductions); otherwise derive from W/T/NR.
    const points =
      s.points ?? won * pointsForWin + tied * pointsForTie + noResult * pointsForNoResult;

    return {
      short: team.code,
      name: team.name,
      image: team.logo || "",
      color: team.color,
      colorSoft: hexToRgba(team.color, 0.22),
      p: played,
      w: won,
      l: lost,
      t: tied,
      nr: noResult,
      pts: points,
      nrr: computeNrr(runsScored, ballsFaced, runsConceded, ballsBowled),
    };
  });

  rows.sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}