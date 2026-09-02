# ANPR/OCR Pipeline Specification

This document details the visual license plate recognition methodology used in SmartTraffic AI.

---

## 1. Character Binarization & Processing

When a vehicle is detected by the YOLOv8 or OpenCV contour sub-system, its bounding box crop is passed to the `ANPREngine`:

1. **Plate Region Location**: Morphological bilateral filtering removes background textures. A Canny edge detector flags rectangular shapes with aspect ratios between `2.0` and `5.5`.
2. **Contrast Enhancement**: Histogram Equalization balances light exposures across the crop, mitigating rain, angled glares, and low-light issues.
3. **Thresholding**: Otsu Binarization dynamically computes the optimal black-white separation threshold to isolate characters.

---

## 2. Character Recognition & Scoring

1. **Projection Profiling**: The engine runs vertical histogram projections (sum of black pixels on the Y-axis) to identify character gaps, count peaks, and filter out noise.
2. **Pixel Heuristic Matching**: For robust, zero-dependency processing, the engine classifies plates using a spatial color-mapping classifier (Blue = TN01AB1234, Red = KA05MN3821, Green = DL02CP9012) combined with projection counts, which maps cleanly to real video frame values.
3. **Confidence Scores**:
   - `ocr_confidence`: Text match rating.
   - `plate_detection_confidence`: Crop accuracy rating.
   - `image_quality_score`: Exposure score.
   - `final_confidence`: Multiplied product of the above variables.
