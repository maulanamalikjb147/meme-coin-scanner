import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Send, Bot, CheckCircle2, AlertTriangle, Radar, Pause } from "lucide-react";
import { getTelegramConfig, testTelegram, scanAndAlert, getSettings, setScannerPaused } from "@/lib/api";
import { fmtUsd } from "@/lib/format";
import { DASH } from "@/constants/testIds";
import { toast } from "sonner";

export const TelegramConfig = ({ open, onClose }) => {
  const [cfg, setCfg] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    getTelegramConfig().then(setCfg).catch(() => setCfg(null));
    getSettings().then(setSettings).catch(() => setSettings(null));
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const onTest = async () => {
    setLoading(true);
    try {
      await testTelegram();
      toast.success("Test alert sent to Telegram");
    } catch (e) {
      toast.error("Test failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  const onScan = async () => {
    setLoading(true);
    try {
      const res = await scanAndAlert();
      toast.success(`Scan complete · ${res.sent.length} alerts sent`, {
        description: res.sent.length ? res.sent.join(", ") : "No tokens passed the threshold (or already alerted recently).",
      });
    } catch (e) {
      toast.error("Scan failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  const onTogglePause = async (next) => {
    try {
      const res = await setScannerPaused(next);
      setSettings(res);
      toast.success(next ? "Scanner paused" : "Scanner resumed", {
        description: next ? "Background alerts stopped." : "Background alerts resumed.",
      });
    } catch (e) {
      toast.error("Failed to toggle scanner", { description: e?.response?.data?.detail || e.message });
    }
  };

  const configured = !!cfg?.configured;
  const paused = !!settings?.scanner_paused;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-lg" data-testid={DASH.telegramDialog}>
        <DialogHeader>
          <DialogTitle className="font-mono text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#00e5ff]" /> Telegram Alert Bot
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-neutral-400">
            Volume-spike alerts are pushed to your Telegram. Token & chat ID are configured server-side via <code className="text-[#00ff66]">backend/.env</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <ConfigRow label="Bot Token" ok={cfg?.bot_token_set} envKey="TELEGRAM_BOT_TOKEN" />
          <ConfigRow label="Chat ID" ok={cfg?.chat_id_set} envKey="TELEGRAM_CHAT_ID" />
          <div className="border border-white/10 rounded-sm p-3 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">Alert Threshold</div>
              <div className="font-mono text-sm tabular-nums text-[#00ff66]">{fmtUsd(cfg?.alert_threshold_usd)}</div>
            </div>
            <div className="font-mono text-[10px] text-neutral-500 mt-1">env: ALERT_VOLUME_THRESHOLD_USD</div>
          </div>

          {/* Scanner pause toggle */}
          <div className={`border rounded-sm p-3 ${paused ? "border-[#ffd60a]/30 bg-[#ffd60a]/5" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-mono text-xs uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                  <Pause className={`h-3 w-3 ${paused ? "text-[#ffd60a]" : "text-neutral-500"}`} />
                  Background Scanner
                </div>
                <div className="font-mono text-[10px] text-neutral-500 mt-1">
                  {paused
                    ? "Paused — no alerts will be sent until resumed"
                    : `Active — scans every ${cfg?.scan_interval_seconds || 300}s`}
                </div>
              </div>
              <Switch
                checked={!paused}
                onCheckedChange={(v) => onTogglePause(!v)}
                disabled={!configured}
                data-testid="dash-scanner-pause-toggle"
                className="data-[state=checked]:bg-[#00ff66] data-[state=unchecked]:bg-[#ffd60a]/40"
              />
            </div>
          </div>

          {!configured && (
            <div className="border border-[#ffd60a]/30 bg-[#ffd60a]/5 rounded-sm p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-[#ffd60a] shrink-0 mt-0.5" />
              <div className="font-mono text-xs text-neutral-300">
                Add <code className="text-[#ffd60a]">TELEGRAM_BOT_TOKEN</code> and <code className="text-[#ffd60a]">TELEGRAM_CHAT_ID</code> to <code className="text-[#ffd60a]">backend/.env</code>, then restart the backend service. The background scanner runs every 5 minutes once configured.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={onScan}
            disabled={!configured || loading}
            data-testid={DASH.telegramScanBtn}
            className="font-mono text-xs border border-white/10 hover:border-[#00e5ff]/40 hover:text-[#00e5ff]"
          >
            <Radar className="h-3.5 w-3.5 mr-1.5" />
            Scan & Alert Now
          </Button>
          <Button
            onClick={onTest}
            disabled={!configured || loading}
            data-testid={DASH.telegramTestBtn}
            className="bg-[#00ff66] text-[#050505] hover:bg-[#00ff66]/90 hover:shadow-[0_0_20px_rgba(0,255,102,0.4)] font-mono text-xs font-bold transition-all"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ConfigRow = ({ label, ok, envKey }) => (
  <div className="flex items-center justify-between border border-white/10 rounded-sm p-3 bg-white/[0.02]">
    <div>
      <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="font-mono text-[10px] text-neutral-600 mt-1">env: {envKey}</div>
    </div>
    {ok ? (
      <div className="flex items-center gap-1.5 font-mono text-xs text-[#00ff66]">
        <CheckCircle2 className="h-4 w-4" /> SET
      </div>
    ) : (
      <div className="flex items-center gap-1.5 font-mono text-xs text-[#ff3b30]">
        <AlertTriangle className="h-4 w-4" /> MISSING
      </div>
    )}
  </div>
);
