from functools import lru_cache
from pathlib import Path

import joblib

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"
VECTORIZER_PATH = BASE_DIR / "vectorizer.pkl"

SAFE_LABELS = {"non-toxic", "non toxic", "safe", "neutral", "not bullying", "not_bullying"}

MESSAGES = {
    "safe": "This message looks safe.",
    "warning": "This message may be harmful. Review it carefully.",
    "toxic": "This message looks harmful and could hurt someone.",
    "severe": "High-risk harmful language detected. Please seek support if needed.",
}


@lru_cache(maxsize=1)
def load_artifacts():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH.name}")
    if not VECTORIZER_PATH.exists():
        raise FileNotFoundError(f"Vectorizer file not found: {VECTORIZER_PATH.name}")

    model = joblib.load(MODEL_PATH)
    vectorizer = joblib.load(VECTORIZER_PATH)
    return model, vectorizer


def normalize_label(label):
    return str(label).strip().lower().replace("_", "-")


def get_confidence(model, vectorized_text):
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(vectorized_text)[0]
        return round(float(max(probabilities)) * 100, 2)
    return 100.0


def get_severity(prediction, confidence):
    if prediction in SAFE_LABELS:
        return "safe"
    if confidence < 60:
        return "warning"
    if confidence < 80:
        return "toxic"
    return "severe"


def predict_text(text):
    cleaned_text = str(text).strip()
    if not cleaned_text:
        raise ValueError("Text must not be empty.")

    model, vectorizer = load_artifacts()
    vectorized_text = vectorizer.transform([cleaned_text])

    raw_prediction = model.predict(vectorized_text)[0]
    normalized_prediction = normalize_label(raw_prediction)
    confidence = get_confidence(model, vectorized_text)
    severity = get_severity(normalized_prediction, confidence)

    return {
        "text": cleaned_text,
        "prediction": str(raw_prediction),
        "normalized_prediction": normalized_prediction,
        "confidence": confidence,
        "severity": severity,
        "message": MESSAGES[severity],
    }


if __name__ == "__main__":
    test_text = "You are useless and stupid"
    print(predict_text(test_text))
