import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
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
  const [mode, setMode] = useState('upload'); // upload | camera
  const [cameraMode, setCameraMode] = useState('snapshot'); // snapshot | live
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const [liveDetections, setLiveDetections] = useState([]);
  const [stableItems, setStableItems] = useState({});
  const [liveActive, setLiveActive] = useState(false);

  useEffect(() => {
    if (activeSite) {
      authApi.locations(activeSite).then(setLocations).catch(() => {});
    }
  }, [activeSite]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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

  // ── Camera ──
  const startCamera = async () => {
    setCameraError('');
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // rear camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('camera');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError(`Camera error: ${err.message}`);
      }
    }
  };

  const stopCamera = () => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setLiveActive(false);
    setLiveDetections([]);
  };

  const captureSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'live.jpg', { type: 'image/jpeg' });
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
        }
      }, 'image/jpeg', 0.7);
    }, 800); // ~1.25 FPS
  };

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>🔍 Waste Scanner</h1>
        <p>Upload an image or use your camera to identify and classify waste items</p>
      </div>

      {/* Location selector */}
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
            onClick={() => { setMode('upload'); stopCamera(); }}
          >
            📁 Upload
          </button>
          <button
            className={`waste-mode-btn ${mode === 'camera' ? 'active' : ''}`}
            onClick={startCamera}
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
            <div className="waste-video-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="waste-video"
              />
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

            <div className="waste-camera-controls">
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
                  disabled={uploading}
                >
                  {uploading ? '⏳ Processing...' : '📸 Capture & Analyze'}
                </button>
              )}

              {cameraMode === 'live' && (
                <button
                  className={`waste-btn large ${liveActive ? 'danger' : 'primary'}`}
                  onClick={toggleLiveScan}
                >
                  {liveActive ? '⏹ Stop Live Scan' : '▶️ Start Live Scan'}
                </button>
              )}

              <button className="waste-btn secondary" onClick={() => { stopCamera(); setMode('upload'); }}>
                ✕ Close Camera
              </button>
            </div>

            {/* Live scan stable items */}
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
