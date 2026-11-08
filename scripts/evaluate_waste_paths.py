"""Measure upload vs live-style preprocessing on the same labeled images.

Labels use YOLO .txt format: class cx cy w h, one file per image.
Example: python scripts/evaluate_waste_paths.py --images eval/images --labels eval/labels --model "best (4).pt"
"""
import argparse
import csv
import io
import time
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image
from ultralytics import YOLO


def load_yolo_boxes(label_path, width, height):
    if not label_path.exists():
        return []
    boxes = []
    for line in label_path.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) != 5:
            continue
        cls, cx, cy, w, h = map(float, parts)
        x1, y1 = (cx - w / 2) * width, (cy - h / 2) * height
        x2, y2 = (cx + w / 2) * width, (cy + h / 2) * height
        boxes.append((int(cls), np.array([x1, y1, x2, y2], dtype=float)))
    return boxes


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    ua = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    ub = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    return inter / (ua + ub - inter + 1e-9)


def evaluate(model, images, labels, quality, conf=0.25, iou_threshold=0.50):
    tp, fp = Counter(), Counter()
    fn = Counter()
    confusion = Counter()
    name_to_id = {v: k for k, v in model.names.items()}
    latencies = []

    for image_path in images:
        pil = Image.open(image_path).convert("RGB")
        if quality < 100:
            buf = io.BytesIO()
            pil.save(buf, format="JPEG", quality=quality)
            pil = Image.open(io.BytesIO(buf.getvalue())).convert("RGB")
        truth = load_yolo_boxes(labels / (image_path.stem + ".txt"), pil.width, pil.height)
        truth_by_id = Counter(cls for cls, _ in truth)

        start = time.perf_counter()
        result = model(pil, conf=conf, verbose=False)[0]
        latencies.append((time.perf_counter() - start) * 1000)
        predictions = []
        if result.boxes is not None:
            for box in result.boxes:
                predictions.append((int(box.cls.item()), float(box.conf.item()), box.xyxy[0].cpu().numpy()))

        matched = set()
        for pred_id, pred_conf, pred_box in sorted(predictions, key=lambda x: -x[1]):
            candidates = [(iou(pred_box, gt_box), i, gt_id)
                          for i, (gt_id, gt_box) in enumerate(truth)
                          if gt_id == pred_id and i not in matched]
            valid = [x for x in candidates if x[0] >= iou_threshold]
            if valid:
                best_iou, best_i, gt_id = max(valid, key=lambda x: x[0])
                matched.add(best_i)
                tp[pred_id] += 1
                confusion[(gt_id, pred_id)] += 1
            else:
                same_class = [(iou(pred_box, gt_box), i, gt_id)
                              for i, (gt_id, gt_box) in enumerate(truth)
                              if i not in matched and iou(pred_box, gt_box) >= iou_threshold]
                if same_class:
                    _, best_i, gt_id = max(same_class, key=lambda x: x[0])
                    matched.add(best_i)
                    fp[pred_id] += 1
                    confusion[(gt_id, pred_id)] += 1
                else:
                    fp[pred_id] += 1
        for gt_id, _ in truth:
            if sum(1 for i, (cid, _) in enumerate(truth) if cid == gt_id) and gt_id not in truth_by_id:
                pass
        for i, (gt_id, _) in enumerate(truth):
            if i not in matched:
                fn[gt_id] += 1

    rows = []
    for cls_id, class_name in model.names.items():
        precision = tp[cls_id] / (tp[cls_id] + fp[cls_id]) if tp[cls_id] + fp[cls_id] else 0.0
        recall = tp[cls_id] / (tp[cls_id] + fn[cls_id]) if tp[cls_id] + fn[cls_id] else 0.0
        rows.append((cls_id, class_name, tp[cls_id], fp[cls_id], fn[cls_id], precision, recall))
    macro_precision = np.mean([r[5] for r in rows])
    macro_recall = np.mean([r[6] for r in rows])
    return rows, confusion, float(np.mean(latencies)), float(np.percentile(latencies, 95))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", required=True)
    parser.add_argument("--labels", required=True)
    parser.add_argument("--model", default="best (4).pt")
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--output", default="waste_eval_results.csv")
    args = parser.parse_args()

    images = sorted([p for p in Path(args.images).iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}])
    if not images:
        raise SystemExit("No images found")

    model = YOLO(args.model)
    print(f"Evaluating {len(images)} images: upload=JPEG100/live=JPEG90")
    for path_label, quality in [("upload", 100), ("live", 90)]:
        rows, confusion, avg_ms, p95_ms = evaluate(model, images, Path(args.labels), quality, args.conf)
        print(f"\n{path_label}: avg={avg_ms:.1f} ms p95={p95_ms:.1f} ms")
        with open(args.output.replace(".csv", f"_{path_label}.csv"), "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["class_id", "class_name", "TP", "FP", "FN", "precision", "recall"])
            writer.writerows(rows)
        print("Top confusion pairs:")
        for (truth, pred), count in confusion.most_common(10):
            print(f"  {model.names[truth]} -> {model.names[pred]}: {count}")

if __name__ == "__main__":
    main()
