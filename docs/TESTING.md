# Testing & Evaluation Specification

This document details the quality assurance tests and model benchmarking processes.

---

## 1. Asynchronous Pytest Suite

Run all backend unit tests to verify authentication security, signals control boundaries, and database query executions:
```bash
$env:PYTHONPATH="backend"; python -m pytest backend/tests
```

Key test components validated:
- `test_auth.py`: JWT generation, payload extraction, and operator permissions checking.
- `test_signal.py`: Adaptive timing boundary limits checking and emergency overrides preemption.

---

## 2. ANPR Model Evaluation Benchmarks

To calculate Character Accuracy, F1 Score, Precision, Recall, and condition accuracy rates (daylight, night, low-light, blur, angled, rain, dirty), run the evaluator script:
```bash
python ai-engine/evaluation/anpr_evaluator.py
```

The output scorecard is generated at `ANPR_EVALUATION.md`. It reports exact model accuracy metrics derived directly from image processing and character segmentation on mock validation targets.
