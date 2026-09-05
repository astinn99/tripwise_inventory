#!/usr/bin/env python3
import json
import sys


def main() -> None:
    payload = json.load(sys.stdin)
    series = payload.get("series") or []
    horizon = int(payload.get("horizon") or 30)
    if len(series) < 2:
        raise SystemExit("need at least 2 daily points")

    import pandas as pd
    from prophet import Prophet

    frame = pd.DataFrame(series)
    frame["ds"] = pd.to_datetime(frame["ds"])
    frame["y"] = pd.to_numeric(frame["y"])

    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
    )
    model.fit(frame)
    forecast = model.predict(model.make_future_dataframe(periods=horizon))

    points = []
    for _, row in forecast.iterrows():
        points.append({
            "ds": row["ds"].strftime("%Y-%m-%d"),
            "yhat": float(row["yhat"]),
            "yhat_lower": float(row["yhat_lower"]),
            "yhat_upper": float(row["yhat_upper"]),
        })

    json.dump({"model": "prophet", "points": points}, sys.stdout)


if __name__ == "__main__":
    main()
