// ============================================================
// calc.js  ― スコア計算ロジック（純粋関数）
// ============================================================

const Calc = (() => {
  const G = CONFIG.GRADE_RATIO;

  function kpiScore(member, scores, phase) {
    let total = 0, any = false;
    member.kpis.forEach((k, i) => {
      const s = scores.kpis[i];
      const g = phase === 'mid' ? s.midGrade : s.finGrade;
      if (g) { any = true; total += k.weight / 100 * 60 * (G[g] || 0); }
    });
    return any ? total : null;
  }

  function procScore(scores, phase) {
    let total = 0, any = false;
    scores.proc.forEach(p => {
      const g = phase === 'mid' ? p.midGrade : p.finGrade;
      if (g) { any = true; total += 8 * (G[g] || 0); }
    });
    return any ? total : null;
  }

  function rank(pts) {
    if (pts === null || pts === undefined) return '';
    if (pts >= 90) return 'S';
    if (pts >= 80) return 'A';
    if (pts >= 70) return 'B';
    if (pts >= 60) return 'C';
    return 'D';
  }

  function fmt(v, digits = 1) {
    return v === null ? '—' : v.toFixed(digits);
  }

  function kpiPts(kpi, grade) {
    if (!grade) return null;
    return kpi.weight / 100 * 60 * (G[grade] || 0);
  }

  function procPts(grade) {
    if (!grade) return null;
    return 8 * (G[grade] || 0);
  }

  return { kpiScore, procScore, rank, fmt, kpiPts, procPts };
})();
