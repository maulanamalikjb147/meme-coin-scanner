import React from "react";
import { ExternalLink, Activity, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtUsd, fmtNum, fmtPct, fmtPrice, fmtAge, shortAddr } from "@/lib/format";
import { DASH } from "@/constants/testIds";
import { toast } from "sonner";

const PriceChange = ({ value }) => {
  if (value === null || value === undefined || isNaN(value)) return <span className="text-neutral-500">—</span>;
  const v = Number(value);
  const positive = v >= 0;
  return (
    <span
      className={`font-mono tabular-nums text-sm font-medium ${
        positive ? "text-[#00ff66]" : "text-[#ff3b30]"
      }`}
    >
      {fmtPct(v)}
    </span>
  );
};

export const TokenTable = ({ tokens, onAnalyze, loading }) => {
  const copy = (addr) => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied", { description: shortAddr(addr) });
  };

  if (loading && tokens.length === 0) {
    return (
      <div className="panel p-12 text-center font-mono text-sm text-neutral-500">
        <Activity className="inline-block mr-2 h-4 w-4 animate-pulse" />
        Scanning the Solana mempool…
      </div>
    );
  }

  if (!loading && tokens.length === 0) {
    return (
      <div className="panel p-12 text-center font-mono text-sm text-neutral-500">
        No tokens match the current filters.
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <Table data-testid={DASH.tokenTable}>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Asset</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">Price</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">24h Δ</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">24h Vol</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">Liquidity</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">Mkt Cap</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">24h Tx</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">Age</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Status</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => (
              <TableRow
                key={t.address}
                data-testid={DASH.tokenRow(t.address)}
                className="token-row border-white/5"
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    {t.icon ? (
                      <img
                        src={t.icon}
                        alt={t.symbol}
                        className="h-7 w-7 rounded-full bg-neutral-900 border border-white/10 object-cover"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center font-mono text-[10px] text-neutral-500">
                        {(t.symbol || "?").slice(0, 2)}
                      </div>
                    )}
                    <div className="flex flex-col leading-tight">
                      <span className="font-mono font-semibold text-sm text-white">${t.symbol}</span>
                      <button
                        onClick={() => copy(t.address)}
                        data-testid={DASH.copyAddr(t.address)}
                        className="font-mono text-[10px] text-neutral-500 hover:text-[#00ff66] flex items-center gap-1 transition"
                        title={t.address}
                      >
                        {shortAddr(t.address)} <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm">{fmtPrice(t.price_usd)}</TableCell>
                <TableCell className="text-right"><PriceChange value={t.price_change_24h} /></TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-white">{fmtUsd(t.volume_24h_usd)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-neutral-300">{fmtUsd(t.liquidity_usd)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-neutral-300">{fmtUsd(t.market_cap_usd)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-xs">
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-white">{fmtNum(t.txns_24h_total)}</span>
                    <span className="text-[10px]">
                      <span className="text-[#00ff66]">{fmtNum(t.txns_24h_buys)}</span>
                      <span className="text-neutral-600">/</span>
                      <span className="text-[#ff3b30]">{fmtNum(t.txns_24h_sells)}</span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-sm text-neutral-300">{fmtAge(t.age_hours)}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 font-mono text-xs border border-white/10 hover:border-[#00ff66]/40 hover:text-[#00ff66] hover:bg-[#00ff66]/5"
                      onClick={() => onAnalyze(t)}
                      data-testid={DASH.analyzeBtn(t.address)}
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                      Analyze
                    </Button>
                    <a
                      href={t.url || `https://dexscreener.com/solana/${t.address}`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={DASH.dexLink(t.address)}
                      className="h-8 w-8 flex items-center justify-center border border-white/10 rounded-sm hover:border-white/30 text-neutral-400 hover:text-white transition"
                      title="Open in DexScreener"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </a>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
