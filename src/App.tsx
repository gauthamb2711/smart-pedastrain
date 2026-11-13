import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  Compass,
  LayoutDashboard,
  Menu,
  Pause,
  Play,
  Settings,
  TrafficCone,
  Users,
  X,
} from 'lucide-react';
import { AnalyticsPage } from './components/AnalyticsPage';
import { LiveIntersectionPage } from './components/LiveIntersectionPage';
import { MLAnalysisPage } from './components/MLAnalysisPage';
import { OverviewPage } from './components/OverviewPage';
import { PedestrianMonitoringPage } from './components/PedestrianMonitoringPage';
import { SettingsPage } from './components/SettingsPage';
import { SignalManagementPage } from './components/SignalManagementPage';
import { SimulationEngine } from './simulation/SimulationEngine';
import { loadSettings } from './simulation/storage';
import { PageId, SimulationSettings, SimulationSnapshot } from './simulation/types';

const NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'intersection', label: 'Live Intersection', icon: Compass },
  { id: 'monitoring', label: 'Pedestrian Monitoring', icon: Users },
  { id: 'ml', label: 'AI / ML Analysis', icon: BrainCircuit },
  { id: 'signals', label: 'Signal Management', icon: TrafficCone },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [settings, setSettings] = useState<SimulationSettings>(() => loadSettings());
  const engine = useMemo(() => new SimulationEngine(loadSettings()), []);
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    engine.getSnapshot()
  );
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  useEffect(() => {
    const unsub = engine.subscribe((snap) => setSnapshot(snap));
    return unsub;
  }, [engine]);

  // Background simulation loop when user navigates away from 3D canvas pages
  // (When Overview or Live Intersection is mounted, IntersectionViewport drives engine.step)
  useEffect(() => {
    if (activePage === 'overview' || activePage === 'intersection') return;
    let rafId = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      engine.step(dt);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [activePage, engine]);

  const latestToast = snapshot.notifications[0];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold tracking-tight text-slate-900 truncate">
                SmartCrossing
              </p>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                Smarter Crossings. Safer Streets.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActivePage(item.id);
                  setMobileNavOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-blue-600' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quiet Simulation Mode Summary in Sidebar Footer */}
        <div className="border-t border-slate-200 p-4 text-xs">
          <p className="font-semibold text-slate-800">Virtual Tracking Active</p>
          <p className="mt-1 leading-relaxed text-slate-500">
            3D Simulation · {snapshot.counts.waiting} waiting · {snapshot.counts.crossing} crossing
          </p>
          <div className="mt-2.5 flex items-center justify-between text-slate-600">
            <span>Density:</span>
            <span className="font-mono font-semibold text-slate-900">
              {snapshot.ml.densityClass}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-slate-600">
            <span>ML Green:</span>
            <span className="font-mono font-semibold text-blue-700 tabular-nums">
              {snapshot.ml.recommendedGreenTime}s
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base font-bold text-slate-900 sm:text-lg truncate">
                Smart Pedestrian Traffic Control
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block truncate">
                AI-powered adaptive pedestrian crossing management · Smarter Crossings. Safer Streets.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Quick Play/Pause */}
            <button
              type="button"
              onClick={() =>
                snapshot.isRunning ? engine.pause() : engine.resume()
              }
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                snapshot.isRunning
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {snapshot.isRunning ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifDrawerOpen((o) => !o)}
                className="relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                aria-label="Toggle alerts"
              >
                <Bell className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">Alerts</span>
                {snapshot.notifications.length > 0 && (
                  <span className="font-mono text-[11px] font-semibold text-blue-700 tabular-nums">
                    ({snapshot.notifications.length})
                  </span>
                )}
              </button>

              {notifDrawerOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-display text-xs font-bold text-slate-900">
                      Simulation Alerts & Events
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifDrawerOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                    {snapshot.notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-500">
                        No alerts logged yet.
                      </p>
                    ) : (
                      snapshot.notifications.map((n) => {
                        const tone =
                          n.type === 'alert'
                            ? 'border-rose-200 bg-rose-50/70'
                            : n.type === 'warning'
                              ? 'border-amber-200 bg-amber-50/70'
                              : n.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50/70'
                                : 'border-slate-200 bg-slate-50/70';
                        return (
                          <div
                            key={n.id}
                            className={`rounded-lg border p-2.5 text-xs ${tone}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-slate-900">{n.title}</p>
                              <button
                                type="button"
                                onClick={() => engine.dismissNotification(n.id)}
                                className="text-slate-400 hover:text-slate-700"
                                aria-label="Dismiss"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="mt-0.5 text-slate-600">{n.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Non-blocking Latest Alert Strip */}
        {latestToast && (
          <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`font-semibold whitespace-nowrap ${
                    latestToast.type === 'alert'
                      ? 'text-rose-700'
                      : latestToast.type === 'warning'
                        ? 'text-amber-700'
                        : latestToast.type === 'success'
                          ? 'text-emerald-700'
                          : 'text-blue-700'
                  }`}
                >
                  {latestToast.title}
                </span>
                <span className="text-slate-300">·</span>
                <span className="truncate text-slate-600">{latestToast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => engine.dismissNotification(latestToast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Active Page Content */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">
          {activePage === 'overview' && (
            <OverviewPage
              engine={engine}
              snapshot={snapshot}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'intersection' && (
            <LiveIntersectionPage engine={engine} snapshot={snapshot} />
          )}
          {activePage === 'monitoring' && (
            <PedestrianMonitoringPage engine={engine} snapshot={snapshot} />
          )}
          {activePage === 'ml' && (
            <MLAnalysisPage snapshot={snapshot} settings={settings} />
          )}
          {activePage === 'signals' && (
            <SignalManagementPage engine={engine} snapshot={snapshot} />
          )}
          {activePage === 'analytics' && (
            <AnalyticsPage snapshot={snapshot} />
          )}
          {activePage === 'settings' && (
            <SettingsPage
              engine={engine}
              settings={settings}
              onUpdateSettings={setSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
}
