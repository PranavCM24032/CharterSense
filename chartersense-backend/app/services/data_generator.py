import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


class DataGenerator:
    @staticmethod
    def generate_freight_data(days: int = 730) -> pd.DataFrame:
        """Generate realistic synthetic freight rate data for demo use."""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        dates = pd.date_range(start=start_date, end=end_date, freq="D")

        routes = [
            "Australia-East Coast India",
            "South Africa-East Coast India",
            "Indonesia-East Coast India",
            "Brazil-East Coast India",
        ]

        vessel_classes = ["Capesize", "Panamax", "Supramax"]
        multiplier = {"Capesize": 1.25, "Panamax": 1.0, "Supramax": 0.82}

        records = []
        for route in routes:
            base_rate = random.uniform(18, 42)
            for vessel in vessel_classes:
                for idx, date in enumerate(dates):
                    seasonal = 6 * np.sin(2 * np.pi * idx / 365)
                    trend = 0.0015 * idx
                    noise = random.uniform(-2.5, 2.5)

                    if 140 < idx < 180:
                        noise += 10
                    elif 330 < idx < 370:
                        noise -= 8

                    if route == "South Africa-East Coast India" and vessel == "Capesize":
                        noise += 3

                    rate = base_rate * multiplier[vessel] + seasonal + trend + noise
                    rate = max(7.0, round(rate, 2))

                    records.append({
                        "date": date,
                        "route": route,
                        "vessel_class": vessel,
                        "rate": rate,
                        "source": "synthetic",
                    })

        return pd.DataFrame(records)

    @staticmethod
    def generate_port_data() -> pd.DataFrame:
        """Generate port and operational constraint metadata."""
        ports = [
            "Paradip",
            "Visakhapatnam",
            "Kolkata",
            "Haldia",
            "Gangavaram",
            "Dhamra",
        ]

        port_data = []
        for port in ports:
            congestion = random.choice(["Low", "Medium", "High"])
            max_draft = random.uniform(12.0, 18.5)
            berth_length = random.uniform(210, 340)
            allowed_vessels = ["Capesize", "Panamax", "Supramax"]
            if port in ["Kolkata", "Haldia"]:
                allowed_vessels = ["Panamax", "Supramax"]

            port_data.append({
                "port_name": port,
                "max_draft": round(max_draft, 2),
                "berth_length": round(berth_length, 2),
                "max_vessel_size": random.choice(["Capesize", "Panamax", "Supramax"]),
                "congestion_level": congestion,
                "average_turnaround": round(random.uniform(24, 72), 2),
                "allowed_vessels": allowed_vessels,
            })

        return pd.DataFrame(port_data)
