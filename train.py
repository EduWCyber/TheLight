import csv
from collections import Counter
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "dataset.csv"
MODEL_PATH = BASE_DIR / "model.pkl"
VECTORIZER_PATH = BASE_DIR / "vectorizer.pkl"

TEXT_COLUMN_CANDIDATES = ("text", "message", "content", "sentence", "kalimat")
LABEL_COLUMN_CANDIDATES = ("label", "target", "class", "category", "sentiment", "sentimen")


def resolve_column(fieldnames, candidates, column_type):
    normalized = {name.strip().lower(): name for name in fieldnames if name}

    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]

    available = ", ".join(fieldnames)
    raise ValueError(
        f"Could not find a {column_type} column in dataset.csv. Available columns: {available}"
    )


def load_local_dataset():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"dataset.csv was not found at {DATASET_PATH}. Add a CSV file before training."
        )

    if DATASET_PATH.stat().st_size == 0:
        raise ValueError(
            "dataset.csv is empty. Add training rows with columns such as text,label or kalimat,sentimen."
        )

    with DATASET_PATH.open("r", encoding="utf-8-sig", newline="") as file_handle:
        reader = csv.DictReader(file_handle)
        fieldnames = reader.fieldnames or []

        if not fieldnames:
            raise ValueError("dataset.csv must include a header row.")

        text_column = resolve_column(fieldnames, TEXT_COLUMN_CANDIDATES, "text")
        label_column = resolve_column(fieldnames, LABEL_COLUMN_CANDIDATES, "label")

        texts = []
        labels = []

        for row in reader:
            text = str(row.get(text_column, "")).strip()
            label = str(row.get(label_column, "")).strip()

            if text and label:
                texts.append(text)
                labels.append(label)

    if len(texts) < 2:
        raise ValueError("dataset.csv needs at least two valid rows to train a model.")

    if len(set(labels)) < 2:
        raise ValueError("Training requires at least two distinct labels.")

    return texts, labels, text_column, label_column


def load_remote_dataset():
    try:
        from datasets import load_dataset
    except ImportError:
        return None

    dataset = load_dataset("aditdwi123/cyber-bullying-dataset")
    data = dataset["train"]
    return list(data["kalimat"]), list(data["sentimen"]), "kalimat", "sentimen"


def load_training_data():
    if DATASET_PATH.exists() and DATASET_PATH.stat().st_size > 0:
        return load_local_dataset()

    remote_dataset = load_remote_dataset()
    if remote_dataset is not None:
        return remote_dataset

    if DATASET_PATH.exists():
        raise ValueError(
            "dataset.csv is empty and the optional Hugging Face dataset loader is unavailable. "
            "Fill dataset.csv or install the 'datasets' package."
        )

    raise FileNotFoundError(
        "No training data found. Add dataset.csv or install the 'datasets' package to use the remote dataset."
    )


def train_model():
    print("Loading dataset...")
    texts, labels, text_column, label_column = load_training_data()
    print(f"Loaded {len(texts)} samples using columns '{text_column}' and '{label_column}'.")

    print("Vectorizing text...")
    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
    features = vectorizer.fit_transform(texts)

    label_counts = Counter(labels)
    stratify = labels if min(label_counts.values()) > 1 else None

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    print("Training model...")
    model = LogisticRegression(max_iter=1000)
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"Accuracy: {accuracy * 100:.2f}%")

    joblib.dump(model, MODEL_PATH)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    print(f"Model saved to {MODEL_PATH.name}")
    print(f"Vectorizer saved to {VECTORIZER_PATH.name}")


if __name__ == "__main__":
    train_model()
