"""Train and evaluate a freight-rate model from shipping_disruptions.csv.

Run: python train_freight_model.py
Outputs: models/freight_rate_model.joblib and models/freight_rate_metrics.json
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


ROOT_DIR = Path(__file__).parent
DATA_PATH = ROOT_DIR / "shipping_disruptions.csv"
MODEL_DIR = ROOT_DIR / "models"
TARGET = "freight_rate_usd"
CATEGORICAL_COLUMNS = ["port", "region", "shipping_mode"]
NUMERIC_COLUMNS = [
    "year", "week_of_year", "avg_wait_days", "disruption_index",
    "fuel_price_usd", "backlog_teu", "on_time_pct",
]


def prepare_data(path: Path) -> pd.DataFrame:
    data = pd.read_csv(path, parse_dates=["week"])
    required = {"week", TARGET, *CATEGORICAL_COLUMNS, *NUMERIC_COLUMNS[2:]}
    missing = required.difference(data.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(sorted(missing))}")
    data = data.copy()
    data["year"] = data["week"].dt.year
    data["week_of_year"] = data["week"].dt.isocalendar().week.astype(int)
    return data.sort_values("week").reset_index(drop=True)


def make_pipeline(model):
    preprocess = ColumnTransformer([
        ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS),
        ("numeric", "passthrough", NUMERIC_COLUMNS),
    ])
    return Pipeline([("preprocess", preprocess), ("model", model)])


def evaluate(name: str, pipeline: Pipeline, x_train, x_test, y_train, y_test):
    pipeline.fit(x_train, y_train)
    prediction = pipeline.predict(x_test)
    return {
        "name": name,
        "pipeline": pipeline,
        "mae": round(float(mean_absolute_error(y_test, prediction)), 2),
        "rmse": round(float(mean_squared_error(y_test, prediction) ** 0.5), 2),
        "r2": round(float(r2_score(y_test, prediction)), 4),
    }


def train() -> dict:
    data = prepare_data(DATA_PATH)
    split_index = int(len(data) * 0.8)
    train_data, test_data = data.iloc[:split_index], data.iloc[split_index:]
    x_train, y_train = train_data[CATEGORICAL_COLUMNS + NUMERIC_COLUMNS], train_data[TARGET]
    x_test, y_test = test_data[CATEGORICAL_COLUMNS + NUMERIC_COLUMNS], test_data[TARGET]

    candidates = [
        evaluate("random_forest", make_pipeline(RandomForestRegressor(
            n_estimators=400, min_samples_leaf=2, random_state=42, n_jobs=1
        )), x_train, x_test, y_train, y_test),
        evaluate("gradient_boosting", make_pipeline(GradientBoostingRegressor(
            n_estimators=250, learning_rate=0.04, max_depth=3, random_state=42
        )), x_train, x_test, y_train, y_test),
    ]
    best = min(candidates, key=lambda item: item["rmse"])
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(best["pipeline"], MODEL_DIR / "freight_rate_model.joblib")

    metrics = {
        "dataset": DATA_PATH.name,
        "target": TARGET,
        "training_rows": len(train_data),
        "test_rows": len(test_data),
        "date_range": {"start": str(data.week.min().date()), "end": str(data.week.max().date())},
        "validation": {key: best[key] for key in ("name", "mae", "rmse", "r2")},
        "candidates": [{key: item[key] for key in ("name", "mae", "rmse", "r2")} for item in candidates],
        "note": "Validated on the latest 20% of observations; this dataset models general shipping disruption rates, not bulk-vessel route quotes.",
    }
    (MODEL_DIR / "freight_rate_metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    result = train()
    print(json.dumps(result, indent=2))
