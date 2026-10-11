import {
  BoundingBox,
  Detection,
  TrackedObject,
  CountingLine,
  DetectionZone,
  FeedSource,
  IncidentEvent,
  DetectionSettings,
  ClassCategory,
} from '../types/vision';

export const COCO_CLASSES: Array<{ name: string; category: ClassCategory; color: string }> = [
  { name: 'person', category: 'pedestrian', color: '#06b6d4' }, // cyan
  { name: 'car', category: 'vehicle', color: '#3b82f6' }, // blue
  { name: 'truck', category: 'vehicle', color: '#8b5cf6' }, // violet
  { name: 'bus', category: 'vehicle', color: '#ec4899' }, // pink
  { name: 'motorcycle', category: 'vehicle', color: '#f59e0b' }, // amber
  { name: 'bicycle', category: 'vehicle', color: '#10b981' }, // emerald
  { name: 'forklift', category: 'freight', color: '#f97316' }, // orange
  { name: 'backpack', category: 'misc', color: '#6366f1' }, // indigo
  { name: 'suitcase', category: 'misc', color: '#14b8a6' }, // teal
];

export const CLASS_COLORS: Record<string, string> = COCO_CLASSES.reduce(
  (acc, item) => ({ ...acc, [item.name]: item.color }),
  {}
);

// Synthetic Scene Actor internal representation
interface SceneActor {
  id: number;
  className: string;
  category: ClassCategory;
  x: number; // 0 to 1
  y: number; // 0 to 1
  vx: number; // speed normalized
  vy: number;
  w: number;
  h: number;
  baseSpeed: number;
  color: string;
  lane?: number;
  loiterTimer?: number;
}

export class VisionEngine {
  private actors: SceneActor[] = [];
  private activeTracks: Map<number, TrackedObject> = new Map();
  private nextActorId = 101;
  private nextTrackId = 101;
  private frameCount = 0;
  private heatmapGrid: Float32Array;
  private heatmapCols = 64;
  private heatmapRows = 36;
  public totalCrossingsRecorded = 0;
  public totalUniqueTracksRecorded = 0;

  constructor() {
    this.heatmapGrid = new Float32Array(this.heatmapCols * this.heatmapRows);
  }

  public reset() {
    this.actors = [];
    this.activeTracks.clear();
    this.nextActorId = 101;
    this.nextTrackId = 101;
    this.frameCount = 0;
    this.totalCrossingsRecorded = 0;
    this.totalUniqueTracksRecorded = 0;
    this.heatmapGrid.fill(0);
  }

  // Populate synthetic scene actors
  public initScene(feed: FeedSource) {
    this.actors = [];
    const count = feed === 'traffic_highway' ? 14 : feed === 'pedestrian_plaza' ? 16 : feed === 'warehouse_logistics' ? 10 : 12;

    for (let i = 0; i < count; i++) {
      this.spawnActor(feed, Math.random());
    }
  }

  private spawnActor(feed: FeedSource, initialProgress = 0) {
    const id = this.nextActorId++;
    let className = 'car';
    let category: ClassCategory = 'vehicle';
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let w = 0.07;
    let h = 0.12;
    let baseSpeed = 0.004 + Math.random() * 0.003;

    if (feed === 'traffic_highway') {
      const isSouthbound = Math.random() > 0.45;
      const types = ['car', 'car', 'car', 'truck', 'bus', 'motorcycle'];
      className = types[Math.floor(Math.random() * types.length)];
      category = 'vehicle';

      if (className === 'truck') {
        w = 0.09;
        h = 0.20;
        baseSpeed *= 0.75;
      } else if (className === 'bus') {
        w = 0.085;
        h = 0.18;
        baseSpeed *= 0.8;
      } else if (className === 'motorcycle') {
        w = 0.04;
        h = 0.07;
        baseSpeed *= 1.3;
      }

      const laneOffset = (Math.floor(Math.random() * 3) * 0.11) + 0.06;
      if (isSouthbound) {
        x = 0.52 + laneOffset;
        y = initialProgress > 0 ? initialProgress : -0.2;
        vy = baseSpeed;
        vx = (Math.random() - 0.5) * 0.0003;
      } else {
        x = 0.48 - laneOffset;
        y = initialProgress > 0 ? (1 - initialProgress) : 1.2;
        vy = -baseSpeed;
        vx = (Math.random() - 0.5) * 0.0003;
      }
    } else if (feed === 'pedestrian_plaza') {
      className = Math.random() > 0.15 ? 'person' : 'bicycle';
      category = className === 'person' ? 'pedestrian' : 'vehicle';
      w = className === 'person' ? 0.04 : 0.05;
      h = className === 'person' ? 0.08 : 0.10;
      baseSpeed = 0.0018 + Math.random() * 0.002;

      const angle = Math.random() * Math.PI * 2;
      x = initialProgress > 0 ? 0.2 + Math.random() * 0.6 : Math.random() > 0.5 ? -0.05 : 1.05;
      y = initialProgress > 0 ? 0.2 + Math.random() * 0.6 : Math.random();
      vx = Math.cos(angle) * baseSpeed;
      vy = Math.sin(angle) * baseSpeed;
    } else if (feed === 'warehouse_logistics') {
      const types = ['forklift', 'person', 'person', 'suitcase'];
      className = types[Math.floor(Math.random() * types.length)];
      category = className === 'forklift' ? 'freight' : className === 'person' ? 'pedestrian' : 'misc';
      w = className === 'forklift' ? 0.08 : 0.04;
      h = className === 'forklift' ? 0.12 : 0.08;
      baseSpeed = 0.0015 + Math.random() * 0.002;

      const pathIdx = Math.floor(Math.random() * 3);
      y = 0.25 + pathIdx * 0.25;
      const leftToRight = Math.random() > 0.5;
      x = initialProgress > 0 ? initialProgress : leftToRight ? -0.1 : 1.1;
      vx = leftToRight ? baseSpeed : -baseSpeed;
      vy = (Math.random() - 0.5) * 0.0004;
    } else {
      // retail_store
      className = 'person';
      category = 'pedestrian';
      w = 0.045;
      h = 0.085;
      baseSpeed = 0.0012 + Math.random() * 0.0015;
      x = initialProgress > 0 ? 0.15 + Math.random() * 0.7 : Math.random() > 0.5 ? -0.05 : 1.05;
      y = 0.2 + Math.random() * 0.6;
      vx = (Math.random() > 0.5 ? 1 : -1) * baseSpeed;
      vy = (Math.random() - 0.5) * baseSpeed * 0.5;
    }

    this.actors.push({
      id,
      className,
      category,
      x,
      y,
      vx,
      vy,
      w,
      h,
      baseSpeed,
      color: CLASS_COLORS[className] || '#38bdf8',
    });
  }

  // Update synthetic physics and draw the simulated video frame
  public renderSyntheticFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    feed: FeedSource
  ): Detection[] {
    this.frameCount++;

    // 1. Draw Background Environment
    this.drawEnvironment(ctx, width, height, feed);

    // 2. Update and draw actors
    const detections: Detection[] = [];

    for (let i = this.actors.length - 1; i >= 0; i--) {
      const actor = this.actors[i];
      actor.x += actor.vx;
      actor.y += actor.vy;

      // Slight natural steering jitter
      if (Math.random() < 0.03) {
        actor.vx += (Math.random() - 0.5) * 0.0001;
      }

      // Check bounds to respawn
      const isOutOfBounds =
        actor.x < -0.2 || actor.x > 1.2 || actor.y < -0.25 || actor.y > 1.25;

      if (isOutOfBounds) {
        this.actors.splice(i, 1);
        this.spawnActor(feed);
        continue;
      }

      // Render realistic silhouette on video canvas
      this.drawActorVisual(ctx, actor, width, height, feed);

      // Accumulate heatmap
      const gridX = Math.floor(Math.max(0, Math.min(this.heatmapCols - 1, actor.x * this.heatmapCols)));
      const gridY = Math.floor(Math.max(0, Math.min(this.heatmapRows - 1, actor.y * this.heatmapRows)));
      const cellIdx = gridY * this.heatmapCols + gridX;
      this.heatmapGrid[cellIdx] = Math.min(1.0, this.heatmapGrid[cellIdx] + 0.015);

      // Create detection object if in visible frame
      if (actor.x >= -0.02 && actor.x <= 1.02 && actor.y >= -0.02 && actor.y <= 1.02) {
        // Add subtle sensor bounding box jitter for realism
        const jitterX = (Math.random() - 0.5) * 0.002;
        const jitterY = (Math.random() - 0.5) * 0.002;
        const confJitter = Math.min(0.99, Math.max(0.72, 0.88 + (Math.random() - 0.5) * 0.12));

        detections.push({
          id: `det_${actor.id}`,
          classId: actor.id,
          className: actor.className,
          category: actor.category,
          confidence: parseFloat(confJitter.toFixed(2)),
          bbox: {
            x: Math.max(0, (actor.x - actor.w / 2 + jitterX) * width),
            y: Math.max(0, (actor.y - actor.h / 2 + jitterY) * height),
            width: actor.w * width,
            height: actor.h * height,
          },
          color: actor.color,
        });
      }
    }

    // Maintain minimum actor pool
    while (this.actors.length < 12) {
      this.spawnActor(feed);
    }

    // Slowly decay heatmap
    if (this.frameCount % 5 === 0) {
      for (let j = 0; j < this.heatmapGrid.length; j++) {
        this.heatmapGrid[j] *= 0.994;
      }
    }

    return detections;
  }

  // Draw authentic domain background
  private drawEnvironment(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    feed: FeedSource
  ) {
    if (feed === 'traffic_highway') {
      // Asphalt
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // Shoulder and barrier
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w * 0.12, h);
      ctx.fillRect(w * 0.88, 0, w * 0.12, h);

      // Center divider (concrete barrier)
      ctx.fillStyle = '#334155';
      ctx.fillRect(w * 0.492, 0, w * 0.016, h);

      // Yellow inner median stripes
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(w * 0.485, 0);
      ctx.lineTo(w * 0.485, h);
      ctx.moveTo(w * 0.515, 0);
      ctx.lineTo(w * 0.515, h);
      ctx.stroke();

      // White lane dashes
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 24]);
      const lanes = [0.24, 0.36, 0.64, 0.76];
      for (const lx of lanes) {
        ctx.beginPath();
        ctx.moveTo(w * lx, 0);
        ctx.lineTo(w * lx, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Subtle road grain / camera timestamp overlay watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let i = 0; i < h; i += 6) {
        ctx.fillRect(0, i, w, 1);
      }
    } else if (feed === 'pedestrian_plaza') {
      // Stone plaza tiles
      ctx.fillStyle = '#181e2b';
      ctx.fillRect(0, 0, w, h);

      // Pavement grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Zebra crosswalk strip
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let y = 40; y < h - 40; y += 32) {
        ctx.fillRect(w * 0.38, y, w * 0.24, 18);
      }
    } else if (feed === 'warehouse_logistics') {
      // Industrial concrete floor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Yellow safety walkways
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(w * 0.08, h * 0.1, w * 0.84, h * 0.8);
      ctx.setLineDash([]);

      // Storage bay zones
      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.fillRect(w * 0.12, h * 0.15, w * 0.22, h * 0.7);
      ctx.fillRect(w * 0.66, h * 0.15, w * 0.22, h * 0.7);

      // Bay boundary markers
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w * 0.12, h * 0.15, w * 0.22, h * 0.7);
      ctx.strokeRect(w * 0.66, h * 0.15, w * 0.22, h * 0.7);
    } else {
      // Retail store floor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Shelving aisles
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(w * 0.05, h * 0.1, w * 0.15, h * 0.8);
      ctx.fillRect(w * 0.42, h * 0.1, w * 0.16, h * 0.8);
      ctx.fillRect(w * 0.80, h * 0.1, w * 0.15, h * 0.8);

      // Aisle tile lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(w * 0.20, y);
        ctx.lineTo(w * 0.42, y);
        ctx.moveTo(w * 0.58, y);
        ctx.lineTo(w * 0.80, y);
        ctx.stroke();
      }
    }
  }

  // Draw realistic visual silhouettes of vehicles, pedestrians, and machines
  private drawActorVisual(
    ctx: CanvasRenderingContext2D,
    actor: SceneActor,
    canvasW: number,
    canvasH: number,
    feed: FeedSource
  ) {
    const cx = actor.x * canvasW;
    const cy = actor.y * canvasH;
    const pw = actor.w * canvasW;
    const ph = actor.h * canvasH;

    ctx.save();
    ctx.translate(cx, cy);

    // Compute rotation angle based on velocity
    const angle = Math.atan2(actor.vy, actor.vx) - Math.PI / 2;
    ctx.rotate(angle);

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 4, pw * 0.55, ph * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    if (actor.className === 'person') {
      // Pedestrian head & shoulders
      ctx.fillStyle = '#94a3b8';
      // Torso
      ctx.beginPath();
      ctx.roundRect(-pw * 0.4, -ph * 0.35, pw * 0.8, ph * 0.7, 4);
      ctx.fill();
      // Head
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(0, -ph * 0.32, pw * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else if (actor.className === 'car') {
      // Car chassis
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-pw * 0.48, -ph * 0.48, pw * 0.96, ph * 0.96, 6);
      ctx.fill();

      // Roof / windshield
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-pw * 0.38, -ph * 0.28, pw * 0.76, ph * 0.56, 4);
      ctx.fill();

      // Front headlights
      ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
      ctx.fillRect(-pw * 0.4, -ph * 0.48, pw * 0.22, 3);
      ctx.fillRect(pw * 0.18, -ph * 0.48, pw * 0.22, 3);

      // Taillights
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(-pw * 0.4, ph * 0.45, pw * 0.22, 3);
      ctx.fillRect(pw * 0.18, ph * 0.45, pw * 0.22, 3);
    } else if (actor.className === 'truck' || actor.className === 'bus') {
      // Large vehicle body
      ctx.fillStyle = actor.className === 'truck' ? '#475569' : '#1e3a8a';
      ctx.beginPath();
      ctx.roundRect(-pw * 0.48, -ph * 0.48, pw * 0.96, ph * 0.96, 4);
      ctx.fill();

      // Cab front
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-pw * 0.44, -ph * 0.48, pw * 0.88, ph * 0.25);

      // Lights
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-pw * 0.42, -ph * 0.48, pw * 0.2, 4);
      ctx.fillRect(pw * 0.22, -ph * 0.48, pw * 0.2, 4);
    } else if (actor.className === 'forklift') {
      // Forklift frame
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.roundRect(-pw * 0.45, -ph * 0.4, pw * 0.9, ph * 0.8, 4);
      ctx.fill();

      // Forks in front
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-pw * 0.3, -ph * 0.55, pw * 0.12, ph * 0.2);
      ctx.fillRect(pw * 0.18, -ph * 0.55, pw * 0.12, ph * 0.2);
    } else {
      // Misc / bicycle
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-pw * 0.25, -ph * 0.45, pw * 0.5, ph * 0.9);
    }

    ctx.restore();
  }

  // Multi-Object Tracking Engine (ByteTrack / SORT)
  public updateTracking(
    rawDetections: Detection[],
    canvasW: number,
    canvasH: number,
    settings: DetectionSettings,
    tripwires: CountingLine[],
    zones: DetectionZone[]
  ): {
    activeTracks: TrackedObject[];
    newCrossings: IncidentEvent[];
    newIncidents: IncidentEvent[];
  } {
    const newCrossings: IncidentEvent[] = [];
    const newIncidents: IncidentEvent[] = [];

    // Filter detections by confidence and selected classes
    const filteredDetections = rawDetections.filter(
      (d) =>
        d.confidence >= settings.confidenceThreshold &&
        (settings.selectedClasses.length === 0 ||
          settings.selectedClasses.includes(d.className))
    );

    // Perform IoU & Centroid Distance Association
    const matchedTrackIds = new Set<number>();
    const matchedDetectionIds = new Set<string>();

    // Pair existing active tracks with current detections
    const tracksArray = Array.from(this.activeTracks.values());

    for (const track of tracksArray) {
      let bestDet: Detection | null = null;
      let minDistance = 120; // max pixel threshold for association

      for (const det of filteredDetections) {
        if (matchedDetectionIds.has(det.id)) continue;
        if (det.className !== track.className) continue; // Same class constraint

        const detCenterX = det.bbox.x + det.bbox.width / 2;
        const detCenterY = det.bbox.y + det.bbox.height / 2;

        const dist = Math.hypot(
          detCenterX - track.center[0],
          detCenterY - track.center[1]
        );

        if (dist < minDistance) {
          minDistance = dist;
          bestDet = det;
        }
      }

      if (bestDet) {
        matchedTrackIds.add(track.trackId);
        matchedDetectionIds.add(bestDet.id);

        const newCenterX = bestDet.bbox.x + bestDet.bbox.width / 2;
        const newCenterY = bestDet.bbox.y + bestDet.bbox.height / 2;

        // Velocity smoothing: vx = 0.7 * vx_prev + 0.3 * (cx_new - cx_prev)
        const instantVx = newCenterX - track.center[0];
        const instantVy = newCenterY - track.center[1];
        track.velocity = [
          track.velocity[0] * 0.6 + instantVx * 0.4,
          track.velocity[1] * 0.6 + instantVy * 0.4,
        ];

        // Speed estimation: pixels/frame -> scaled km/h
        const pxSpeed = Math.hypot(track.velocity[0], track.velocity[1]);
        const scaleFactor = track.category === 'vehicle' ? 8.2 : 4.1;
        track.speedKmh = Math.min(130, Math.round(pxSpeed * scaleFactor));

        // Speed incident check
        if (track.category === 'vehicle' && track.speedKmh > 95) {
          if (Math.random() < 0.05) {
            newIncidents.push({
              id: `inc_${Date.now()}_${track.trackId}`,
              timestamp: new Date().toLocaleTimeString(),
              type: 'speeding',
              severity: 'medium',
              description: `Track #${track.trackId} (${track.className}) exceeded corridor limit: ${track.speedKmh} km/h`,
              trackId: track.trackId,
              location: [newCenterX, newCenterY],
            });
          }
        }

        // Direction classification
        track.direction =
          track.velocity[1] > 0.4
            ? 'inbound'
            : track.velocity[1] < -0.4
            ? 'outbound'
            : 'stationary';

        // Check tripwire crossings
        const prevCenter = track.center;
        const currCenter: [number, number] = [newCenterX, newCenterY];

        for (const line of tripwires) {
          if (!line.active) continue;

          // Convert normalized tripwire to pixel coordinates
          const p1: [number, number] = [line.p1[0] * canvasW, line.p1[1] * canvasH];
          const p2: [number, number] = [line.p2[0] * canvasW, line.p2[1] * canvasH];

          if (this.checkLineIntersection(prevCenter, currCenter, p1, p2)) {
            const lineKey = `${line.id}_${Math.floor(this.frameCount / 40)}`;
            if (!track.crossedLines.has(lineKey)) {
              track.crossedLines.add(lineKey);
              this.totalCrossingsRecorded++;

              // Determine inbound vs outbound crossing direction
              const crossProduct =
                (p2[0] - p1[0]) * (currCenter[1] - p1[1]) -
                (p2[1] - p1[1]) * (currCenter[0] - p1[0]);

              const isForward = crossProduct > 0;
              if (isForward) {
                line.inCount++;
              } else {
                line.outCount++;
              }

              newCrossings.push({
                id: `cross_${Date.now()}_${track.trackId}`,
                timestamp: new Date().toLocaleTimeString(),
                type: 'wrong_way',
                severity: 'low',
                description: `Track #${track.trackId} (${track.className}) crossed ${line.name} [${isForward ? 'IN' : 'OUT'}]`,
                trackId: track.trackId,
                location: currCenter,
              });
            }
          }
        }

        // Check ROI Zone Containment
        for (const zone of zones) {
          if (!zone.active) continue;
          const isInside = this.isPointInPolygon(
            [newCenterX / canvasW, newCenterY / canvasH],
            zone.polygon
          );

          if (isInside) {
            track.insideZones.add(zone.id);
            // Loitering detection
            if (track.dwellTimeSec > 18 && Math.random() < 0.04) {
              newIncidents.push({
                id: `loit_${Date.now()}_${track.trackId}`,
                timestamp: new Date().toLocaleTimeString(),
                type: 'loitering',
                severity: 'low',
                description: `Track #${track.trackId} dwell time > 18s inside zone ${zone.name}`,
                trackId: track.trackId,
              });
            }
          } else {
            track.insideZones.delete(zone.id);
          }
        }

        // Update track position and trail
        track.bbox = bestDet.bbox;
        track.center = currCenter;
        track.lastSeenFrame = this.frameCount;
        track.dwellTimeSec = Math.round(
          (this.frameCount - track.firstSeenFrame) / 30
        );
        track.trail.push(currCenter);
        if (track.trail.length > 25) {
          track.trail.shift();
        }
      }
    }

    // Allocate new tracks for unmatched detections
    for (const det of filteredDetections) {
      if (!matchedDetectionIds.has(det.id)) {
        const tId = this.nextTrackId++;
        this.totalUniqueTracksRecorded++;
        const cx = det.bbox.x + det.bbox.width / 2;
        const cy = det.bbox.y + det.bbox.height / 2;

        this.activeTracks.set(tId, {
          trackId: tId,
          classId: det.classId,
          className: det.className,
          category: det.category,
          bbox: det.bbox,
          center: [cx, cy],
          velocity: [0, 0],
          speedKmh: det.category === 'vehicle' ? 45 : 5,
          trail: [[cx, cy]],
          firstSeenFrame: this.frameCount,
          lastSeenFrame: this.frameCount,
          dwellTimeSec: 0,
          direction: 'inbound',
          color: det.color,
          crossedLines: new Set<string>(),
          insideZones: new Set<string>(),
        });
      }
    }

    // Drop stale / lost tracks
    const maxAge = settings.maxTrackAge || 30;
    for (const [id, track] of this.activeTracks.entries()) {
      if (this.frameCount - track.lastSeenFrame > maxAge) {
        this.activeTracks.delete(id);
      }
    }

    // Calculate zone occupancy
    for (const zone of zones) {
      const occ = Array.from(this.activeTracks.values()).filter((t) =>
        t.insideZones.has(zone.id)
      ).length;
      zone.currentOccupancy = occ;
      zone.peakOccupancy = Math.max(zone.peakOccupancy, occ);
    }

    return {
      activeTracks: Array.from(this.activeTracks.values()),
      newCrossings,
      newIncidents,
    };
  }

  // Ray-casting algorithm for Point in Polygon
  private isPointInPolygon(
    point: [number, number],
    polygon: Array<[number, number]>
  ): boolean {
    if (polygon.length < 3) return false;
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  // 2D Line Segment Intersection Algorithm
  private checkLineIntersection(
    a1: [number, number],
    a2: [number, number],
    b1: [number, number],
    b2: [number, number]
  ): boolean {
    function ccw(p1: [number, number], p2: [number, number], p3: [number, number]) {
      return (p3[1] - p1[1]) * (p2[0] - p1[0]) > (p2[1] - p1[1]) * (p3[0] - p1[0]);
    }

    return (
      ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2)
    );
  }

  // Draw Heatmap Overlay
  public renderHeatmap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) {
    const cellW = width / this.heatmapCols;
    const cellH = height / this.heatmapRows;

    ctx.save();
    for (let r = 0; r < this.heatmapRows; r++) {
      for (let c = 0; c < this.heatmapCols; c++) {
        const val = this.heatmapGrid[r * this.heatmapCols + c];
        if (val > 0.05) {
          const alpha = Math.min(0.65, val * 0.8);
          // Color ramp: cyan (low) -> yellow (med) -> red (high)
          let color = `rgba(6, 182, 212, ${alpha})`;
          if (val > 0.6) {
            color = `rgba(239, 68, 68, ${alpha})`;
          } else if (val > 0.3) {
            color = `rgba(245, 158, 11, ${alpha})`;
          }

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(
            c * cellW + cellW / 2,
            r * cellH + cellH / 2,
            cellW * 1.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Draw Tracking HUD Overlays (Bounding boxes, IDs, Trajectory Trails, Velocities)
  public renderHUD(
    ctx: CanvasRenderingContext2D,
    tracks: TrackedObject[],
    tripwires: CountingLine[],
    zones: DetectionZone[],
    settings: DetectionSettings,
    width: number,
    height: number
  ) {
    // 1. Draw ROI Zones
    if (settings.showZones) {
      for (const zone of zones) {
        if (!zone.active || zone.polygon.length < 3) continue;

        ctx.save();
        ctx.strokeStyle = zone.color;
        ctx.fillStyle = `${zone.color}20`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);

        ctx.beginPath();
        const startX = zone.polygon[0][0] * width;
        const startY = zone.polygon[0][1] * height;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < zone.polygon.length; i++) {
          ctx.lineTo(zone.polygon[i][0] * width, zone.polygon[i][1] * height);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Zone Tag Label
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(startX, startY - 22, 160, 20);
        ctx.fillStyle = zone.color;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText(
          `${zone.name}: ${zone.currentOccupancy} active`,
          startX + 6,
          startY - 8
        );
        ctx.restore();
      }
    }

    // 2. Draw Tripwire Lines
    if (settings.showTripwires) {
      for (const line of tripwires) {
        if (!line.active) continue;

        const x1 = line.p1[0] * width;
        const y1 = line.p1[1] * height;
        const x2 = line.p2[0] * width;
        const y2 = line.p2[1] * height;

        ctx.save();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // End circle anchors
        ctx.fillStyle = line.color;
        ctx.beginPath();
        ctx.arc(x1, y1, 5, 0, Math.PI * 2);
        ctx.arc(x2, y2, 5, 0, Math.PI * 2);
        ctx.fill();

        // Tripwire Counter Tag
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(midX - 55, midY - 14, 110, 24);
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - 55, midY - 14, 110, 24);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText(`IN:${line.inCount}  OUT:${line.outCount}`, midX - 48, midY + 2);
        ctx.restore();
      }
    }

    // 3. Draw Trajectory Trails
    if (settings.showTrails) {
      ctx.save();
      for (const track of tracks) {
        if (track.trail.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(track.trail[0][0], track.trail[0][1]);
        for (let i = 1; i < track.trail.length; i++) {
          ctx.lineTo(track.trail[i][0], track.trail[i][1]);
        }
        ctx.strokeStyle = track.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();

        // Small pulse dot at trail origin
        ctx.fillStyle = track.color;
        ctx.beginPath();
        ctx.arc(track.trail[0][0], track.trail[0][1], 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Draw Bounding Boxes and Labels
    if (settings.showBoundingBoxes) {
      for (const track of tracks) {
        const { x, y, width: bw, height: bh } = track.bbox;
        ctx.save();

        // Corner bracket bounding box design (cleaner & more tactical than plain rectangles)
        ctx.strokeStyle = track.color;
        ctx.lineWidth = 2;
        const cornerLen = Math.min(14, Math.min(bw, bh) * 0.3);

        // Top-Left
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerLen, y);
        // Top-Right
        ctx.moveTo(x + bw - cornerLen, y);
        ctx.lineTo(x + bw, y);
        ctx.lineTo(x + bw, y + cornerLen);
        // Bottom-Left
        ctx.moveTo(x, y + bh - cornerLen);
        ctx.lineTo(x, y + bh);
        ctx.lineTo(x + cornerLen, y + bh);
        // Bottom-Right
        ctx.moveTo(x + bw - cornerLen, y + bh);
        ctx.lineTo(x + bw, y + bh);
        ctx.lineTo(x + bw, y + bh - cornerLen);
        ctx.stroke();

        // Subtle box perimeter fill
        ctx.fillStyle = `${track.color}10`;
        ctx.fillRect(x, y, bw, bh);

        // Center crosshair
        ctx.strokeStyle = track.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(track.center[0], track.center[1], 3, 0, Math.PI * 2);
        ctx.stroke();

        // Header Metadata Label (Track ID · Class · Speed)
        if (settings.showLabels) {
          const labelText = `#${track.trackId} · ${track.className}${
            settings.showVelocities ? ` · ${track.speedKmh} km/h` : ''
          }`;

          ctx.font = '600 11px "JetBrains Mono", monospace';
          const textMetrics = ctx.measureText(labelText);
          const bgW = textMetrics.width + 12;
          const bgH = 18;

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x, y - bgH, bgW, bgH);
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y - bgH, bgW, bgH);

          ctx.fillStyle = '#f8fafc';
          ctx.fillText(labelText, x + 6, y - 5);
        }

        ctx.restore();
      }
    }
  }
}
