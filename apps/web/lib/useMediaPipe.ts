/**
 * useMediaPipe — Comprehensive Behavioral Intelligence Engine
 * Uses @mediapipe/tasks-vision FaceLandmarker + PoseLandmarker
 *
 * Tracks:
 *   - Eye contact & gaze direction
 *   - Head pose (yaw, pitch, roll)
 *   - Emotions (smile, frown, surprise, concentration, stress)
 *   - Posture (shoulder level, slouch, lean)
 *   - Mindset composites (confidence, engagement, nervousness)
 *   - Proctoring (multiple faces, face absence, tab switch)
 */
"use client";

import { useEffect, useRef, useState } from "react";

// ── Metric Types ──────────────────────────────────────────────────────────────

export interface BehavioralMetrics {
  // Core Gaze & Head
  eyeContactScore: number;      // 0-100: gaze toward camera
  headPoseYaw: number;          // degrees left/right (-90 to 90)
  headPosePitch: number;        // degrees up/down (-90 to 90)
  headPoseRoll: number;         // degrees tilt (-90 to 90)
  lookingAway: boolean;

  // Proctoring
  faceVisible: boolean;
  multipleFaces: boolean;

  // Blink
  blinkRate: number;            // blinks per minute (caller aggregates)

  // Emotions (0-100 each)
  smileScore: number;           // happiness / positivity
  frownScore: number;           // sadness / displeasure
  surpriseScore: number;        // surprise / shock
  concentrationScore: number;   // brow furrow = deep thinking
  stressScore: number;          // lip press + brow furrow + squint
  disgustScore: number;         // nose sneer + lip curl

  // Speaking
  mouthOpenness: number;        // 0-1, jaw open (speaking activity)
  isSpeaking: boolean;          // true when mouth significantly open

  // Posture (MediaPipe Pose Landmarker)
  postureScore: number;         // 0-100: upright = 100, slouch = low
  shoulderLevelDiff: number;    // 0-100: 0 = even shoulders, 100 = very uneven
  isLeaning: boolean;           // candidate leaning to one side

  // Mindset Composites (derived)
  confidenceScore: number;      // eye contact + posture + smile + steady head
  engagementScore: number;      // face visible + eye contact + speaking activity
  nervousnessScore: number;     // blink rate + stress + brow furrow + looking away
  overallBehaviorScore: number; // weighted composite of all positive signals

  timestamp: number;
}

export const DEFAULT_METRICS: BehavioralMetrics = {
  eyeContactScore: 100,
  headPoseYaw: 0,
  headPosePitch: 0,
  headPoseRoll: 0,
  lookingAway: false,
  faceVisible: true,
  multipleFaces: false,
  blinkRate: 15,
  smileScore: 0,
  frownScore: 0,
  surpriseScore: 0,
  concentrationScore: 0,
  stressScore: 0,
  disgustScore: 0,
  mouthOpenness: 0,
  isSpeaking: false,
  postureScore: 80,
  shoulderLevelDiff: 0,
  isLeaning: false,
  confidenceScore: 75,
  engagementScore: 80,
  nervousnessScore: 20,
  overallBehaviorScore: 75,
  timestamp: Date.now(),
};

interface UseMediaPipeOptions {
  videoElement: HTMLVideoElement | null;
  enabled: boolean;
  onMetrics?: (metrics: BehavioralMetrics) => void;
  onViolation?: (type: string, message: string) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMediaPipe({
  videoElement,
  enabled,
  onMetrics,
  onViolation,
}: UseMediaPipeOptions) {
  const [metrics, setMetrics] = useState<BehavioralMetrics>(DEFAULT_METRICS);
  const [isReady, setIsReady] = useState(false);

  const faceLandmarkerRef = useRef<unknown>(null);
  const poseLandmarkerRef = useRef<unknown>(null);
  const rafRef = useRef<number>();
  const noFaceStartRef = useRef<number | null>(null);
  const lookAwayStartRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastMetricsRef = useRef<BehavioralMetrics>(DEFAULT_METRICS);
  const lastStateUpdateRef = useRef(0);

  // ── Init: Load both Face + Pose models in parallel ─────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const init = async () => {
      try {
        const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        // Load Face + Pose models in parallel for faster startup
        const [faceLandmarker, poseLandmarker] = await Promise.all([
          FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            outputFaceBlendshapes: true,        // emotions
            outputFacialTransformationMatrixes: true, // head pose
            runningMode: "VIDEO",
            numFaces: 3, // detect up to 3 for proctoring
          }),
          PoseLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              // Lite model: fast & accurate enough for shoulder/posture
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          }),
        ]);

        faceLandmarkerRef.current = faceLandmarker;
        poseLandmarkerRef.current = poseLandmarker;
        setIsReady(true);
        console.log("🧠 MediaPipe Behavioral AI: Face + Pose models loaded ✅");
      } catch (err) {
        console.warn("MediaPipe init warning (non-critical):", err);
        // Try face-only fallback
        try {
          const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
          const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
          );
          const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: "VIDEO",
            numFaces: 3,
          });
          faceLandmarkerRef.current = faceLandmarker;
          setIsReady(true);
          console.log("🧠 MediaPipe: Face-only mode (Pose unavailable)");
        } catch {
          console.warn("MediaPipe fully unavailable — interview continues without behavioral AI");
        }
      }
    };

    init();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      faceLandmarkerRef.current = null;
      poseLandmarkerRef.current = null;
    };
  }, [enabled]);

  // ── Detection Loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !videoElement || !enabled) return;

    const detect = () => {
      frameCountRef.current++;

      // Face: every 2nd frame (~30fps), Pose: every 6th frame (~10fps)
      const runFace = frameCountRef.current % 2 === 0;
      const runPose = frameCountRef.current % 6 === 0;

      if (!runFace && !runPose) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        if (!videoElement.videoWidth) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        const now = performance.now();

        // Run face detection
        let faceResult: FaceResult | null = null;
        if (runFace && faceLandmarkerRef.current) {
          const fl = faceLandmarkerRef.current as { detectForVideo: FaceDetectFn };
          faceResult = fl.detectForVideo(videoElement, now);
        }

        // Run pose detection
        let poseResult: PoseResult | null = null;
        if (runPose && poseLandmarkerRef.current) {
          const pl = poseLandmarkerRef.current as { detectForVideo: PoseDetectFn };
          poseResult = pl.detectForVideo(videoElement, now);
        }

        const newMetrics = computeMetrics(faceResult, poseResult, lastMetricsRef.current);
        lastMetricsRef.current = newMetrics;
        if (now - lastStateUpdateRef.current > 1000) {
          lastStateUpdateRef.current = now;
          setMetrics(newMetrics);
        }
        onMetrics?.(newMetrics);

        // ── Violation Checks ─────────────────────────────────────────────────

        // No face > 3 seconds
        if (!newMetrics.faceVisible) {
          if (!noFaceStartRef.current) {
            noFaceStartRef.current = Date.now();
          } else if (Date.now() - noFaceStartRef.current > 3000) {
            onViolation?.("no_face", "⚠ Face not detected for 3+ seconds. Please face the camera.");
            noFaceStartRef.current = null;
          }
        } else {
          noFaceStartRef.current = null;
        }

        // Multiple faces
        if (newMetrics.multipleFaces) {
          onViolation?.("multiple_faces", "⚠ Multiple faces detected! Ensure you are alone.");
        }

        // Looking away > 5 seconds continuously
        if (newMetrics.lookingAway) {
          if (!lookAwayStartRef.current) {
            lookAwayStartRef.current = Date.now();
          } else if (Date.now() - lookAwayStartRef.current > 5000) {
            onViolation?.("looking_away", "👀 Please maintain eye contact with the camera.");
            lookAwayStartRef.current = null;
          }
        } else {
          lookAwayStartRef.current = null;
        }

      } catch { /* silent — non-critical */ }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isReady, videoElement, enabled, onMetrics, onViolation]);

  return { metrics, isReady };
}

// ── Type helpers ──────────────────────────────────────────────────────────────

interface Blendshape { categoryName: string; score: number; }
interface FaceResult {
  faceLandmarks: { x: number; y: number; z: number }[][];
  faceBlendshapes: { categories: Blendshape[] }[];
  facialTransformationMatrixes: { data: Float32Array }[];
}
interface PoseLandmark { x: number; y: number; z: number; visibility?: number; }
interface PoseResult {
  poseLandmarks: PoseLandmark[][];
}
type FaceDetectFn = (v: HTMLVideoElement, t: number) => FaceResult;
type PoseDetectFn = (v: HTMLVideoElement, t: number) => PoseResult;

// ── Core Computation ──────────────────────────────────────────────────────────

function bs(blendshapes: Blendshape[], name: string): number {
  return blendshapes.find(b => b.categoryName === name)?.score ?? 0;
}

function computeMetrics(
  faceResult: FaceResult | null,
  poseResult: PoseResult | null,
  lastMetrics: BehavioralMetrics
): BehavioralMetrics {

  // If faceResult is null, we are on a skipped frame for face detection.
  // We should preserve the face-related metrics from lastMetrics.
  let numFaces = lastMetrics.faceVisible ? 1 : 0;
  if (lastMetrics.multipleFaces) numFaces = 2;
  
  if (faceResult !== null) {
    numFaces = faceResult?.faceLandmarks?.length ?? 0;
  }

  // ── No Face ──────────────────────────────────────────────────────────────
  if (numFaces === 0) {
    return {
      ...DEFAULT_METRICS,
      faceVisible: false,
      eyeContactScore: 0,
      confidenceScore: 0,
      engagementScore: 0,
      overallBehaviorScore: 0,
      timestamp: Date.now(),
    };
  }

  // ── Extract or preserve face blendshapes / matrix ──
  let eyeContactScore = lastMetrics.eyeContactScore;
  let lookingAway = lastMetrics.lookingAway;
  let smileScore = lastMetrics.smileScore;
  let frownScore = lastMetrics.frownScore;
  let surpriseScore = lastMetrics.surpriseScore;
  let concentrationScore = lastMetrics.concentrationScore;
  let stressScore = lastMetrics.stressScore;
  let disgustScore = lastMetrics.disgustScore;
  let mouthOpenness = lastMetrics.mouthOpenness;
  let isSpeaking = lastMetrics.isSpeaking;
  let isBlink = lastMetrics.blinkRate === 1;
  let yaw = lastMetrics.headPoseYaw;
  let pitch = lastMetrics.headPosePitch;
  let roll = lastMetrics.headPoseRoll;

  if (faceResult !== null) {
    const blends = faceResult.faceBlendshapes?.[0]?.categories ?? [];
    const matrix = faceResult.facialTransformationMatrixes?.[0]?.data;

    // Head Pose
    let currentYaw = 0, currentPitch = 0, currentRoll = 0;
    if (matrix && matrix.length >= 16) {
      currentPitch = Math.atan2(-matrix[9], matrix[10]) * (180 / Math.PI);
      currentYaw   = Math.atan2(matrix[8],  matrix[0])  * (180 / Math.PI);
      currentRoll  = Math.atan2(matrix[4],  matrix[5])  * (180 / Math.PI);
    }
    yaw = Math.round(currentYaw);
    pitch = Math.round(currentPitch);
    roll = Math.round(currentRoll);

    // Eye Contact
    const yawPenalty   = Math.min(Math.abs(currentYaw)   / 45, 1);
    const pitchPenalty = Math.min(Math.abs(currentPitch) / 30, 1);
    eyeContactScore = Math.max(0, Math.round((1 - yawPenalty * 0.7 - pitchPenalty * 0.3) * 100));
    lookingAway = Math.abs(currentYaw) > 30 || Math.abs(currentPitch) > 25;

    // Blink
    const leftBlink  = bs(blends, "eyeBlinkLeft");
    const rightBlink = bs(blends, "eyeBlinkRight");
    isBlink = leftBlink > 0.4 && rightBlink > 0.4;

    // Smile
    smileScore = Math.round(
      ((bs(blends, "mouthSmileLeft") + bs(blends, "mouthSmileRight")) / 2 +
       (bs(blends, "cheekSquintLeft") + bs(blends, "cheekSquintRight")) / 4) * 100
    );

    // Frown
    frownScore = Math.round(
      ((bs(blends, "mouthFrownLeft") + bs(blends, "mouthFrownRight")) / 2) * 100
    );

    // Surprise
    surpriseScore = Math.round(
      ((bs(blends, "browInnerUp") * 0.4 +
        (bs(blends, "eyeWideLeft") + bs(blends, "eyeWideRight")) / 2 * 0.4 +
        bs(blends, "jawOpen") * 0.2)) * 100
    );

    // Concentration
    concentrationScore = Math.round(
      ((bs(blends, "browDownLeft") + bs(blends, "browDownRight")) / 2 +
       (bs(blends, "eyeSquintLeft") + bs(blends, "eyeSquintRight")) / 4) * 100
    );

    // Stress
    stressScore = Math.round(
      ((bs(blends, "mouthPressLeft") + bs(blends, "mouthPressRight")) / 2 * 0.4 +
       (bs(blends, "browDownLeft")   + bs(blends, "browDownRight"))   / 2 * 0.3 +
       (bs(blends, "eyeSquintLeft")  + bs(blends, "eyeSquintRight"))  / 2 * 0.2 +
        bs(blends, "mouthRollLower") * 0.1) * 100
    );

    // Disgust
    disgustScore = Math.round(
      ((bs(blends, "noseSneerLeft") + bs(blends, "noseSneerRight")) / 2 * 0.6 +
       (bs(blends, "mouthStretchLeft") + bs(blends, "mouthStretchRight")) / 2 * 0.4) * 100
    );

    // Speaking activity
    const jawOpen = bs(blends, "jawOpen");
    mouthOpenness = jawOpen;
    isSpeaking = jawOpen > 0.15;
  }

  // ── Posture from Pose Landmarks ──────────────────────────────────────────
  let postureScore = lastMetrics.postureScore;
  let shoulderLevelDiff = lastMetrics.shoulderLevelDiff;
  let isLeaning = lastMetrics.isLeaning;

  if (poseResult !== null) {
    const poses = poseResult?.poseLandmarks;
    if (poses && poses.length > 0) {
      const lm = poses[0];
      const leftShoulder  = lm[11];
      const rightShoulder = lm[12];
      const leftHip       = lm[23];
      const rightHip      = lm[24];
      const nose          = lm[0];

      if (leftShoulder && rightShoulder) {
        // Shoulder level difference (y-axis in normalized 0-1 coords)
        const yDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        shoulderLevelDiff = Math.round(Math.min(yDiff / 0.15, 1) * 100);

        // Shoulder width (x-axis spread — narrow = hunching)
        const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const hunchPenalty  = Math.max(0, (0.25 - shoulderWidth) / 0.25); // penalize if width < 0.25

        // Body lean: compare nose X to shoulder midpoint X
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const leanAmount   = Math.abs((nose?.x ?? shoulderMidX) - shoulderMidX);
        isLeaning          = leanAmount > 0.08;
        const leanPenalty  = Math.min(leanAmount / 0.15, 1);

        // Forward/backward lean using z-depth of shoulders vs hips
        let forwardLeanPenalty = 0;
        if (leftHip && rightHip) {
          const shoulderZ = (leftShoulder.z + rightShoulder.z) / 2;
          const hipZ      = (leftHip.z + rightHip.z) / 2;
          const zDiff     = shoulderZ - hipZ; // negative = leaning forward
          forwardLeanPenalty = Math.min(Math.abs(zDiff) / 0.3, 1) * 0.4;
        }

        // Calculate actual posture score
        postureScore = Math.max(0, Math.round(
          (1 - hunchPenalty * 0.35 - leanPenalty * 0.35 - forwardLeanPenalty - (shoulderLevelDiff / 100) * 0.15) * 100
        ));
      } else {
        // Shoulders missing
        postureScore = 30;
      }
    } else {
      // Pose landmarker ran but detected no body/shoulders (e.g. lying down or out of frame)
      postureScore = 30;
      shoulderLevelDiff = 0;
      isLeaning = true;
    }
  }

  // ── Mindset Composite Scores ─────────────────────────────────────────────

  // Confidence: eye contact + posture + smile - stress
  const confidenceScore = Math.max(0, Math.min(100, Math.round(
    eyeContactScore * 0.35 +
    postureScore    * 0.25 +
    smileScore      * 0.20 +
    (100 - Math.abs(yaw) / 0.9) * 0.10 +  // steady head = confident
    (100 - stressScore) * 0.10
  )));

  // Engagement: face visible + eye contact + speaking
  const engagementScore = Math.max(0, Math.min(100, Math.round(
    eyeContactScore             * 0.45 +
    (isSpeaking ? 80 : 40)      * 0.25 +  // actively speaking = engaged
    (lookingAway ? 60 : 100)    * 0.15 +
    concentrationScore          * 0.15
  )));

  // Nervousness: lip press + brow furrow + eye squint + looks away + blink
  const nervousnessScore = Math.max(0, Math.min(100, Math.round(
    stressScore          * 0.35 +
    (lookingAway ? 60 : 0) * 0.25 +
    frownScore           * 0.20 +
    (isBlink ? 30 : 0)   * 0.20
  )));

  // Overall behavior: weighted positive signals
  const overallBehaviorScore = Math.max(0, Math.min(100, Math.round(
    confidenceScore  * 0.35 +
    engagementScore  * 0.30 +
    postureScore     * 0.20 +
    (100 - nervousnessScore) * 0.15
  )));

  return {
    eyeContactScore,
    headPoseYaw:   Math.round(yaw),
    headPosePitch: Math.round(pitch),
    headPoseRoll:  Math.round(roll),
    lookingAway,
    faceVisible:   true,
    multipleFaces: numFaces > 1,
    blinkRate:     isBlink ? 1 : 0,
    smileScore:    Math.min(100, smileScore),
    frownScore:    Math.min(100, frownScore),
    surpriseScore: Math.min(100, surpriseScore),
    concentrationScore: Math.min(100, concentrationScore),
    stressScore:   Math.min(100, stressScore),
    disgustScore:  Math.min(100, disgustScore),
    mouthOpenness,
    isSpeaking,
    postureScore,
    shoulderLevelDiff,
    isLeaning,
    confidenceScore,
    engagementScore,
    nervousnessScore,
    overallBehaviorScore,
    timestamp: Date.now(),
  };
}
