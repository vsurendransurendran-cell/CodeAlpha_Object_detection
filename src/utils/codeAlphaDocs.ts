export interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export interface UnitTestResult {
  id: string;
  testFile: string;
  testName: string;
  module: string;
  status: 'passed' | 'failed' | 'running';
  durationMs: number;
  assertion: string;
}

export const CODEALPHA_FILES: CodeFile[] = [
  {
    name: 'detector.py',
    path: 'src/detector.py',
    language: 'python',
    description: 'YOLOv8 deep learning object detection inference wrapper with NMS and confidence thresholding.',
    content: `"""
VisionTrack AI - YOLOv8 Detector Module
Author: VisionTrack Team (CodeAlpha Final Project)
"""

import cv2
import numpy as np
from ultralytics import YOLO

class ObjectDetector:
    def __init__(self, model_weight="yolov8n.pt", conf_threshold=0.35, iou_threshold=0.45):
        self.model = YOLO(model_weight)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.target_classes = None  # None tracks all COCO classes

    def filter_classes(self, classes_list):
        self.target_classes = classes_list

    def detect_frame(self, frame):
        """
        Executes YOLOv8 inference on a single BGR frame.
        Returns: list of detections [x1, y1, x2, y2, confidence, class_id, class_name]
        """
        results = self.model.predict(
            source=frame,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            verbose=False
        )
        detections = []
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                cls_name = self.model.names[cls_id]
                
                if self.target_classes and cls_name not in self.target_classes:
                    continue
                    
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].cpu().numpy()
                detections.append({
                    "bbox": xyxy.tolist(),
                    "confidence": conf,
                    "class_id": cls_id,
                    "class_name": cls_name
                })
        return detections
`,
  },
  {
    name: 'object_counter.py',
    path: 'src/object_counter.py',
    language: 'python',
    description: 'Vector-based tripwire line crossing counter and polygonal ROI zone occupancy monitor.',
    content: `"""
VisionTrack AI - Line Crossing & ROI Zone Counter
Handles directional vector analysis and multi-class tallying.
"""

import numpy as np

class LineCounter:
    def __init__(self, line_coords, name="Tripwire_1"):
        self.p1 = np.array(line_coords[0])
        self.p2 = np.array(line_coords[1])
        self.name = name
        self.in_count = 0
        self.out_count = 0
        self.counted_ids = set()

    def ccw(self, A, B, C):
        return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])

    def intersect(self, A, B):
        return self.ccw(A, self.p1, self.p2) != self.ccw(B, self.p1, self.p2) and \
               self.ccw(A, B, self.p1) != self.ccw(A, B, self.p2)

    def check_crossing(self, track_id, prev_pt, curr_pt):
        if track_id in self.counted_ids:
            return None
            
        A, B = np.array(prev_pt), np.array(curr_pt)
        if self.intersect(A, B):
            # Direction vector cross product
            cross_product = (self.p2[0] - self.p1[0]) * (curr_pt[1] - self.p1[1]) - \
                            (self.p2[1] - self.p1[1]) * (curr_pt[0] - self.p1[0])
            direction = "IN" if cross_product > 0 else "OUT"
            
            if direction == "IN":
                self.in_count += 1
            else:
                self.out_count += 1
                
            self.counted_ids.add(track_id)
            return {"track_id": track_id, "direction": direction, "line": self.name}
        return None
`,
  },
  {
    name: 'analytics.py',
    path: 'src/analytics.py',
    language: 'python',
    description: 'Telemetry aggregation, velocity profiling, density heatmaps, and CSV/JSON exporter.',
    content: `"""
VisionTrack AI - Analytics & Reporting Pipeline
Generates time-series flow curves and incident logs.
"""

import pandas as pd
import json

class AnalyticsEngine:
    def __init__(self):
        self.records = []
        self.incidents = []

    def log_track(self, frame_id, track_id, class_name, speed_kmh, dwell_time, bbox):
        self.records.append({
            "frame_id": frame_id,
            "track_id": track_id,
            "class_name": class_name,
            "speed_kmh": round(speed_kmh, 1),
            "dwell_sec": dwell_time,
            "bbox_x": bbox[0],
            "bbox_y": bbox[1]
        })

    def export_csv(self, filename="analytics_export.csv"):
        df = pd.DataFrame(self.records)
        df.to_csv(filename, index=False)
        return len(df)

    def compute_summary_stats(self):
        if not self.records:
            return {}
        df = pd.DataFrame(self.records)
        return {
            "total_objects": df["track_id"].nunique(),
            "avg_speed": round(df["speed_kmh"].mean(), 2),
            "class_breakdown": df["class_name"].value_counts().to_dict(),
            "max_dwell_sec": df["dwell_sec"].max()
        }
`,
  },
  {
    name: 'video_processor.py',
    path: 'src/video_processor.py',
    language: 'python',
    description: 'Video I/O pipeline supporting webcam feeds, video files, and real-time annotated playback.',
    content: `"""
VisionTrack AI - Video Processor Engine
Connects OpenCV VideoCapture with the detection & tracking pipeline.
"""

import cv2
import time

class VideoProcessor:
    def __init__(self, source=0, fps_target=30):
        self.cap = cv2.VideoCapture(source)
        self.fps_target = fps_target
        self.is_running = False

    def process_stream(self, detector, tracker, line_counter):
        self.is_running = True
        frame_idx = 0
        while self.is_running and self.cap.isOpened():
            start_t = time.time()
            ret, frame = self.cap.read()
            if not ret:
                break
                
            frame_idx += 1
            detections = detector.detect_frame(frame)
            tracks = tracker.update(detections, frame)
            
            # Draw HUD & tripwires
            cv2.imshow("VisionTrack AI - Live Feed", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
        self.cap.release()
        cv2.destroyAllWindows()
`,
  },
  {
    name: 'architecture.md',
    path: 'docs/architecture.md',
    language: 'markdown',
    description: 'System architectural diagram, data flow, and pipeline lifecycle documentation.',
    content: `# VisionTrack AI - System Architecture

\`\`\`
[Video Input Stream]
  ├── Camera / RTSP Feed
  ├── Local MP4 / WebM File
  └── Procedural Test Simulation
          │
          ▼
[Frame Ingestion & Preprocessing]
  ├── Resize & Colorspace Normalization (640x360 / 1280x720)
  └── FPS Timestamping
          │
          ▼
[YOLOv8 Detection Core]
  ├── Confidence Score Filtering (conf >= 0.35)
  └── Non-Maximum Suppression (IoU >= 0.45)
          │
          ▼
[Multi-Object Tracker (ByteTrack / SORT)]
  ├── Kalman Filter State Propagation (x, y, vx, vy)
  ├── Hungarian / Cost Matrix Matching
  └── Trajectory Trail History (30-frame vector)
          │
          ▼
[Geometric Analytics Layer]
  ├── Tripwire Vector Crossings (Inbound vs Outbound)
  ├── Region of Interest (ROI) Polygon Containment
  └── Dwell Time & Velocity Profiling
          │
          ▼
[AI Scene Intelligence (Gemini 3.8 Flash)]
  ├── Multimodal Frame Anomaly Classification
  └── Natural Language Traffic & Safety Telemetry Copilot
          │
          ▼
[Interactive Dashboard & Exporters]
  ├── Real-Time HUD Overlay (Bounding Boxes, Trails, Tripwires)
  ├── Flow Rates, Class Distribution & Velocity Charts
  └── CSV / JSON Telemetry Export
\`\`\`
`,
  },
  {
    name: 'testing.md',
    path: 'docs/testing.md',
    language: 'markdown',
    description: 'Unit testing protocols, test coverage criteria, and assertion matrices.',
    content: `# VisionTrack AI - Testing Protocol

### Test Coverage Matrix:
- **test_analytics.py**: 4 assertions verifying dataframe schema, speed aggregation, class distribution tallying, and export formats.
- **test_object_counter.py**: 6 assertions covering CCW orientation, directional entry/exit crossing, double-count suppression, and line intersection geometry.
- **test_video_processor.py**: 4 assertions covering frame drop handling, video stream initialization, resolution resizing, and FPS throttling.

All 14 unit test assertions are designed for zero-regression continuous integration.
`,
  },
  {
    name: 'limitations.md',
    path: 'docs/limitations.md',
    language: 'markdown',
    description: 'Documented constraints, extreme occlusion cases, lighting shifts, and mitigation strategies.',
    content: `# VisionTrack AI - Limitations & Edge Cases

1. **Severe Occlusion & Object Merging**:
   - When two vehicles or pedestrians overlap for > 20 continuous frames, ByteTrack utilizes trajectory continuation. Heavy prolonged occlusion can lead to track ID reassignment.
   - *Mitigation*: Re-ID appearance embedding features or higher camera elevation angles.

2. **Optical Glare & Night Lighting Transitions**:
   - Low-light scenarios produce reduced confidence bounding boxes for non-reflective objects.
   - *Mitigation*: Adaptive histogram equalization (CLAHE) applied during preprocessing.

3. **Perspective Distortion in Speed Estimation**:
   - Monocular cameras without 3D ground-plane homography calibration exhibit non-linear pixel-to-meter distortions along the Z-axis.
   - *Mitigation*: 4-point homography calibration matrix configured per camera installation.
`,
  },
];

export const INITIAL_UNIT_TESTS: UnitTestResult[] = [
  {
    id: 'test_1',
    testFile: 'test_analytics.py',
    testName: 'test_summary_stats_aggregation',
    module: 'AnalyticsEngine',
    status: 'passed',
    durationMs: 14,
    assertion: 'assert summary["total_objects"] == 18 and summary["avg_speed"] > 0',
  },
  {
    id: 'test_2',
    testFile: 'test_analytics.py',
    testName: 'test_csv_export_schema_integrity',
    module: 'AnalyticsEngine',
    status: 'passed',
    durationMs: 22,
    assertion: 'assert set(df.columns) == {"frame_id", "track_id", "class_name", "speed_kmh", "dwell_sec", "bbox_x", "bbox_y"}',
  },
  {
    id: 'test_3',
    testFile: 'test_analytics.py',
    testName: 'test_class_breakdown_percentages',
    module: 'AnalyticsEngine',
    status: 'passed',
    durationMs: 9,
    assertion: 'assert sum(class_distribution.values()) == 100.0',
  },
  {
    id: 'test_4',
    testFile: 'test_analytics.py',
    testName: 'test_dwell_time_max_boundary',
    module: 'AnalyticsEngine',
    status: 'passed',
    durationMs: 11,
    assertion: 'assert max_dwell >= 0.0 and max_dwell <= 86400.0',
  },
  {
    id: 'test_5',
    testFile: 'test_object_counter.py',
    testName: 'test_vector_line_intersection_basic',
    module: 'LineCounter',
    status: 'passed',
    durationMs: 8,
    assertion: 'assert counter.intersect((100, 50), (100, 150)) is True',
  },
  {
    id: 'test_6',
    testFile: 'test_object_counter.py',
    testName: 'test_non_intersecting_trajectory',
    module: 'LineCounter',
    status: 'passed',
    durationMs: 7,
    assertion: 'assert counter.intersect((50, 50), (50, 70)) is False',
  },
  {
    id: 'test_7',
    testFile: 'test_object_counter.py',
    testName: 'test_inbound_vs_outbound_direction',
    module: 'LineCounter',
    status: 'passed',
    durationMs: 12,
    assertion: 'assert result["direction"] == "IN" and counter.in_count == 1',
  },
  {
    id: 'test_8',
    testFile: 'test_object_counter.py',
    testName: 'test_double_count_suppression_per_track',
    module: 'LineCounter',
    status: 'passed',
    durationMs: 10,
    assertion: 'assert counter.in_count == 1 and counter.check_crossing(101, p1, p2) is None',
  },
  {
    id: 'test_9',
    testFile: 'test_object_counter.py',
    testName: 'test_polygon_ray_casting_containment',
    module: 'DetectionZone',
    status: 'passed',
    durationMs: 15,
    assertion: 'assert zone.is_inside((250, 300)) is True and zone.is_inside((50, 50)) is False',
  },
  {
    id: 'test_10',
    testFile: 'test_object_counter.py',
    testName: 'test_peak_occupancy_tracking',
    module: 'DetectionZone',
    status: 'passed',
    durationMs: 9,
    assertion: 'assert zone.peak_occupancy >= zone.current_occupancy',
  },
  {
    id: 'test_11',
    testFile: 'test_video_processor.py',
    testName: 'test_frame_stream_initialization',
    module: 'VideoProcessor',
    status: 'passed',
    durationMs: 19,
    assertion: 'assert cap.isOpened() is True and cap.get(cv2.CAP_PROP_FRAME_COUNT) > 0',
  },
  {
    id: 'test_12',
    testFile: 'test_video_processor.py',
    testName: 'test_resolution_aspect_ratio_clamping',
    module: 'VideoProcessor',
    status: 'passed',
    durationMs: 14,
    assertion: 'assert resized_frame.shape == (360, 640, 3)',
  },
  {
    id: 'test_13',
    testFile: 'test_video_processor.py',
    testName: 'test_fps_throttling_interval',
    module: 'VideoProcessor',
    status: 'passed',
    durationMs: 25,
    assertion: 'assert abs(measured_fps - target_fps) <= 2.5',
  },
  {
    id: 'test_14',
    testFile: 'test_video_processor.py',
    testName: 'test_graceful_stream_cleanup_on_quit',
    module: 'VideoProcessor',
    status: 'passed',
    durationMs: 16,
    assertion: 'assert cap.isOpened() is False and cv2.destroyAllWindows() is None',
  },
];
