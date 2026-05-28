import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Search, RefreshCw, Activity, Flame, Sparkles, Zap } from "lucide-react";
import { fetchTokens } from "@/lib/api";
import { TokenTable } from "@/components/TokenTable";
import { AnalyzeSheet } from "@/components/AnalyzeSheet";
import { TelegramConfig } from "@/components/TelegramConfig";
import { fmtUsd } from "@/lib/format";
import { DASH } from "@/constants/testIds";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "ALL", icon: Activity, testId: DASH.filterAll },
  { key: "new", label: "NEW", icon: Sparkles, testId: DASH.filterNew },
  { key: "hot", label: "HOT", icon: Flame, testId: DASH.filterHot },
  { key: "hot_new", label: "HOT • NEW", icon: Zap, testId: DASH.filterHotNew },
];

export default function Dashboard() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [minVol, setMinVol] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchTokens({ filter, min_volume: minVol || 0, search: search || undefined, limit: 100 });
      setTokens(res.tokens || []);
      setMeta(res);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchTokens failed", e);
    } finally {
      setLoading(false);
    }
  }, [filter, minVol, search]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    return {
      total: tokens.length,
      new_: tokens.filter((t) => t.status === "NEW" || t.status === "HOT_NEW").length,
      hot: tokens.filter((t) => t.status === "HOT" || t.status === "HOT_NEW").length,
      hot_new: tokens.filter((t) => t.status === "HOT_NEW").length,
    };
  }, [tokens]);

  return (
    <div className="min-h-screen text-white">
      {/* Top bar */}
      <header className="border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" data-testid={DASH.logo}>
            <div className="h-8 w-8 rounded-sm bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center">
              <Activity className="h-4 w-4 text-[#00ff66]" strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <div className="font-mono font-bold text-sm tracking-wider text-white">
                SOL<span className="text-[#00ff66]">/</span>SCREENER
              </div>
              <div className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">solana meme coin radar</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2" data-testid={DASH.liveIndicator}>
              <span className="pulse-dot" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                {lastUpdated ? `LIVE · ${lastUpdated.toLocaleTimeString()}` : "INITIALIZING"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => load()}
              data-testid={DASH.refreshBtn}
              className="font-mono text-xs border border-white/10 hover:border-[#00ff66]/40 hover:text-[#00ff66] hover:bg-transparent"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              onClick={() => setTelegramOpen(true)}
              data-testid={DASH.telegramBtn}
              className="bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 hover:bg-[#00e5ff]/20 hover:shadow-[0_0_16px_rgba(0,229,255,0.3)] font-mono text-xs transition-all"
            >
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Telegram
            </Button>
          </div>
        </div>
      </header>

      {/* Hero / stats */}
      <section className="max-w-[1600px] mx-auto px-6 pt-8 pb-4">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-mono font-bold text-3xl md:text-4xl lg:text-5xl tracking-tight">
              Meme<span className="text-[#00ff66]">.</span>Radar
            </h1>
            <p className="text-sm text-neutral-400 mt-2 max-w-xl">
              Real-time screening of Solana meme coins. Volume spikes get pushed to your Telegram. Tap <span className="text-[#00ff66] font-mono">Analyze</span> for an AI-deep-scan powered by Claude.
            </p>
          </div>
          {meta?.thresholds && (
            <div className="font-mono text-[10px] text-neutral-500 text-right">
              <div>HOT ≥ <span className="text-[#ff4d00]">{fmtUsd(meta.thresholds.hot_volume_usd)}</span> 24h vol</div>
              <div>NEW ≤ <span className="text-[#00ff66]">{meta.thresholds.new_age_hours}h</span> since listing</div>
              <div>ALERT ≥ <span className="text-[#00e5ff]">{fmtUsd(meta.thresholds.alert_volume_usd)}</span> → telegram</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard testId={DASH.statTotal} icon={Activity} label="Tracked" value={stats.total} accent="#ffffff" />
          <StatCard testId={DASH.statNew} icon={Sparkles} label="New" value={stats.new_} accent="#00ff66" />
          <StatCard testId={DASH.statHot} icon={Flame} label="Hot" value={stats.hot} accent="#ff4d00" />
          <StatCard testId={DASH.statHotNew} icon={Zap} label="Hot • New" value={stats.hot_new} accent="#00e5ff" />
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-[1600px] mx-auto px-6 pb-4">
        <div className="panel p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              placeholder="Search symbol, name, or contract…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid={DASH.searchInput}
              className="pl-9 bg-transparent border-white/10 focus-visible:border-[#00ff66]/40 focus-visible:ring-0 font-mono text-sm h-9 rounded-sm"
            />
          </div>

          <div className="flex items-center gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  data-testid={f.testId}
                  className={cn(
                    "px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest border rounded-sm flex items-center gap-1.5 transition-all",
                    active
                      ? "border-[#00ff66]/50 text-[#00ff66] bg-[#00ff66]/10 shadow-[0_0_12px_rgba(0,255,102,0.2)]"
                      : "border-white/10 text-neutral-400 hover:text-white hover:border-white/30"
                  )}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.8} />
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Min Vol</label>
            <Input
              type="number"
              placeholder="0"
              min={0}
              step={1000}
              value={minVol || ""}
              onChange={(e) => setMinVol(Number(e.target.value) || 0)}
              data-testid={DASH.minVolInput}
              className="w-28 bg-transparent border-white/10 focus-visible:border-[#00ff66]/40 focus-visible:ring-0 font-mono text-xs h-9 rounded-sm tabular-nums"
            />
          </div>
        </div>
      </section>

      {/* Token table */}
      <section className="max-w-[1600px] mx-auto px-6 pb-12">
        <TokenTable tokens={tokens} onAnalyze={setAnalyzing} loading={loading} />
      </section>

      <footer className="border-t border-white/5 py-6">
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between font-mono text-[10px] text-neutral-600 uppercase tracking-widest">
          <span>data · dexscreener · ai · anthropic claude</span>
          <span>{tokens.length} assets on screen</span>
        </div>
      </footer>

      <AnalyzeSheet token={analyzing} open={!!analyzing} onClose={() => setAnalyzing(null)} />
      <TelegramConfig open={telegramOpen} onClose={() => setTelegramOpen(false)} />
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, accent, testId }) => (
  <div className="panel p-4 group hover:border-white/20 transition" data-testid={testId}>
    <div className="flex items-center justify-between mb-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</span>
      <Icon className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={1.5} />
    </div>
    <div
      className="font-mono font-bold text-3xl tabular-nums"
      style={{ color: accent, textShadow: accent !== "#ffffff" ? `0 0 12px ${accent}40` : "none" }}
    >
      {value}
    </div>
  </div>
);
