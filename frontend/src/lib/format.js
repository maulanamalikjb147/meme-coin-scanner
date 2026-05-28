export const fmtUsd = (n, opts = {}) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `$${v.toFixed(2)}`;
  if (abs >= 0.01) return `$${v.toFixed(4)}`;
  if (abs > 0) return `$${v.toFixed(8)}`;
  return "$0";
};

export const fmtPrice = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  if (v >= 1) return `$${v.toFixed(4)}`;
  if (v >= 0.01) return `$${v.toFixed(5)}`;
  if (v >= 0.0001) return `$${v.toFixed(7)}`;
  return `$${v.toExponential(2)}`;
};

export const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US");
};

export const fmtPct = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
};

export const fmtAge = (hours) => {
  if (hours === null || hours === undefined || isNaN(hours)) return "—";
  const h = Number(hours);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  if (h < 24 * 30) return `${(h / 24).toFixed(1)}d`;
  return `${(h / (24 * 30)).toFixed(1)}mo`;
};

export const shortAddr = (a) => {
  if (!a) return "";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
};
