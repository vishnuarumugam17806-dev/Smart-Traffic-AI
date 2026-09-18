import re
import cv2
import numpy as np
from typing import Tuple, Dict, Any, Optional
from dataclasses import dataclass
from app.core.config import settings

# Configurable Indian registration plate regex patterns (Section 7)
INDIAN_PLATE_PATTERNS = [
    (re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"), "STANDARD_STATE_PRIVATE"),
    (re.compile(r"^[A-Z]{2}[0-9]{1,2}[0-9]{4}$"), "STATE_SHORT_NUMERIC"),
    (re.compile(r"^[A-Z]{2}[A-Z]{1,2}[0-9]{4}$"), "SPECIAL_SERIES"),
    (re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$"), "BHARAT_SERIES"),
    (re.compile(r"^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$"), "STANDARD_10_CHAR")
]

@dataclass
class PlateValidationResult:
    is_valid: bool
    status: str  # VALID, INSUFFICIENT_RESOLUTION, BLURRED, LOW_CONTRAST, INSUFFICIENT_CHARACTERS
    validation_score: float
    reason: str
    char_count: int
    blur_score: float
    contrast_score: float
    aspect_ratio: float

class PlateValidator:
    """
    Validates license plate candidates before OCR and validates OCR results before acceptance.
    Enforces resolution, sharpness (Laplacian variance), contrast, aspect ratio,
    character structure, and Indian registration format rules.
    """

    @staticmethod
    def normalize_plate_text(raw_text: str) -> str:
        """Strips whitespace, hyphens, dots, and non-alphanumerics, returning uppercase."""
        if not raw_text:
            return ""
        clean = re.sub(r"[^A-Za-z0-9]", "", raw_text)
        return clean.upper()

    @staticmethod
    def validate_plate_format(plate_text: str) -> Tuple[bool, str, str]:
        """
        Validates whether plate text matches Indian registration formats.
        Returns: (is_valid_format, normalized_text, pattern_name)
        """
        clean = PlateValidator.normalize_plate_text(plate_text)
        if len(clean) < 6 or len(clean) > 12:
            return False, clean, "INVALID_LENGTH"

        for pattern, name in INDIAN_PLATE_PATTERNS:
            if pattern.match(clean):
                return True, clean, name

        # Allow valid compliant plates with fallback if between 8 and 10 alphanumeric chars
        if 8 <= len(clean) <= 10 and clean[:2].isalpha() and clean[-4:].isdigit():
            return True, clean, "STANDARD_STATE_FALLBACK"

        return False, clean, "UNRECOGNIZED_FORMAT"

    @staticmethod
    def validate_candidate_geometry_and_quality(
        plate_crop: np.ndarray,
        min_width: Optional[int] = None,
        min_height: Optional[int] = None,
        min_area: Optional[int] = None,
        max_blur_threshold: Optional[float] = None
    ) -> PlateValidationResult:
        """
        Performs multi-criteria visual validation on a proposed plate crop:
        1. Dimension & Area checks
        2. Aspect ratio bounds (1.8 - 6.5)
        3. Laplacian variance blur check
        4. Standard deviation contrast check
        5. Alphanumeric character contour structure
        """
        mw = min_width if min_width is not None else settings.ANPR_MIN_PLATE_WIDTH
        mh = min_height if min_height is not None else settings.ANPR_MIN_PLATE_HEIGHT
        ma = min_area if min_area is not None else settings.ANPR_MIN_PLATE_AREA
        blur_th = max_blur_threshold if max_blur_threshold is not None else settings.ANPR_MAX_BLUR_THRESHOLD

        if plate_crop is None or plate_crop.size == 0:
            return PlateValidationResult(
                is_valid=False,
                status="INSUFFICIENT_RESOLUTION",
                validation_score=0.0,
                reason="Plate candidate is empty or zero size",
                char_count=0,
                blur_score=0.0,
                contrast_score=0.0,
                aspect_ratio=0.0
            )

        h, w = plate_crop.shape[:2]
        area = w * h
        aspect = w / float(h) if h > 0 else 0.0

        # 1. Dimension Check
        if w < mw or h < mh or area < ma:
            return PlateValidationResult(
                is_valid=False,
                status="INSUFFICIENT_RESOLUTION",
                validation_score=0.20,
                reason=f"Plate candidate too small: {w}x{h} (area: {area} < {ma})",
                char_count=0,
                blur_score=0.0,
                contrast_score=0.0,
                aspect_ratio=aspect
            )

        # 2. Aspect Ratio Check (Rectangular Indian plate standard)
        if aspect < 1.7 or aspect > 6.8:
            return PlateValidationResult(
                is_valid=False,
                status="INSUFFICIENT_RESOLUTION",
                validation_score=0.25,
                reason=f"Plate aspect ratio non-rectangular: {aspect:.2f} (expected 1.8 - 6.5)",
                char_count=0,
                blur_score=0.0,
                contrast_score=0.0,
                aspect_ratio=aspect
            )

        # Convert to Grayscale
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY) if len(plate_crop.shape) == 3 else plate_crop

        # 3. Blur Check: Laplacian Variance
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if laplacian_var < blur_th:
            return PlateValidationResult(
                is_valid=False,
                status="BLURRED",
                validation_score=round(min(0.60, laplacian_var / (blur_th * 2.0)), 2),
                reason=f"Plate candidate blurred (Laplacian var: {laplacian_var:.1f} < {blur_th})",
                char_count=0,
                blur_score=laplacian_var,
                contrast_score=0.0,
                aspect_ratio=aspect
            )

        # 4. Contrast Check: Standard Deviation
        contrast_std = float(np.std(gray))
        if contrast_std < 14.0:
            return PlateValidationResult(
                is_valid=False,
                status="LOW_CONTRAST",
                validation_score=round(min(0.50, contrast_std / 25.0), 2),
                reason=f"Plate candidate low contrast (Std: {contrast_std:.1f} < 14.0)",
                char_count=0,
                blur_score=laplacian_var,
                contrast_score=contrast_std,
                aspect_ratio=aspect
            )

        # 5. Character Structure Check: Otsu binarization and contour search
        _, bin_plate = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        cnts, _ = cv2.findContours(bin_plate, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        char_boxes = []
        for c in cnts:
            bx, by, bw, bh = cv2.boundingRect(c)
            if 8 < bh < (h * 0.95) and 3 < bw < (w * 0.45):
                char_boxes.append((bx, by, bw, bh))

        char_count = len(char_boxes)
        if char_count < 4:
            return PlateValidationResult(
                is_valid=False,
                status="INSUFFICIENT_CHARACTERS",
                validation_score=0.40,
                reason=f"Insufficient character structures ({char_count} < 4)",
                char_count=char_count,
                blur_score=laplacian_var,
                contrast_score=contrast_std,
                aspect_ratio=aspect
            )

        # Compute normalized visual validation score (0.0 to 1.0)
        aspect_score = 1.0 - min(1.0, abs(aspect - 3.5) / 3.0) * 0.3
        blur_factor = min(1.0, laplacian_var / 120.0)
        contrast_factor = min(1.0, contrast_std / 45.0)
        char_factor = min(1.0, char_count / 8.0)

        composite_score = round(
            (aspect_score * 0.25) +
            (blur_factor * 0.30) +
            (contrast_factor * 0.20) +
            (char_factor * 0.25),
            2
        )

        return PlateValidationResult(
            is_valid=True,
            status="VALID",
            validation_score=composite_score,
            reason="Plate candidate passes visual, geometry, and character structure checks",
            char_count=char_count,
            blur_score=laplacian_var,
            contrast_score=contrast_std,
            aspect_ratio=aspect
        )

plate_validator = PlateValidator()
