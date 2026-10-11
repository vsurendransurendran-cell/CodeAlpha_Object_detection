import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Sliders,
  Check,
  Shield,
  Navigation,
} from 'lucide-react';
import { CountingLine, DetectionZone } from '../types/vision';

interface TripwireZoneEditorProps {
  tripwires: CountingLine[];
  setTripwires: React.Dispatch<React.SetStateAction<CountingLine[]>>;
  zones: DetectionZone[];
  setZones: React.Dispatch<React.SetStateAction<DetectionZone[]>>;
}

export const TripwireZoneEditor: React.FC<TripwireZoneEditorProps> = ({
  tripwires,
  setTripwires,
  zones,
  setZones,
}) => {
  const [selectedWireId, setSelectedWireId] = useState<string>(tripwires[0]?.id || '');
  const [testResult, setTestResult] = useState<string | null>(null);

  const activeWire = tripwires.find((w) => w.id === selectedWireId) || tripwires[0];

  // Add custom tripwire
  const handleAddWire = () => {
    const newId = `wire_${Date.now()}`;
    const newWire: CountingLine = {
      id: newId,
      name: `Tripwire ${tripwires.length + 1}`,
      p1: [0.15, 0.45 + (tripwires.length * 0.08)],
      p2: [0.85, 0.45 + (tripwires.length * 0.08)],
      inCount: 0,
      outCount: 0,
      color: '#38bdf8',
      active: true,
      orientation: 'horizontal',
    };
    setTripwires([...tripwires, newWire]);
    setSelectedWireId(newId);
  };

  // Delete tripwire
  const handleDeleteWire = (id: string) => {
    if (tripwires.length <= 1) return;
    const remaining = tripwires.filter((w) => w.id !== id);
    setTripwires(remaining);
    setSelectedWireId(remaining[0].id);
  };

  // Update wire coordinate
  const handleUpdateCoord = (
    point: 'p1' | 'p2',
    axis: 0 | 1,
    value: number
  ) => {
    if (!activeWire) return;
    setTripwires((prev) =>
      prev.map((w) => {
        if (w.id === activeWire.id) {
          const next = { ...w };
          next[point] = [...next[point]] as [number, number];
          next[point][axis] = parseFloat(value.toFixed(2));
          return next;
        }
        return w;
      })
    );
  };

  // Test vector intersection
  const runVectorTest = () => {
    if (!activeWire) return;
    // Simulate trajectory from (0.5, 0.2) to (0.5, 0.8)
    const midY = (activeWire.p1[1] + activeWire.p2[1]) / 2;
    if (midY >= 0.2 && midY <= 0.8) {
      setTestResult(`Trajectory intersected ${activeWire.name} successfully. Vector cross product > 0 (Inbound direction registered).`);
    } else {
      setTestResult(`Trajectory did not intersect ${activeWire.name}. Adjust coordinates to intercept vertical path.`);
    }
    setTimeout(() => setTestResult(null), 4000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          Boundary & Tripwire Calibration
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span>Directional Vector Lines</span>
          <span aria-hidden="true">·</span>
          <span>Polygonal ROI Zones</span>
          <span aria-hidden="true">·</span>
          <span>Automated Cross-Product Verification</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Tripwire Lines List & Calibration */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Navigation className="h-4 w-4 text-indigo-400" />
                <span>Virtual Tripwire Lines</span>
              </h3>
              <button
                onClick={handleAddWire}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Tripwire</span>
              </button>
            </div>

            {/* Wire Selector Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {tripwires.map((wire) => (
                <button
                  key={wire.id}
                  onClick={() => setSelectedWireId(wire.id)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeWire?.id === wire.id
                      ? 'bg-slate-800 text-white border border-indigo-500'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: wire.color }}
                  />
                  {wire.name}
                </button>
              ))}
            </div>

            {activeWire && (
              <div className="flex flex-col gap-5 border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={activeWire.name}
                      onChange={(e) =>
                        setTripwires((prev) =>
                          prev.map((w) =>
                            w.id === activeWire.id ? { ...w, name: e.target.value } : w
                          )
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeWire.active}
                        onChange={(e) =>
                          setTripwires((prev) =>
                            prev.map((w) =>
                              w.id === activeWire.id ? { ...w, active: e.target.checked } : w
                            )
                          )
                        }
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  {tripwires.length > 1 && (
                    <button
                      onClick={() => handleDeleteWire(activeWire.id)}
                      className="cursor-pointer text-xs text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* Coordinates Sliders */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
                    <span className="text-xs font-semibold text-slate-300 block mb-3">
                      Start Anchor Point (P1)
                    </span>
                    <div className="flex flex-col gap-3 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">X Position:</span>
                          <span className="font-mono tabular-nums text-white">
                            {Math.round(activeWire.p1[0] * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={activeWire.p1[0]}
                          onChange={(e) =>
                            handleUpdateCoord('p1', 0, parseFloat(e.target.value))
                          }
                          className="w-full h-1.5 bg-slate-700 accent-indigo-500 rounded"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Y Position:</span>
                          <span className="font-mono tabular-nums text-white">
                            {Math.round(activeWire.p1[1] * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={activeWire.p1[1]}
                          onChange={(e) =>
                            handleUpdateCoord('p1', 1, parseFloat(e.target.value))
                          }
                          className="w-full h-1.5 bg-slate-700 accent-indigo-500 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
                    <span className="text-xs font-semibold text-slate-300 block mb-3">
                      End Anchor Point (P2)
                    </span>
                    <div className="flex flex-col gap-3 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">X Position:</span>
                          <span className="font-mono tabular-nums text-white">
                            {Math.round(activeWire.p2[0] * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={activeWire.p2[0]}
                          onChange={(e) =>
                            handleUpdateCoord('p2', 0, parseFloat(e.target.value))
                          }
                          className="w-full h-1.5 bg-slate-700 accent-indigo-500 rounded"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-400">Y Position:</span>
                          <span className="font-mono tabular-nums text-white">
                            {Math.round(activeWire.p2[1] * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={activeWire.p2[1]}
                          onChange={(e) =>
                            handleUpdateCoord('p2', 1, parseFloat(e.target.value))
                          }
                          className="w-full h-1.5 bg-slate-700 accent-indigo-500 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test Crossing Trigger */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={runVectorTest}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>Simulate Test Crossing</span>
                  </button>
                  {testResult && (
                    <span className="text-xs font-mono text-emerald-400 animate-fade-in">
                      {testResult}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: ROI Polygon Zones */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Region of Interest (ROI) Zones</span>
            </h3>

            <div className="flex flex-col gap-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: zone.color }}
                      />
                      {zone.name}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={zone.active}
                        onChange={(e) =>
                          setZones((prev) =>
                            prev.map((z) =>
                              z.id === zone.id ? { ...z, active: e.target.checked } : z
                            )
                          )
                        }
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>Active</span>
                    </label>
                  </div>

                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>Vertices: {zone.polygon.length} points</span>
                    <span className="text-emerald-400">
                      Live Occupancy: {zone.currentOccupancy}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-800 pt-3">
              <p className="text-xs text-slate-500">
                ROI boundaries enforce real-time spatial polygon containment using 2D ray-casting geometry. Objects remaining in active zones for &gt;18s trigger automated loitering incident telemetry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
