import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "@/components/Gauge";
import { analyzeToken } from "@/lib/api";
import { ExternalLink, Twitter, AlertTriangle, RefreshCw, Sparkles, TrendingUp, ShieldAlert } from "lucide-react";
import { fmtUsd, fmtPct, fmtAge, shortAddr } from "@/lib/format";
import { DASH } from "@/constants/testIds";
import { toast } from "sonner";

const verdictStyle = {
  STRONG_BUY: "bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/40",
  BUY: "bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/30",
  HOLD: "bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30",
  WATCH: "bg-white/5 text-neutral-300 border-white/15",
  AVOID: "bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/40",
};

const riskStyle = {
  LOW: "text-[#00ff66]",
  MEDIUM: "text-[#ffd60a]",
  HIGH: "text-[#ff4d00]",
  EXTREME: "text-[#ff3b30]",
};

const buyColor = (v) => (v >= 70 ? "#00ff66" : v >= 40 ? "#ffd60a" : "#ff3b30");

export const AnalyzeSheet = ({ token, open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeToken(token.address);
      setData(res);
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || e?.message || "Analysis failed";
      setError(msg);
      toast.error("Analysis failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && token) {
      setData(null);
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token?.address]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl bg-[#050505]/95 backdrop-blur-2xl border-l border-white/10 text-white overflow-y-auto"
        data-testid={DASH.analyzeSheet}
      >
        <SheetHeader className="border-b border-white/10 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {token?.icon && (
                <img src={token.icon} alt={token.symbol} className="h-10 w-10 rounded-full border border-white/10" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
              <div>
                <SheetTitle className="font-mono text-xl text-white">
                  ${token?.symbol} <span className="text-neutral-500 text-sm font-normal">// {token?.name}</span>
                </SheetTitle>
                <SheetDescription className="font-mono text-xs text-neutral-500">
                  {shortAddr(token?.address)} · Solana
                </SheetDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={run}
              disabled={loading}
              data-testid={DASH.reanalyzeBtn}
              className="font-mono text-xs border border-white/10 hover:border-[#00ff66]/40 hover:text-[#00ff66]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Analyzing" : "Re-run"}
            </Button>
          </div>
        </SheetHeader>

        {/* Snapshot bar */}
        <div className="grid grid-cols-4 gap-2 mt-4 mb-6">
          {[
            { k: "Price", v: token?.price_usd ? `$${Number(token.price_usd).toFixed(token.price_usd < 0.01 ? 7 : 4)}` : "—" },
            { k: "24h Δ", v: fmtPct(token?.price_change_24h) },
            { k: "24h Vol", v: fmtUsd(token?.volume_24h_usd) },
            { k: "Age", v: fmtAge(token?.age_hours) },
          ].map((s) => (
            <div key={s.k} className="border border-white/10 rounded-sm p-2 bg-white/[0.02]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{s.k}</div>
              <div className="font-mono text-sm tabular-nums text-white truncate">{s.v}</div>
            </div>
          ))}
        </div>

        {/* AI Analysis Body */}
        {loading && !data && (
          <div className="panel scan-line p-8 text-center">
            <Sparkles className="inline-block h-5 w-5 mr-2 text-[#00ff66] animate-pulse" />
            <span className="font-mono text-sm text-neutral-300">Claude is reading the chain & X timeline…</span>
            <div className="mt-3 font-mono text-[10px] text-neutral-500 uppercase tracking-widest">deep-scan in progress</div>
          </div>
        )}

        {error && !loading && (
          <div className="panel p-6 border-[#ff3b30]/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#ff3b30] mt-0.5" />
              <div>
                <div className="font-mono text-sm text-[#ff3b30]">Analysis failed</div>
                <div className="font-mono text-xs text-neutral-400 mt-1">{error}</div>
              </div>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Verdict & gauges */}
            <div className="panel p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`font-mono text-xs px-3 py-1 rounded-sm ${verdictStyle[data.verdict] || verdictStyle.WATCH}`}>
                    {data.verdict}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs border-white/20 text-neutral-300 rounded-sm">
                    {data.trend}
                  </Badge>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <ShieldAlert className={`h-3.5 w-3.5 ${riskStyle[data.risk_level] || "text-neutral-400"}`} />
                    <span className={riskStyle[data.risk_level] || "text-neutral-400"}>Risk: {data.risk_level}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Gauge value={data.hype_score} label="Hype" color="#ff4d00" testId={DASH.hypeGauge} />
                <Gauge value={data.community_score} label="Community" color="#00e5ff" testId={DASH.communityGauge} />
                <Gauge value={data.buy_signal} label="Buy Signal" color={buyColor(data.buy_signal)} testId={DASH.buySignalGauge} />
              </div>
            </div>

            {/* Summary */}
            <div className="panel p-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2 flex items-center gap-2">
                <TrendingUp className="h-3 w-3" /> AI Summary
              </div>
              <p className="text-sm text-neutral-200 leading-relaxed">{data.summary}</p>
            </div>

            {/* Key points */}
            {data.key_points?.length > 0 && (
              <div className="panel p-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Key Signals</div>
                <ul className="space-y-2">
                  {data.key_points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-200">
                      <span className="text-[#00ff66] font-mono">▸</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Red flags */}
            {data.red_flags?.length > 0 && (
              <div className="panel p-5 border-[#ff3b30]/30">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#ff3b30] mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" /> Red Flags
                </div>
                <ul className="space-y-2">
                  {data.red_flags.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-200">
                      <span className="text-[#ff3b30] font-mono">!</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* X / Twitter links */}
            {data.twitter_links?.length > 0 && (
              <div className="panel p-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                  <Twitter className="h-3 w-3" /> X / Twitter Signals
                </div>
                <div className="space-y-2">
                  {data.twitter_links.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 border border-white/5 rounded-sm p-2.5 bg-white/[0.02]">
                      <code className="font-mono text-xs text-neutral-300 truncate">{l.query}</code>
                      <div className="flex gap-2 shrink-0">
                        <a
                          href={l.url_live}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border border-white/10 hover:border-[#00e5ff]/40 hover:text-[#00e5ff] text-neutral-400 transition"
                        >
                          Live →
                        </a>
                        <a
                          href={l.url_top}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-sm border border-white/10 hover:border-[#00e5ff]/40 hover:text-[#00e5ff] text-neutral-400 transition"
                        >
                          Top →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External link */}
            <a
              href={data.dexscreener_url || `https://dexscreener.com/solana/${token.address}`}
              target="_blank"
              rel="noreferrer"
              className="block panel p-4 hover:border-[#00ff66]/40 transition group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Continue analysis on</div>
                  <div className="font-mono text-sm text-white mt-0.5">DexScreener · charts, trades & holders</div>
                </div>
                <ExternalLink className="h-4 w-4 text-neutral-400 group-hover:text-[#00ff66] transition" />
              </div>
            </a>

            <div className="font-mono text-[10px] text-neutral-600 text-center pt-2 pb-6">
              analysis generated {new Date(data.created_at).toLocaleString()} · cached 15 min
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
