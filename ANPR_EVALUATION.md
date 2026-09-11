# ANPR Model Performance Scorecard

This report presents the experimental accuracy benchmarks computed by running the ANPR OCR pipeline over condition-specific validation targets.

## Core Performance Metrics

| Metric | Measured Score |
| :--- | :--- |
| **Exact Plate Accuracy** | 37.5% |
| **Character Accuracy** | 43.8% |
| **Precision** | 37.5% |
| **Recall** | 36.8% |
| **F1 Score** | 37.1% |
| **Average Inference Confidence** | 60.4% |

## Accuracy breakdown by Condition

| Condition | Samples Tested | Exact Match Count | Accuracy Rate |
| :--- | :---: | :---: | :---: |
| Daylight | 2 | 0 | 0.0% |
| Night | 1 | 0 | 0.0% |
| Low-light | 1 | 0 | 0.0% |
| Blur | 1 | 1 | 100.0% |
| Angled | 1 | 1 | 100.0% |
| Rain | 1 | 1 | 100.0% |
| Dirty | 1 | 0 | 0.0% |

> [!NOTE]
> Labeled dataset verification: **Mock Validation Subset Active**. Full production-grade ANPR dataset folder `data/datasets/anpr_val/` was not detected. System calculated baseline metrics dynamically based on standard image processing transforms.
