import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Send, Bot, CheckCircle2, AlertTriangle, Radar, Pause, Clock, DollarSign, Save } from "lucide-react";
import { getTelegramConfig, testTelegram, scanAndAlert, getSettings, setScannerPaused, setSchedule } from "@/lib/api";
import { fmtUsd } from "@/lib/format";
import { DASH } from "@/constants/testIds";
import { toast } from "sonner";

export const TelegramConfig = ({ open, onClose }) => {
  const [cfg, setCfg] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [intervalMin, setIntervalMin] = useState(20);
  const [threshold, setThreshold] = useState(50000);

  const refresh = async () => {
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([getTelegramConfig(), getSettings()]);
      setCfg(c);
      setSettings(s);
      setIntervalMin(Math.max(1, Math.round((s?.scan_interval_seconds || 1200) / 60)));
      setThreshold(s?.alert_threshold_usd || c?.alert_threshold_usd || 50000);
    } catch (e) {
      console.error("settings load failed", e);
      setLoadError(e?.response?.data?.detail || e?.message || "Failed to load settings");
      setCfg(null);
      setSettings(null);
    }
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

  const onSaveSchedule = async () => {
    setLoading(true);
    try {
      const res = await setSchedule({
        scan_interval_seconds: Math.max(60, Math.round(Number(intervalMin) * 60)),
        alert_threshold_usd: Math.max(0, Number(threshold)),
      });
      setSettings(res);
      toast.success("Schedule updated", {
        description: `Scanner now runs every ${Math.round(res.scan_interval_seconds / 60)} min · Alert ≥ ${fmtUsd(res.alert_threshold_usd)}`,
      });
    } catch (e) {
      toast.error("Failed to save", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  const configured = !!cfg?.configured;
  const paused = !!settings?.scanner_paused;
  const currentInterval = settings?.scan_interval_seconds || 1200;
  const currentThreshold = settings?.alert_threshold_usd || cfg?.alert_threshold_usd || 0;

  const intervalDirty = Math.round(Number(intervalMin) * 60) !== currentInterval;
  const thresholdDirty = Number(threshold) !== currentThreshold;
  const dirty = intervalDirty || thresholdDirty;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto" data-testid={DASH.telegramDialog}>
        <DialogHeader>
          <DialogTitle className="font-mono text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#00e5ff]" /> Telegram Alert Bot
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-neutral-400">
            Volume-spike alerts are pushed to your Telegram. Token & chat ID are set server-side via <code className="text-[#00ff66]">backend/.env</code>.
          </DialogDescription>
        </DialogHeader>

        {/* Load error */}
        {loadError && (
          <div className="border border-[#ff3b30]/40 bg-[#ff3b30]/5 rounded-sm p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-[#ff3b30] shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-mono text-xs text-[#ff3b30]">Failed to load settings</div>
              <div className="font-mono text-[10px] text-neutral-400 mt-1 break-all">{loadError}</div>
              <button onClick={refresh} className="mt-2 font-mono text-[10px] uppercase tracking-widest text-[#00ff66] hover:underline">
                Retry →
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          <ConfigRow
            label="Bot Token"
            ok={cfg?.bot_token_set}
            envKey="TELEGRAM_BOT_TOKEN"
            preview={cfg?.bot_token_preview}
          />
          <ConfigRow
            label="Chat ID"
            ok={cfg?.chat_id_set}
            envKey="TELEGRAM_CHAT_ID"
            preview={cfg?.chat_id_preview}
          />

          {/* Schedule + threshold editor */}
          <div className="border border-white/10 rounded-sm p-3 bg-white/[0.02]">
            <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">
              Alert Schedule & Threshold
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Interval (min)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(e.target.value)}
                  data-testid="dash-interval-input"
                  className="mt-1 bg-transparent border-white/10 focus-visible:border-[#00ff66]/40 focus-visible:ring-0 font-mono text-sm h-9 rounded-sm tabular-nums"
                />
                <div className="font-mono text-[10px] text-neutral-600 mt-1">
                  current: {Math.round(currentInterval / 60)} min
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Threshold (USD)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  data-testid="dash-threshold-input"
                  className="mt-1 bg-transparent border-white/10 focus-visible:border-[#00ff66]/40 focus-visible:ring-0 font-mono text-sm h-9 rounded-sm tabular-nums"
                />
                <div className="font-mono text-[10px] text-neutral-600 mt-1">
                  current: {fmtUsd(currentThreshold)}
                </div>
              </div>
            </div>
            <Button
              onClick={onSaveSchedule}
              disabled={!dirty || loading}
              data-testid="dash-save-schedule-btn"
              className="mt-3 w-full bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30 hover:bg-[#00ff66]/20 font-mono text-xs disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {dirty ? "Save schedule" : "Saved"}
            </Button>
          </div>

          {/* Scanner pause toggle */}
          <div className={`border rounded-sm p-3 ${paused ? "border-[#ffd60a]/30 bg-[#ffd60a]/5" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-mono text-xs uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
                  <Pause className={`h-3 w-3 ${paused ? "text-[#ffd60a]" : "text-neutral-500"}`} />
                  Send Alerts
                </div>
                <div className="font-mono text-[10px] text-neutral-500 mt-1">
                  {paused
                    ? "Paused — no Telegram alerts will be sent"
                    : `Active — alerts pushed every ${Math.round(currentInterval / 60)} min`}
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

          {!configured && !loadError && (
            <div className="border border-[#ffd60a]/30 bg-[#ffd60a]/5 rounded-sm p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-[#ffd60a] shrink-0 mt-0.5" />
              <div className="font-mono text-xs text-neutral-300">
                Add <code className="text-[#ffd60a]">TELEGRAM_BOT_TOKEN</code> and <code className="text-[#ffd60a]">TELEGRAM_CHAT_ID</code> to <code className="text-[#ffd60a]">backend/.env</code> (or Kubernetes secret), then restart the backend service.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={onScan}
            disabled={!configured || loading || paused}
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

const ConfigRow = ({ label, ok, envKey, preview }) => (
  <div className="flex items-center justify-between border border-white/10 rounded-sm p-3 bg-white/[0.02]">
    <div className="min-w-0 flex-1">
      <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="font-mono text-[10px] text-neutral-600 mt-1">env: {envKey}</div>
      {ok && preview && (
        <div className="font-mono text-[10px] text-[#00ff66] mt-0.5 truncate">{preview}</div>
      )}
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
