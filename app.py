from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from predict import predict_text


BASE_DIR = Path(__file__).resolve().parent
STATIC_FILES = {
    "style.css",
    "script.js",
    "LoGo.png",
}

app = Flask(__name__)
ALLOWED_ORIGINS = {
    "https://eduwcyber.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
}


def add_cors_headers(response):
    origin = request.headers.get("Origin", "")

    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept"

    return response


def serve_file(filename: str):
    return send_from_directory(BASE_DIR, filename)


@app.get("/")
def home():
    return serve_file("index.html")


@app.get("/education")
def education():
    return serve_file("education.html")


@app.get("/tools")
def tools():
    return serve_file("tools.html")


@app.get("/<path:filename>")
def static_assets(filename: str):
    if filename not in STATIC_FILES and not Path(filename).suffix:
        return jsonify({"error": "Not found"}), 404
    return serve_file(filename)


@app.after_request
def apply_cors_headers(response):
    return add_cors_headers(response)


@app.route("/analyze", methods=["POST", "OPTIONS"])
def analyze():
    if request.method == "OPTIONS":
        return add_cors_headers(app.make_default_options_response())

    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Text must not be empty."}), 400

    try:
        result = predict_text(text)
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 500
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "Analyzer failed to process the request."}), 500

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)

#other code
from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from predict import predict_text


BASE_DIR = Path(__file__).resolve().parent
STATIC_FILES = {
    "style.css",
    "script.js",
    "LoGo.png",
    "punch_model.pth",
    "punch_labels.txt",
}
PUNCH_MODEL_PATH = BASE_DIR / "punch_model.pth"
PUNCH_LABELS_PATH = BASE_DIR / "punch_labels.txt"

app = Flask(__name__)
ALLOWED_ORIGINS = {
    "https://eduwcyber.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
}


def add_cors_headers(response):
    origin = request.headers.get("Origin", "")

    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Accept"

    return response


def serve_file(filename: str):
    return send_from_directory(BASE_DIR, filename)


@app.get("/")
def home():
    return serve_file("index.html") if (BASE_DIR / "index.html").exists() else serve_file("tools.html")


@app.get("/education")
def education():
    return serve_file("education.html")


@app.get("/tools")
def tools():
    return serve_file("tools.html")


@app.get("/<path:filename>")
def static_assets(filename: str):
    if filename not in STATIC_FILES and not Path(filename).suffix:
        return jsonify({"error": "Not found"}), 404
    return serve_file(filename)


@app.after_request
def apply_cors_headers(response):
    return add_cors_headers(response)


@app.route("/analyze", methods=["POST", "OPTIONS"])
def analyze():
    if request.method == "OPTIONS":
        return add_cors_headers(app.make_default_options_response())

    payload = request.get_json(silent=True) or {}
    text = str(payload.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Text must not be empty."}), 400

    try:
        result = predict_text(text)
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 500
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "Analyzer failed to process the request."}), 500

    return jsonify(result)


@lru_cache(maxsize=1)
def load_punch_model():
    import torch
    from torch import nn

    if not PUNCH_MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {PUNCH_MODEL_PATH.name}")
    if not PUNCH_LABELS_PATH.exists():
        raise FileNotFoundError(f"Labels file not found: {PUNCH_LABELS_PATH.name}")

    labels = [
        line.strip()
        for line in PUNCH_LABELS_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    if not labels:
        raise ValueError("Punch labels file is empty.")

    model = nn.Sequential(
        nn.Linear(63, 128),
        nn.ReLU(),
        nn.Linear(128, len(labels)),
    )

    state = torch.load(PUNCH_MODEL_PATH, map_location="cpu")
    model.load_state_dict(state)
    model.eval()
    return torch, model, labels


def parse_landmarks(payload):
    landmarks = payload.get("landmarks")

    if not isinstance(landmarks, list):
        raise ValueError("landmarks must be a list of 63 numbers.")

    values = [float(value) for value in landmarks]

    if len(values) != 63:
        raise ValueError("landmarks must contain 63 numbers: x, y, z for 21 hand points.")

    return values


@app.route("/analyze-hand", methods=["GET", "POST", "OPTIONS"])
def analyze_hand():
    if request.method == "OPTIONS":
        return add_cors_headers(app.make_default_options_response())

    if request.method == "GET":
        return jsonify({
            "status": "ok",
            "message": "Hand analyzer backend is online.",
            "labels": PUNCH_LABELS_PATH.read_text(encoding="utf-8").splitlines()
            if PUNCH_LABELS_PATH.exists()
            else [],
        })

    payload = request.get_json(silent=True) or {}

    try:
        landmarks = parse_landmarks(payload)
        torch, model, labels = load_punch_model()

        with torch.no_grad():
            tensor = torch.tensor([landmarks], dtype=torch.float32)
            logits = model(tensor)
            probabilities = torch.softmax(logits, dim=1)[0]
            confidence, index = torch.max(probabilities, dim=0)

        label = labels[int(index)]
        confidence_percent = round(float(confidence) * 100, 2)
        is_punch = label.lower() == "punch"

        return jsonify({
            "label": label,
            "prediction": label,
            "confidence": confidence_percent,
            "message": "Punch state detected." if is_punch else "Hand is visible and not in a punch state.",
        })
    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 500
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "Hand analyzer failed to process the request."}), 500


if __name__ == "__main__":
    app.run(debug=True)
