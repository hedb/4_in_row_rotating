#!/usr/bin/env python3

"""
Fetch riddle candidate states from solving/output/graph.json using modular
query definitions under solving/riddle_nodes_queries/ and write results to
CSV files in solving/output with a human-readable timestamp.

Usage:
  python3 solving/fetch_riddle_states.py [--query rot_diag_only_white]

If --query is omitted, all queries in the package are executed.
"""

from __future__ import annotations

import argparse
import csv
import importlib
import json
import os
import sys
from datetime import datetime
from typing import Dict, List


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLVING_DIR = os.path.join(REPO_ROOT, "solving")
OUTPUT_DIR = os.path.join(SOLVING_DIR, "output")
GRAPH_JSON_PATH = os.path.join(OUTPUT_DIR, "graph.json")
QUERIES_PKG = "solving.riddle_nodes_queries"

# Ensure the repository root is importable so that 'solving.*' can be imported
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


def load_graph(graph_json_path: str) -> Dict:
    if not os.path.exists(graph_json_path):
        raise FileNotFoundError(f"graph.json not found at {graph_json_path}. Generate it via generate_states.py")
    with open(graph_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Build fast indices
    nodes_by_id: Dict[int, Dict] = {}
    for n in data.get("nodes", []):
        nodes_by_id[int(n["id"])] = n

    edges_by_source: Dict[int, List[Dict]] = {}
    for e in data.get("edges", []):
        src = int(e["source"])  # normalize to int
        edges_by_source.setdefault(src, []).append(e)

    return {
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
        "nodes_by_id": nodes_by_id,
        "edges_by_source": edges_by_source,
    }


def human_timestamp() -> str:
    # Example: 2025-10-14_21-08-03
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def discover_queries() -> List[str]:
    pkg_path = os.path.join(SOLVING_DIR, "riddle_nodes_queries")
    if not os.path.isdir(pkg_path):
        return []
    query_modules: List[str] = []
    for fname in os.listdir(pkg_path):
        if not fname.endswith(".py"):
            continue
        if fname.startswith("__"):
            continue
        mod_name = f"{QUERIES_PKG}.{fname[:-3]}"
        query_modules.append(mod_name)
    query_modules.sort()
    return query_modules


def run_query_module(mod_name: str, graph: Dict) -> Dict:
    mod = importlib.import_module(mod_name)
    if not hasattr(mod, "run"):
        raise RuntimeError(f"Query module {mod_name} missing run(graph) function")
    results: List[Dict] = mod.run(graph)
    meta = {
        "id": getattr(mod, "QUERY_ID", os.path.basename(mod_name)),
        "description": getattr(mod, "QUERY_DESCRIPTION", ""),
        "columns": getattr(mod, "CSV_COLUMNS", list(results[0].keys()) if results else []),
        "results": results,
    }
    return meta


def write_csv(query_meta: Dict) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    ts = human_timestamp()
    csv_name = f"riddles__{query_meta['id']}__{ts}.csv"
    csv_path = os.path.join(OUTPUT_DIR, csv_name)

    rows: List[Dict] = query_meta["results"]
    columns: List[str] = query_meta["columns"]

    # If the module didn't provide columns, infer from first row
    if not columns and rows:
        columns = list(rows[0].keys())

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    return csv_path


def write_combined_csv(all_query_metas: List[Dict]) -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    ts = human_timestamp()
    csv_name = f"riddles__combined__{ts}.csv"
    csv_path = os.path.join(OUTPUT_DIR, csv_name)

    # Determine superset of columns but enforce requested leading order
    rows: List[Dict] = []
    for qm in all_query_metas:
        rows.extend(qm["results"])

    # Requested leading columns
    leading = ["query_id", "board", "winning_move_column"]

    # Collect all other keys present across rows
    other_keys: List[str] = []
    seen = set(leading)
    for r in rows:
        for k in r.keys():
            if k not in seen:
                seen.add(k)
                other_keys.append(k)

    columns = leading + other_keys

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    return csv_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch riddle candidate states from graph.json")
    parser.add_argument("--query", dest="query", help="Specific query module name (without package), e.g. rot_diag_only_white", default=None)
    args = parser.parse_args()

    graph = load_graph(GRAPH_JSON_PATH)

    modules: List[str]
    if args.query:
        modules = [f"{QUERIES_PKG}.{args.query}"]
    else:
        modules = discover_queries()
        if not modules:
            print(f"No query modules found under {os.path.join(SOLVING_DIR, 'riddle_nodes_queries')}")
            sys.exit(1)

    metas: List[Dict] = []
    for mod_name in modules:
        meta = run_query_module(mod_name, graph)
        csv_path = write_csv(meta)
        metas.append(meta)
        print(f"[riddles] Query '{meta['id']}' → {len(meta['results'])} rows → {csv_path}")

    # Combined export across all queries with requested column order
    combined_csv = write_combined_csv(metas)
    print(f"[riddles] Combined CSV → {combined_csv}")


if __name__ == "__main__":
    main()


