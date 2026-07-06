"""
Fetches demo_gind from the Eurostat Statistics API and produces a tidy CSV.

Usage:
    python scripts/fetch_demo_gind.py

Output:
    data/demo_gind_tidy.csv   columns: geo, indic_code, indicator, year, value
"""

import json
import re
import sys
from pathlib import Path

import pandas as pd
import urllib.request

OUT = Path(__file__).parent.parent / "data" / "demo_gind_tidy.csv"

INDICATOR_LABELS = {
    "JAN": "Population on 1 January",
    "LBIRTH": "Live births",
    "DEATH": "Deaths",
    "GBIRTHRT": "Crude Birth Rate",
    "GDEATHRT": "Crude Death Rate",
    "NATGROWRT": "Natural Change Rate",
    "CNMIGRATRT": "Net Migration Rate",
}

# Eurostat uses non-ISO codes for some countries; we expose them unchanged so
# they match the GISCO geometry's CNTR_ID field.
EXCLUDE_GEOS = {
    "EU27_2020", "EU27_2007", "EU28", "EA19", "EA20", "EA18", "EA21",
    "EEA30_2007", "EEA31", "EFTA",
    "DE_TOT",   # Germany (old boundaries) duplicate
    "FX",       # France metropolitan (duplicate of FR)
}

API_URL = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
    "demo_gind?format=JSON&lang=EN&sinceTimePeriod=1960&untilTimePeriod=2024"
)


def fetch_json(url: str) -> dict:
    print(f"Fetching: {url}")
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        return json.load(r)


def parse_jsonstat(data: dict) -> pd.DataFrame:
    dims = data["id"]               # ordered list of dimension ids
    sizes = data["size"]
    labels = data["dimension"]
    values = data["value"]          # dict of str-index → float

    # Build index arrays for each dimension
    index_arrays = []
    for dim, size in zip(dims, sizes):
        cats = labels[dim]["category"]
        # "index" maps code → position; invert to position → code
        pos_to_code = {v: k for k, v in cats["index"].items()}
        index_arrays.append([pos_to_code[i] for i in range(size)])

    # Calculate strides
    strides = []
    s = 1
    for sz in reversed(sizes):
        strides.insert(0, s)
        s *= sz

    rows = []
    total = 1
    for sz in sizes:
        total *= sz

    for flat_idx_str, val in values.items():
        flat_idx = int(flat_idx_str)
        coords = {}
        remainder = flat_idx
        for dim, stride, arr in zip(dims, strides, index_arrays):
            pos = remainder // stride
            remainder = remainder % stride
            coords[dim] = arr[pos]
        coords["value"] = val
        rows.append(coords)

    return pd.DataFrame(rows)


def main():
    raw = fetch_json(API_URL)
    df = parse_jsonstat(raw)

    # Column names from the API: geo, indic_de, time, value
    df = df.rename(columns={"indic_de": "indic_code", "time": "year"})
    df["year"] = df["year"].astype(int)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    # Filter to country-level only
    df = df[~df["geo"].isin(EXCLUDE_GEOS)].copy()

    # Keep only the indicators we care about
    df = df[df["indic_code"].isin(INDICATOR_LABELS)].copy()

    # Add human-readable label
    df["indicator"] = df["indic_code"].map(INDICATOR_LABELS)

    # Drop rows with no value
    df = df.dropna(subset=["value"])

    df = df[["geo", "indic_code", "indicator", "year", "value"]].sort_values(
        ["geo", "indic_code", "year"]
    )

    # Coverage report
    print("\n--- Coverage: countries per indicator per year (sample) ---")
    pivot = df.groupby(["indic_code", "year"])["geo"].count().unstack("year")
    sample_years = [y for y in [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2024]
                    if y in pivot.columns]
    print(pivot[sample_years].to_string())
    print(f"\nTotal rows: {len(df)}")
    print(f"Countries:  {df['geo'].nunique()} — {sorted(df['geo'].unique())}")
    print(f"Years:      {df['year'].min()} – {df['year'].max()}")

    OUT.parent.mkdir(exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"\nSaved → {OUT}")


if __name__ == "__main__":
    main()
