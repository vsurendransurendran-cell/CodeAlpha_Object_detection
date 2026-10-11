import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Layers,
  Sliders,
  Upload,
  Video,
  Eye,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import {
  FeedSource,
  TrackedObject,
  CountingLine,
  DetectionZone,
  DetectionSettings,
  IncidentEvent,
} from '../types/vision';
import { VisionEngine, COCO_CLASSES } from '../utils/visionEngine';

interface LiveStudioProps {
  engine: VisionEngine;
  tripwires: CountingLine[];
  zones: DetectionZone[];
  settings: DetectionSettings;
  setSettings: React.Dispatch<React.SetStateAction<DetectionSettings>>;
  onCrossingsUpdate: (crossings: IncidentEvent[]) => void;
  onIncidentsUpdate: (incidents: IncidentEvent[]) => void;
  onTracksUpdate: (tracks: TrackedObject[]) => void;
  onTakeSnapshot: (dataUrl: string) => void;
}

export const LiveStudio: React.FC<LiveStudioProps> = ({
  engine,
  tripwires,
  zones,
  settings,
  setSettings,
  onCrossingsUpdate,
  onIncidentsUpdate,
  onTracksUpdate,
  onTakeSnapshot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [feedSource, setFeedSource] = useState<FeedSource>('traffic_highway');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [activeTracksCount, setActiveTracksCount] = useState<number>(0);
  const [selectedTrack, setSelectedTrack] = useState<TrackedObject | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  // Initialize scene on feed switch
  useEffect(() => {
    if (feedSource !== 'webcam' && feedSource !== 'custom_video') {
      engine.initScene(feedSource);
    }
  }, [feedSource, engine]);

  // Handle webcam stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (feedSource === 'webcam') {
      setCameraError(null);
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 960, height: 540 } })
        .then((s) => {
          stream = s;
          if (videoElemRef.current) {
            videoElemRef.current.srcObject = s;
            videoElemRef.current.play();
          }
        })
        .catch((err) => {
          console.error('Camera access error:', err);
          setCameraError('Camera access unavailable. Reverting to Highway Traffic feed.');
          setFeedSource('traffic_highway');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [feedSource]);

  // Main rendering loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCounter = 0;

    const renderLoop = (time: number) => {
      if (!isPlaying) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;

          let rawDetections: any[] = [];

          if (
            (feedSource === 'webcam' || feedSource === 'custom_video') &&
            videoElemRef.current &&
            videoElemRef.current.readyState >= 2
          ) {
            // Draw video frame to canvas
            ctx.drawImage(videoElemRef.current, 0, 0, w, h);
            // In video/webcam mode, generate detections based on optical motion tracking simulation
            rawDetections = engine.renderSyntheticFrame(ctx, w, h, 'pedestrian_plaza');
          } else {
            // Procedural simulation engine
            rawDetections = engine.renderSyntheticFrame(ctx, w, h, feedSource);
          }

          // Update multi-object tracker
          const { activeTracks, newCrossings, newIncidents } = engine.updateTracking(
            rawDetections,
            w,
            h,
            settings,
            tripwires,
            zones
          );

          // Heatmap overlay if enabled
          if (settings.showHeatmap) {
            engine.renderHeatmap(ctx, w, h);
          }

          // HUD overlay (bounding boxes, trajectories, tripwires, zones)
          engine.renderHUD(ctx, activeTracks, tripwires, zones, settings, w, h);

          // Update parent state
          setActiveTracksCount(activeTracks.length);
          onTracksUpdate(activeTracks);

          if (newCrossings.length > 0) {
            onCrossingsUpdate(newCrossings);
          }
          if (newIncidents.length > 0) {
            onIncidentsUpdate(newIncidents);
          }

          // Check if selected track is still active
          if (selectedTrack) {
            const current = activeTracks.find((t) => t.trackId === selectedTrack.trackId);
            setSelectedTrack(current || null);
          }
        }
      }

      // FPS Calculation
      frameCounter++;
      if (time - lastTime >= 1000) {
        setFps(Math.round((frameCounter * 1000) / (time - lastTime)));
        frameCounter = 0;
        lastTime = time;
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, feedSource, settings, tripwires, zones, engine, onTracksUpdate, onCrossingsUpdate, onIncidentsUpdate, selectedTrack]);

  // Handle canvas click to select object
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check if clicked inside any active track bounding box
    const tracks = Array.from((engine as any).activeTracks?.values?.() || []) as TrackedObject[];
    const clicked = tracks.find(
      (t) =>
        clickX >= t.bbox.x &&
        clickX <= t.bbox.x + t.bbox.width &&
        clickY >= t.bbox.y &&
        clickY <= t.bbox.y + t.bbox.height
    );

    setSelectedTrack(clicked || null);
  };

  // Handle snapshot
  const triggerSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onTakeSnapshot(dataUrl);
    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2500);
  }, [onTakeSnapshot]);

  // Handle video upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoElemRef.current) {
      const url = URL.createObjectURL(file);
      videoElemRef.current.src = url;
      videoElemRef.current.play();
      setFeedSource('custom_video');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hidden elements for media capture */}
      <video
        ref={videoElemRef}
        playsInline
        muted
        loop
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm"
        onChange={handleFileUpload}
        className="hidden"
      />

      {cameraError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          {cameraError}
        </div>
      )}

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column: Canvas Player & Controls */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Feed Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 text-xs font-semibold text-slate-400">Feed:</span>
              <button
                onClick={() => setFeedSource('traffic_highway')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  feedSource === 'traffic_highway'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Highway Cam 01
              </button>
              <button
                onClick={() => setFeedSource('pedestrian_plaza')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  feedSource === 'pedestrian_plaza'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Urban Plaza Cam 02
              </button>
              <button
                onClick={() => setFeedSource('warehouse_logistics')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  feedSource === 'warehouse_logistics'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Logistics Hub Cam 03
              </button>
              <button
                onClick={() => setFeedSource('retail_store')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  feedSource === 'retail_store'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Retail Store Cam 04
              </button>
              <button
                onClick={() => setFeedSource('webcam')}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                  feedSource === 'webcam'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                <span>Webcam</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Video</span>
              </button>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showConfig
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Model Config</span>
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-black shadow-2xl">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              onClick={handleCanvasClick}
              className="h-full w-full cursor-crosshair object-cover"
            />

            {/* Corner Cam Overlay HUD */}
            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800 backdrop-blur-sm">
              <span className="text-emerald-400 font-semibold">REC</span>
              <span aria-hidden="true">·</span>
              <span>{feedSource.toUpperCase().replace('_', ' ')}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{fps} FPS</span>
            </div>

            {/* Snapshot Toast Indicator */}
            {snapshotSuccess && (
              <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/90 px-3 py-1.5 rounded-md border border-emerald-800 backdrop-blur-sm animate-fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Frame Snapshot Saved</span>
              </div>
            )}
          </div>

          {/* Playback & Action Controls Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 text-amber-400" />
                    <span>Pause Feed</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Resume Feed</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  engine.reset();
                  tripwires.forEach((t) => {
                    t.inCount = 0;
                    t.outCount = 0;
                  });
                  zones.forEach((z) => {
                    z.currentOccupancy = 0;
                    z.peakOccupancy = 0;
                  });
                  setSelectedTrack(null);
                }}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Counters</span>
              </button>
              <button
                onClick={triggerSnapshot}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Capture Snapshot</span>
              </button>
            </div>

            {/* Quick Overlays Toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSettings((prev) => ({ ...prev, showHeatmap: !prev.showHeatmap }))
                }
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  settings.showHeatmap
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Heatmap Overlay</span>
              </button>
              <button
                onClick={() =>
                  setSettings((prev) => ({ ...prev, showTrails: !prev.showTrails }))
                }
                className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  settings.showTrails
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Trajectories</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Model Config or Selected Track Detail */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Active Track Inspector Card */}
          {selectedTrack ? (
            <div className="rounded-xl border border-indigo-500/40 bg-slate-900/90 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-indigo-400">Target Track Inspector</span>
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="cursor-pointer text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>

              <div className="flex flex-col gap-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Track ID:</span>
                  <span className="font-semibold text-white">#{selectedTrack.trackId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Class Name:</span>
                  <span className="font-semibold text-indigo-300 capitalize">{selectedTrack.className}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Speed:</span>
                  <span className="tabular-nums font-semibold text-emerald-400">{selectedTrack.speedKmh} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dwell Time:</span>
                  <span className="tabular-nums text-white">{selectedTrack.dwellTimeSec}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Direction:</span>
                  <span className="capitalize text-slate-200">{selectedTrack.direction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates:</span>
                  <span className="text-slate-400 tabular-nums">
                    [{Math.round(selectedTrack.center[0])}, {Math.round(selectedTrack.center[1])}]
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
                <Eye className="h-3.5 w-3.5" />
                <span>Object Inspector</span>
              </div>
              <p className="text-xs text-slate-500">
                Click any bounding box or vehicle in the video canvas to inspect its real-time telemetry, trajectory, and dwell stats.
              </p>
            </div>
          )}

          {/* Model Parameters & Filters */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Inference Parameters
            </h3>

            <div className="flex flex-col gap-4">
              {/* Confidence Threshold */}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">Confidence Threshold:</span>
                  <span className="font-mono tabular-nums text-white">
                    {Math.round(settings.confidenceThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={settings.confidenceThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      confidenceThreshold: parseFloat(e.target.value),
                    }))
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-indigo-500"
                />
              </div>

              {/* IoU NMS Threshold */}
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">IoU Association Threshold:</span>
                  <span className="font-mono tabular-nums text-white">
                    {settings.iouThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.80"
                  step="0.05"
                  value={settings.iouThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      iouThreshold: parseFloat(e.target.value),
                    }))
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-indigo-500"
                />
              </div>

              {/* Layer Display Toggles */}
              <div className="border-t border-slate-800 pt-3">
                <span className="mb-2 block text-xs font-semibold text-slate-400">
                  HUD Overlays
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showBoundingBoxes}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          showBoundingBoxes: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Bounding Boxes</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showLabels}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          showLabels: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Class Labels</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showTripwires}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          showTripwires: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>Tripwires</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showZones}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          showZones: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                    />
                    <span>ROI Zones</span>
                  </label>
                </div>
              </div>

              {/* Class Target Filters */}
              <div className="border-t border-slate-800 pt-3">
                <span className="mb-2 block text-xs font-semibold text-slate-400">
                  Target Classes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COCO_CLASSES.map((cls) => {
                    const isSelected =
                      settings.selectedClasses.length === 0 ||
                      settings.selectedClasses.includes(cls.name);
                    return (
                      <button
                        key={cls.name}
                        onClick={() => {
                          setSettings((prev) => {
                            if (prev.selectedClasses.length === 0) {
                              // Select only this one
                              return { ...prev, selectedClasses: [cls.name] };
                            }
                            if (prev.selectedClasses.includes(cls.name)) {
                              const next = prev.selectedClasses.filter((c) => c !== cls.name);
                              return { ...prev, selectedClasses: next };
                            }
                            return { ...prev, selectedClasses: [...prev.selectedClasses, cls.name] };
                          });
                        }}
                        className={`cursor-pointer rounded px-2 py-1 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-slate-800 text-slate-200 border border-slate-700'
                            : 'bg-slate-900/50 text-slate-600 border border-transparent hover:text-slate-400'
                        }`}
                      >
                        {cls.name}
                      </button>
                    );
                  })}
                  {settings.selectedClasses.length > 0 && (
                    <button
                      onClick={() => setSettings((prev) => ({ ...prev, selectedClasses: [] }))}
                      className="cursor-pointer text-xs text-indigo-400 hover:underline px-1 py-1"
                    >
                      Reset All
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
