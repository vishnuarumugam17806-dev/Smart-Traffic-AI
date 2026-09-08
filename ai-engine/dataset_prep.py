import os
import sys
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VIGITRA_DATASET_PREP")

# Core VIGITRA AI Object & Violation Classes
SUPPORTED_CLASSES = {
    0: "car",
    1: "bus",
    2: "truck",
    3: "motorcycle",
    4: "auto_rickshaw",
    5: "number_plate",
    6: "helmet_violation",
    7: "overloading_violation"
}

DATASET_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "data"))

def prepare_dataset_structure():
    """
    Creates and validates dataset folder hierarchy for VIGITRA AI model training:
    ai-engine/data/
      ├── train/ (images & YOLO txt labels)
      ├── val/   (validation split)
      └── test/  (test benchmark split)
    """
    print("=" * 60)
    print("VIGITRA AI - Dataset Preparation & Validation Tool")
    print("=" * 60)

    subdirs = ["train/images", "train/labels", "val/images", "val/labels", "test/images", "test/labels"]
    for sd in subdirs:
        path = os.path.join(DATASET_ROOT, sd)
        os.makedirs(path, exist_ok=True)
        print(f"Verified dataset directory: {path}")

    # Generate dataset.yaml configuration file for Ultralytics YOLOv8 training
    yaml_content = f"""# VIGITRA AI Traffic & ANPR Dataset Configuration
path: {DATASET_ROOT}
train: train/images
val: val/images
test: test/images

names:
"""
    for cid, cname in SUPPORTED_CLASSES.items():
        yaml_content += f"  {cid}: {cname}\n"

    yaml_path = os.path.join(DATASET_ROOT, "dataset.yaml")
    with open(yaml_path, "w") as f:
        f.write(yaml_content)

    print(f"\nCreated YOLOv8 dataset configuration manifest: {yaml_path}")
    print("\nDataset preparation setup completed successfully.")
    return True

if __name__ == "__main__":
    prepare_dataset_structure()
