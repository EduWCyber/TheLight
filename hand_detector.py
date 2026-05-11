from functools import lru_cache
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
EXPECTED_LANDMARK_VALUES = 63
DEFAULT_LABELS = ["idle", "punch"]


class HandDetectorError(ValueError):
    pass


def _artifact_path(filename):
    candidates = [
        BASE_DIR / filename,
        BASE_DIR.parent / filename,
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def _normalize_landmarks(raw_landmarks):
    if not isinstance(raw_landmarks, list):
        raise HandDetectorError("Landmarks must be sent as a list.")

    values = []

    if raw_landmarks and isinstance(raw_landmarks[0], dict):
        for point in raw_landmarks:
            values.extend([
                float(point.get("x", 0)),
                float(point.get("y", 0)),
                float(point.get("z", 0)),
            ])
    else:
        values = [float(value) for value in raw_landmarks]

    if len(values) != EXPECTED_LANDMARK_VALUES:
        raise HandDetectorError(
            f"Expected {EXPECTED_LANDMARK_VALUES} landmark values, received {len(values)}."
        )

    return values


def _load_labels(label_path):
    if not label_path.exists():
        return DEFAULT_LABELS

    labels = [
        label.strip()
        for label in label_path.read_text(encoding="utf-8").splitlines()
        if label.strip()
    ]

    return labels if len(labels) == 2 else DEFAULT_LABELS


@lru_cache(maxsize=1)
def _load_model():
    model_path = _artifact_path("punch_model.pth")
    label_path = _artifact_path("punch_labels.txt")

    if not model_path.exists():
        return None, _load_labels(label_path), f"Model file not found: {model_path.name}"

    try:
        import torch
        import torch.nn as nn
    except ImportError:
        return None, _load_labels(label_path), "PyTorch is not installed on this server."

    class MLP(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(63, 128),
                nn.ReLU(),
                nn.Linear(128, 2),
            )

        def forward(self, x):
            return self.net(x)

    model = MLP()
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    return (torch, model), _load_labels(label_path), ""


def _point(values, index):
    start = index * 3
    return {
        "x": values[start],
        "y": values[start + 1],
        "z": values[start + 2],
    }


def _distance(a, b):
    return ((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2 + (a["z"] - b["z"]) ** 2) ** 0.5


def _heuristic_prediction(values, motion_score):
    wrist = _point(values, 0)
    middle_mcp = _point(values, 9)
    palm_size = max(_distance(wrist, middle_mcp), 0.001)
    tips = [_point(values, index) for index in (8, 12, 16, 20)]
    mcps = [_point(values, index) for index in (5, 9, 13, 17)]
    finger_tightness = sum(_distance(tip, mcp) for tip, mcp in zip(tips, mcps)) / (4 * palm_size)
    compact_score = max(0, min(1, (1.95 - finger_tightness) / 0.9))
    motion_component = max(0, min(1, motion_score / 0.055))
    punch_score = (compact_score * 0.62) + (motion_component * 0.38)
    label = "punch" if punch_score >= 0.54 else "idle"
    confidence = round((punch_score if label == "punch" else 1 - punch_score) * 100, 2)

    return {
        "label": label,
        "confidence": max(52, min(confidence, 96)),
        "source": "landmark-fallback",
        "model_ready": False,
        "message": "Using browser landmarks because the trained model is not available on the server.",
    }


def predict_hand(payload):
    payload = payload or {}
    values = _normalize_landmarks(payload.get("landmarks"))
    motion_score = float(payload.get("motionScore") or 0)
    loaded_model, labels, model_warning = _load_model()

    if loaded_model:
        torch, model = loaded_model
        with torch.no_grad():
            x = torch.tensor([values], dtype=torch.float32)
            output = model(x)
            probabilities = torch.softmax(output, dim=1)[0]
            prediction_index = int(torch.argmax(probabilities).item())
            confidence = round(float(probabilities[prediction_index]) * 100, 2)

        label = labels[prediction_index] if prediction_index < len(labels) else DEFAULT_LABELS[prediction_index]
        return {
            "label": label,
            "confidence": confidence,
            "source": "trained-model",
            "model_ready": True,
            "message": "Prediction returned by the trained hand detector model.",
        }

    result = _heuristic_prediction(values, motion_score)
    result["model_warning"] = model_warning
    return result


def get_hand_detector_status():
    model_path = _artifact_path("punch_model.pth")
    label_path = _artifact_path("punch_labels.txt")
    labels = _load_labels(label_path)

    return {
        "status": "ok",
        "message": "Hand analyzer backend is online.",
        "model_ready": model_path.exists(),
        "model_file": model_path.name,
        "labels": labels,
    }
