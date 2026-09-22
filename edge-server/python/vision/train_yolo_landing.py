"""
YOLOv8 fine-tuning for downward-facing-camera landing-zone / hazard
detection, using the real, public Semantic Drone Dataset (TU Graz):
  https://www.tugraz.at/index.php?id=22387   (or ivc.tugraz.at/?p=20232)

The Semantic Drone Dataset ships PIXEL-LEVEL segmentation masks (20+
classes: grass, paved-area, obstacle, person, water, etc.), not YOLO
bounding boxes. This script converts the masks into YOLO-format bounding
boxes for the classes relevant to landing-site safety, then fine-tunes
Ultralytics YOLOv8 on them.

Usage:
  1. Download & extract the Semantic Drone Dataset (images/ + masks/).
  2. pip install ultralytics --break-system-packages
  3. python prepare_yolo_dataset.py --src /path/to/semantic_drone --dst ./yolo_landing
  4. python train_yolo_landing.py --data ./yolo_landing/data.yaml
"""
import argparse
import os
import shutil
import numpy as np
from pathlib import Path

# Semantic Drone Dataset class palette (RGB) -> our simplified landing-safety classes
# (Values below are the dataset's documented class-color mapping; verify against
# the actual class_dict.csv shipped with your download before running at scale.)
SAFE_CLASSES = {"grass": 0, "paved-area": 0, "dirt": 0, "gravel": 0}  # -> class 0: "safe_zone"
HAZARD_CLASSES = {
    "person": 1, "car": 2, "bicycle": 2, "dog": 1,
    "tree": 3, "obstacle": 3, "water": 4, "pool": 4, "roof": 5, "wall": 5, "fence": 5,
}
CLASS_NAMES = ["safe_zone", "person_or_animal", "vehicle", "obstacle", "water", "structure"]


def masks_to_yolo_boxes(mask_path, class_color_map, min_area_px=200):
    """
    Convert one semantic-segmentation mask into YOLO-format bounding boxes
    by connected-component analysis per target class.
    Requires: pip install opencv-python-headless scikit-image --break-system-packages
    """
    import cv2
    from skimage import measure

    mask_rgb = cv2.cvtColor(cv2.imread(str(mask_path)), cv2.COLOR_BGR2RGB)
    h, w = mask_rgb.shape[:2]
    boxes = []  # (class_id, x_center, y_center, width, height) normalized

    for class_name, (color, yolo_class_id) in class_color_map.items():
        color_mask = np.all(mask_rgb == np.array(color), axis=-1)
        if not color_mask.any():
            continue
        labeled = measure.label(color_mask)
        for region in measure.regionprops(labeled):
            if region.area < min_area_px:
                continue
            minr, minc, maxr, maxc = region.bbox
            xc = (minc + maxc) / 2 / w
            yc = (minr + maxr) / 2 / h
            bw = (maxc - minc) / w
            bh = (maxr - minr) / h
            boxes.append((yolo_class_id, xc, yc, bw, bh))
    return boxes


def prepare_dataset(src_dir, dst_dir, class_color_csv=None, val_split=0.15):
    """
    src_dir expects the Semantic Drone Dataset layout:
        src_dir/images/*.jpg
        src_dir/masks/*.png   (or gt/semantic/label_images per their release)
    class_color_csv: path to the dataset's own class_dict.csv (RGB -> class
    name mapping) -- REQUIRED for correct conversion; get it from the
    dataset download, do not guess the RGB values.
    """
    src_dir = Path(src_dir)
    dst_dir = Path(dst_dir)
    for split in ["train", "val"]:
        (dst_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (dst_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    images = sorted((src_dir / "images").glob("*.jpg"))
    rng = np.random.default_rng(0)
    rng.shuffle(images)
    n_val = int(len(images) * val_split)
    val_set = set(images[:n_val])

    if class_color_csv is None:
        print("WARNING: no class_color_csv provided -- copying images only. "
              "Supply the dataset's class_dict.csv to auto-generate YOLO labels; "
              "see docstring of masks_to_yolo_boxes().")

    for img_path in images:
        split = "val" if img_path in val_set else "train"
        shutil.copy(img_path, dst_dir / "images" / split / img_path.name)

        mask_path = src_dir / "masks" / (img_path.stem + ".png")
        label_path = dst_dir / "labels" / split / (img_path.stem + ".txt")
        if class_color_csv is not None and mask_path.exists():
            # Build class_color_map from the CSV: {name: ((r,g,b), yolo_id)}
            import csv as csv_mod
            class_color_map = {}
            with open(class_color_csv) as f:
                reader = csv_mod.DictReader(f)
                for row in reader:
                    name = row["name"].strip()
                    rgb = (int(row["r"]), int(row["g"]), int(row["b"]))
                    if name in SAFE_CLASSES:
                        class_color_map[name] = (rgb, SAFE_CLASSES[name])
                    elif name in HAZARD_CLASSES:
                        class_color_map[name] = (rgb, HAZARD_CLASSES[name])
            boxes = masks_to_yolo_boxes(mask_path, class_color_map)
            with open(label_path, "w") as f:
                for cid, xc, yc, bw, bh in boxes:
                    f.write(f"{cid} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}\n")
        else:
            label_path.touch()  # empty label file placeholder

    yaml_content = f"""path: {dst_dir.resolve()}
train: images/train
val: images/val
names:
"""
    for i, name in enumerate(CLASS_NAMES):
        yaml_content += f"  {i}: {name}\n"
    with open(dst_dir / "data.yaml", "w") as f:
        f.write(yaml_content)

    print(f"Prepared {len(images)} images -> {dst_dir}")
    print(f"data.yaml written with classes: {CLASS_NAMES}")


def train_yolo(data_yaml, base_weights="yolov8n.pt", epochs=80, imgsz=640, out_name="landing_zone_yolo"):
    """Fine-tune YOLOv8 nano (fastest, edge-deployable on Jetson Orin Nano)
    starting from Ultralytics' public COCO-pretrained weights."""
    from ultralytics import YOLO
    model = YOLO(base_weights)  # auto-downloads real pretrained COCO weights
    model.train(data=data_yaml, epochs=epochs, imgsz=imgsz, name=out_name,
                device=0 if _has_cuda() else "cpu")
    metrics = model.val()
    print(metrics)
    # export for edge deployment (TensorRT on Jetson recommended for real-time inference)
    model.export(format="onnx")
    return model


def _has_cuda():
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["prepare", "train"], required=True)
    ap.add_argument("--src", help="Semantic Drone Dataset source dir (for prepare)")
    ap.add_argument("--dst", default="./yolo_landing", help="output dataset dir")
    ap.add_argument("--class_color_csv", default=None, help="dataset's class_dict.csv")
    ap.add_argument("--data", help="path to data.yaml (for train)")
    ap.add_argument("--epochs", type=int, default=80)
    args = ap.parse_args()

    if args.mode == "prepare":
        prepare_dataset(args.src, args.dst, class_color_csv=args.class_color_csv)
    else:
        train_yolo(args.data, epochs=args.epochs)
