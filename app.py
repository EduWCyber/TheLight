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
