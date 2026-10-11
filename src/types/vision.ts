export type ClassCategory = 'vehicle' | 'pedestrian' | 'freight' | 'misc';

export interface BoundingBox {
  x: number; // Normalized 0-1 or pixel
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  classId: number;
  className: string;
  category: ClassCategory;
  confidence: number;
  bbox: BoundingBox; // pixel coordinates
  color: string;
}

export interface TrackedObject {
  trackId: number;
  classId: number;
  className: string;
  category: ClassCategory;
  bbox: BoundingBox;
  center: [number, number];
  velocity: [number, number]; // [vx, vy] px/frame
  speedKmh: number;
  trail: Array<[number, number]>; // history of points
  firstSeenFrame: number;
  lastSeenFrame: number;
  dwellTimeSec: number;
  direction: 'inbound' | 'outbound' | 'stationary';
  color: string;
  crossedLines: Set<string>;
  insideZones: Set<string>;
}

export interface CountingLine {
  id: string;
  name: string;
  p1: [number, number]; // [x, y] normalized 0-1
  p2: [number, number];
  inCount: number;
  outCount: number;
  color: string;
  active: boolean;
  orientation: 'horizontal' | 'vertical' | 'diagonal';
}

export interface DetectionZone {
  id: string;
  name: string;
  polygon: Array<[number, number]>; // normalized 0-1 points
  color: string;
  currentOccupancy: number;
  peakOccupancy: number;
  active: boolean;
}

export type FeedSource =
  | 'traffic_highway'
  | 'pedestrian_plaza'
  | 'warehouse_logistics'
  | 'retail_store'
  | 'webcam'
  | 'custom_video';

export interface IncidentEvent {
  id: string;
  timestamp: string;
  type: 'speeding' | 'loitering' | 'wrong_way' | 'density_spike' | 'zone_intrusion';
  severity: 'low' | 'medium' | 'high';
  description: string;
  trackId?: number;
  location?: [number, number];
}

export interface FlowDataPoint {
  timeLabel: string;
  timestamp: number;
  inbound: number;
  outbound: number;
  total: number;
}

export interface VideoAnalyticsTelemetry {
  fps: number;
  currentFrame: number;
  activeTracksCount: number;
  totalUniqueTracks: number;
  totalCrossings: number;
  lineCrossings: Record<string, { in: number; out: number }>;
  classCounts: Record<string, number>;
  avgSpeedKmh: number;
  avgDwellTimeSec: number;
  peakOccupancy: number;
  flowRatePerMin: number;
  recentIncidents: IncidentEvent[];
  flowHistory: FlowDataPoint[];
}

export interface DetectionSettings {
  confidenceThreshold: number;
  iouThreshold: number;
  showBoundingBoxes: boolean;
  showLabels: boolean;
  showConfidence: boolean;
  showTrails: boolean;
  showVelocities: boolean;
  showTripwires: boolean;
  showZones: boolean;
  showHeatmap: boolean;
  maxTrackAge: number;
  selectedClasses: string[];
}
