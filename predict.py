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

TONE_BY_SEVERITY = {
    "safe": "Neutral",
    "warning": "Concerning",
    "toxic": "Aggressive",
    "severe": "Aggressive",
}

STATUS_BY_SEVERITY = {
    "safe": "Safe",
    "warning": "Warning",
    "toxic": "Harmful",
    "severe": "Harmful",
}

INSIGHTS = {
    "safe": "Supportive or neutral language reads as safe.",
    "warning": "This message shows red-flag language and may need a calmer, safer response.",
    "toxic": "This message contains harmful language that could negatively affect someone.",
    "severe": "This message strongly resembles abusive or toxic language and should be treated carefully.",
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
    ui_status = STATUS_BY_SEVERITY[severity]

    return {
        "source": "model",
        "text": cleaned_text,
        "prediction": str(raw_prediction),
        "normalized_prediction": normalized_prediction,
        "confidence": confidence,
        "severity": severity,
        "message": MESSAGES[severity],
        "score": confidence if ui_status == "Harmful" else max(0.0, confidence - 35.0 if ui_status == "Warning" else confidence / 5),
        "status": ui_status,
        "tone": TONE_BY_SEVERITY[severity],
        "insight": INSIGHTS[severity],
        "flags": [normalized_prediction],
        "response": (
            "I'm not continuing this conversation."
            if ui_status == "Harmful"
            else "Let's pause this. I'm stepping back from this conversation for now."
            if ui_status == "Warning"
            else "Thanks for checking in. Let's keep the conversation respectful."
        ),
    }


if __name__ == "__main__":
    test_text = "You are useless and stupid"
    print(predict_text(test_text))
