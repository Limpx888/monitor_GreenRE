import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import { detectApi, authApi } from '../api/wasteApi';

const CATEGORY_COLORS = {
  RECYCLE: { bg: '#dcfce7', border: '#22c55e', text: '#15803d', icon: '♻️' },
  GENERAL: { bg: '#f1f5f9', border: '#64748b', text: '#334155', icon: '🗑️' },
  ORGANIC: { bg: '#ecfccb', border: '#84cc16', text: '#3f6212', icon: '🌱' },
  HAZARDOUS: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: '⚠️' },
  REVIEW: { bg: '#fef9c3', border: '#eab308', text: '#854d0e', icon: '❓' },
};

export default function WasteScanPage() {
  const { activeSite } = useOutletContext();
  const location = useLocation();

  const [mode, setMode] = useState('upload'); // upload | camera
  const [cameraMode, setCameraMode] = useState('snapshot'); // snapshot | live
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  
  // Camera states
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null); // Ref to active MediaStream to prevent stale closure in unmount cleanup
  const liveIntervalRef = useRef(null);
  const liveInFlightRef = useRef(false);
  const [liveDetections, setLiveDetections] = useState([]);
  const [stableItems, setStableItems] = useState({});
  const [liveActive, setLiveActive] = useState(false);

  useEffect(() => {
    if (activeSite) {
      authApi.locations(activeSite).then(setLocations).catch(() => {});
    }
  }, [activeSite]);

  // Comprehensive camera stop function that terminates all tracks on hardware
  const stopCamera = useCallback(() => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }

    // 1. Stop all tracks from the mutable ref (always points to active stream)
    if (cameraStreamRef.current) {
      try {
        const tracks = cameraStreamRef.current.getTracks() || [];
        tracks.forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch (err) {
        console.warn('Error stopping camera track from ref:', err);
      }
      cameraStreamRef.current = null;
    }

    // 2. Stop all tracks directly on the video DOM element
    if (videoRef.current) {
      try {
        const domStream = videoRef.current.srcObject;
        if (domStream && domStream.getTracks) {
          domStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
        }
        videoRef.current.srcObject = null;
        videoRef.current.pause();
        videoRef.current.load(); // Release media hardware completely
      } catch (e) {
        console.warn('Error clearing video element:', e);
      }
    }

    setCameraStream(null);
    setLiveActive(false);
    setLiveDetections([]);
    setIsCameraLoading(false);
    setCameraError('');
  }, []);

  // Guarantee: When navigating to any other route/tab/feature, immediately kill camera hardware
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [location.pathname, stopCamera]);

  // Guarantee: When switching browser tabs or minimizing window, pause/close camera
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera();
      }
    };

    const handleBeforeUnload = () => {
      stopCamera();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopCamera();
    };
  }, [stopCamera]);

  // Ensure stream is properly bound to <video> when mounted
  useEffect(() => {
    if (mode === 'camera' && videoRef.current && cameraStream) {
      if (videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      videoRef.current.play().catch(err => {
        console.warn('Video playback autoplay prevented:', err);
      });
    }
  }, [mode, cameraStream]);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10 MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Unsupported file type. Use JPG, PNG, or WebP.');
      return;
    }

    setError('');
    setUploading(true);
    setResult(null);

    try {
      const res = await detectApi.detect(file, activeSite, selectedLocation, '', 'upload');
      setResult(res);
    } catch (err) {
      setError(err.message || 'Detection failed. Is the API running?');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // ── Camera Controller with Multi-Level Fallback ──
  const startCamera = async (deviceId = null) => {
    setCameraError('');
    setIsCameraLoading(true);
    setMode('camera'); // Switch to camera tab immediately to show loading placeholder

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by your browser or connection (HTTPS / localhost required).');
      setIsCameraLoading(false);
      return;
    }

    // Stop any existing stream first
    stopCamera();
    setMode('camera');
    setIsCameraLoading(true);

    let stream = null;
    const targetDeviceId = deviceId || selectedDeviceId;

    try {
      // Attempt 1: High definition with preferred camera facing/device
      const constraints = targetDeviceId
        ? { video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err1) {
      console.warn('Attempt 1 (HD / ideal environment) failed:', err1);
      try {
        // Attempt 2: Relaxed resolution with device or user facing
        const constraints2 = targetDeviceId
          ? { video: { deviceId: { exact: targetDeviceId } } }
          : { video: { facingMode: 'user' } };

        stream = await navigator.mediaDevices.getUserMedia(constraints2);
      } catch (err2) {
        console.warn('Attempt 2 (Relaxed facing) failed:', err2);
        try {
          // Attempt 3: Bare minimum { video: true } (most compatible across all webcams)
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (finalErr) {
          console.error('All camera attempts failed:', finalErr);
          if (finalErr.name === 'NotAllowedError' || finalErr.name === 'PermissionDeniedError') {
            setCameraError('Camera permission was denied. Please allow camera access in your browser settings and refresh.');
          } else if (finalErr.name === 'NotFoundError' || finalErr.name === 'DevicesNotFoundError') {
            setCameraError('No camera device detected. Please connect a webcam.');
          } else if (finalErr.name === 'NotReadableError' || finalErr.name === 'TrackStartError') {
            setCameraError('Camera is already in use by another app. Please close other software using the camera.');
          } else {
            setCameraError(`Camera error: ${finalErr.message || 'Unable to open camera.'}`);
          }
          setIsCameraLoading(false);
          return;
        }
      }
    }

    if (stream) {
      cameraStreamRef.current = stream; // Store directly in ref for infallible cleanup
      setCameraStream(stream);

      // Attach immediately if videoRef is already in DOM
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Enumerate devices for camera switching
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        if (!targetDeviceId && videoInputs.length > 0) {
          const track = stream.getVideoTracks()[0];
          const settings = track?.getSettings?.();
          if (settings?.deviceId) {
            setSelectedDeviceId(settings.deviceId);
          }
        }
      } catch (e) {
        console.warn('enumerateDevices error:', e);
      }

      setIsCameraLoading(false);
    }
  };

  const handleSwitchCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDeviceId = videoDevices[nextIndex].deviceId;
    setSelectedDeviceId(nextDeviceId);
    startCamera(nextDeviceId);
  };

  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
      setUploading(true);
      try {
        const res = await detectApi.detect(file, activeSite, selectedLocation, '', 'snapshot');
        setResult(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    }, 'image/jpeg', 0.85);
  };

  const toggleLiveScan = () => {
    if (liveActive) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
      setLiveActive(false);
      return;
    }

    setLiveActive(true);
    const stable = {};

    liveIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'live.jpg', { type: 'image/jpeg' });
        if (liveInFlightRef.current) return; // Skip if a live request is in flight
        liveInFlightRef.current = true;
        try {
          const res = await detectApi.detect(file, activeSite, selectedLocation, '', 'live');
          setLiveDetections(res.detections || []);

          // Stable item counting: track items across frames
          for (const det of (res.detections || [])) {
            const key = `${det.class_name}_${Math.round(det.bbox?.x1 / 50)}_${Math.round(det.bbox?.y1 / 50)}`;
            if (stable[key]) {
              stable[key].count += 1;
            } else {
              stable[key] = { ...det, count: 1 };
            }
          }
          setStableItems({ ...stable });
        } catch {
          // Ignore frame errors in live mode
        } finally {
          liveInFlightRef.current = false;
        }
      }, 'image/jpeg', 0.9);
    }, 800); // ~1.25 FPS
  };

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>🔍 Waste Scanner</h1>
        <p>Upload an image or use your camera to identify and classify waste items</p>
      </div>

      {/* Location selector & Mode toggle */}
      <div className="waste-controls-bar">
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="waste-select"
        >
          <option value="">All Locations</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.bin_type})
            </option>
          ))}
        </select>

        {/* Mode toggle */}
        <div className="waste-mode-toggle">
          <button
            className={`waste-mode-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => {
              stopCamera();
              setMode('upload');
            }}
          >
            📁 Upload
          </button>
          <button
            className={`waste-mode-btn ${mode === 'camera' ? 'active' : ''}`}
            onClick={() => {
              if (mode !== 'camera' || !cameraStream) {
                startCamera();
              }
            }}
          >
            📷 Camera
          </button>
        </div>
      </div>

      {error && <div className="waste-alert error">{error}</div>}
      {cameraError && <div className="waste-alert warning">{cameraError}</div>}

      <div className="waste-scan-content">
        {/* ── Upload Mode ── */}
        {mode === 'upload' && (
          <div
            className={`waste-dropzone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <div className="waste-dropzone-content">
                <div className="waste-spinner" />
                <p>Analyzing image with AI...</p>
              </div>
            ) : (
              <div className="waste-dropzone-content">
                <span className="waste-dropzone-icon">📸</span>
                <p className="waste-dropzone-title">Drop an image here or click to upload</p>
                <p className="waste-dropzone-sub">JPG, PNG, or WebP • Max 10 MB</p>
              </div>
            )}
          </div>
        )}

        {/* ── Camera Mode ── */}
        {mode === 'camera' && (
          <div className="waste-camera-container">
            <div className="waste-video-wrapper" style={{ position: 'relative', background: '#0b1120' }}>
              
              {/* Actual Video Element */}
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && cameraStream && el.srcObject !== cameraStream) {
                    el.srcObject = cameraStream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="waste-video"
                onLoadedMetadata={() => {
                  videoRef.current?.play().catch(() => {});
                }}
                onPlaying={() => setIsCameraLoading(false)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />

              {/* Status Badge */}
              {cameraStream && !isCameraLoading && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  zIndex: 5,
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  <span>LIVE CAMERA FEED</span>
                </div>
              )}

              {/* Camera Loading Overlay */}
              {isCameraLoading && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(11, 17, 32, 0.9)',
                  color: '#ffffff',
                  zIndex: 10,
                  gap: '12px',
                }}>
                  <div className="waste-spinner" />
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Starting Camera Feed...</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Please allow camera permission in your browser if prompted</span>
                </div>
              )}

              {/* Camera Error Prompt Inside Video Box */}
              {cameraError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(11, 17, 32, 0.95)',
                  color: '#ffffff',
                  zIndex: 12,
                  padding: '24px',
                  textAlign: 'center',
                  gap: '12px',
                }}>
                  <span style={{ fontSize: '36px' }}>📷⚠️</span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#f87171' }}>Camera Unavailable</span>
                  <p style={{ fontSize: '13px', color: '#cbd5e1', maxWidth: '420px', margin: 0, lineHeight: 1.5 }}>
                    {cameraError}
                  </p>
                  <button 
                    type="button" 
                    onClick={() => startCamera()} 
                    className="waste-btn primary"
                    style={{ marginTop: '10px' }}
                  >
                    🔄 Retry Camera Access
                  </button>
                </div>
              )}

              {/* Draw bounding boxes overlay for live scan */}
              {liveActive && liveDetections.length > 0 && (
                <svg className="waste-detection-overlay" viewBox={`0 0 ${videoRef.current?.videoWidth || 1280} ${videoRef.current?.videoHeight || 720}`}>
                  {liveDetections.map((det, i) => {
                    const colors = CATEGORY_COLORS[det.category] || CATEGORY_COLORS.REVIEW;
                    return (
                      <g key={i}>
                        <rect
                          x={det.bbox?.x1} y={det.bbox?.y1}
                          width={(det.bbox?.x2 || 0) - (det.bbox?.x1 || 0)}
                          height={(det.bbox?.y2 || 0) - (det.bbox?.y1 || 0)}
                          fill="none"
                          stroke={colors.border}
                          strokeWidth="3"
                        />
                        <text
                          x={(det.bbox?.x1 || 0) + 4}
                          y={(det.bbox?.y1 || 0) - 6}
                          fill={colors.border}
                          fontSize="16"
                          fontWeight="bold"
                        >
                          {det.class_name} ({Math.round(det.confidence * 100)}%)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Camera Controls Bar */}
            <div className="waste-camera-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="waste-camera-mode-toggle">
                <button
                  className={`waste-mode-btn ${cameraMode === 'snapshot' ? 'active' : ''}`}
                  onClick={() => { setCameraMode('snapshot'); setLiveActive(false); clearInterval(liveIntervalRef.current); }}
                >
                  📸 Snapshot
                </button>
                <button
                  className={`waste-mode-btn ${cameraMode === 'live' ? 'active' : ''}`}
                  onClick={() => setCameraMode('live')}
                >
                  🔴 Live Scan
                </button>
              </div>

              {cameraMode === 'snapshot' && (
                <button
                  className="waste-btn primary large"
                  onClick={captureSnapshot}
                  disabled={uploading || !cameraStream}
                >
                  {uploading ? '⏳ Processing...' : '📸 Capture & Analyze'}
                </button>
              )}

              {cameraMode === 'live' && (
                <button
                  className={`waste-btn large ${liveActive ? 'danger' : 'primary'}`}
                  onClick={toggleLiveScan}
                  disabled={!cameraStream}
                >
                  {liveActive ? '⏹ Stop Live Scan' : '▶️ Start Live Scan'}
                </button>
              )}

              {/* Switch camera button if multiple devices */}
              {videoDevices.length > 1 && (
                <button
                  type="button"
                  className="waste-btn secondary"
                  onClick={handleSwitchCamera}
                  title="Switch between front/rear or external webcams"
                >
                  🔄 Switch Camera
                </button>
              )}

              <button 
                type="button"
                className="waste-btn secondary" 
                onClick={() => { 
                  stopCamera(); 
                  setMode('upload'); 
                }}
              >
                ✕ Close Camera
              </button>
            </div>

            {/* Live scan stable items list */}
            {liveActive && Object.keys(stableItems).length > 0 && (
              <div className="waste-live-items">
                <h3>Detected Items (Stable)</h3>
                <div className="waste-live-items-list">
                  {Object.values(stableItems)
                    .filter(item => item.count >= 2)
                    .map((item, i) => (
                      <div key={i} className="waste-live-item">
                        <span className="waste-live-item-icon">
                          {CATEGORY_COLORS[item.category]?.icon || '❓'}
                        </span>
                        <span>{item.class_name}</span>
                        <span className="waste-badge" style={{
                          background: CATEGORY_COLORS[item.category]?.bg,
                          color: CATEGORY_COLORS[item.category]?.text,
                        }}>
                          {item.category}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Detection Results ── */}
        {result && (
          <div className="waste-results">
            <div className="waste-results-header">
              <h2>Detection Results</h2>
              <div className="waste-results-summary">
                <span className="waste-stat">
                  <strong>{result.summary.total_items}</strong> items found
                </span>
                {result.summary.needs_review > 0 && (
                  <span className="waste-stat warning">
                    <strong>{result.summary.needs_review}</strong> need review
                  </span>
                )}
                <span className="waste-stat">
                  ~<strong>{result.summary.total_estimated_weight_kg?.toFixed(2)}</strong> kg estimated
                </span>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="waste-category-pills">
              {Object.entries(result.summary.category_counts || {}).map(([cat, count]) => (
                <div
                  key={cat}
                  className="waste-category-pill"
                  style={{
                    background: CATEGORY_COLORS[cat]?.bg || '#f3f4f6',
                    borderColor: CATEGORY_COLORS[cat]?.border || '#d1d5db',
                    color: CATEGORY_COLORS[cat]?.text || '#374151',
                  }}
                >
                  {CATEGORY_COLORS[cat]?.icon} {cat}: {count}
                </div>
              ))}
            </div>

            {/* Annotated image */}
            <div className="waste-results-grid">
              <div className="waste-annotated-image">
                <h3>AI-Annotated Image</h3>
                <img
                  src={result.annotated_image_url}
                  alt="Annotated waste detection"
                  className="waste-result-img"
                />
              </div>

              {/* Detection list */}
              <div className="waste-detection-list">
                <h3>Detected Items</h3>
                {result.detections.map((det, i) => {
                  const colors = CATEGORY_COLORS[det.category] || CATEGORY_COLORS.REVIEW;
                  return (
                    <div
                      key={det.id || i}
                      className={`waste-detection-card ${det.needs_review ? 'needs-review' : ''}`}
                    >
                      <div className="waste-detection-header">
                        <span className="waste-detection-name">
                          {colors.icon} {det.class_name}
                        </span>
                        <span
                          className="waste-badge"
                          style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                        >
                          {det.category}
                        </span>
                      </div>
                      <div className="waste-detection-meta">
                        <span>Confidence: {Math.round(det.confidence * 100)}%</span>
                        <span>~{det.estimated_weight_kg?.toFixed(3)} kg</span>
                        {det.needs_review && <span className="waste-badge warning">⚠ Needs Review</span>}
                      </div>
                      {det.tip && (
                        <div className="waste-detection-tip">
                          💡 {det.tip}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
