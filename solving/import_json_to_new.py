#!/usr/bin/env python3

"""
Read solving/output/graph.json, convert to Neo4j-admin CSVs, and (optionally)
invoke neo4j-admin to import into a new database.

Why: Importing via offline CSV is much faster than loading via Cypher online.

Outputs (under --output-dir, default solving/output/neo4j_from_json/):
  - nodes.csv              (id:ID(State), :LABEL, stones_no:INT)
  - rels_000.csv, ...     (:START_ID(State), :END_ID(State), :TYPE=MOVE, column:INT, player:STRING, rotation:BOOLEAN)

Usage examples:
  python3 solving/import_json_to_new.py --graph-json solving/output/graph.json \
    --output-dir solving/output/neo4j_from_json --rels-chunk-size 2000000

Optionally run the offline import (Neo4j 5.x) after CSV creation:
  python3 solving/import_json_to_new.py --graph-json solving/output/graph.json \
    --output-dir solving/output/neo4j_from_json --database states --run-import

Note: This script only prepares data and (optionally) invokes neo4j-admin.
It does not perform any git operations or edit database configs.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
from typing import Dict, Iterable, List, Optional
import sys


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def iter_nodes_edges_from_json(graph_json_path: str) -> Iterable[tuple]:
    """Yield ('node', node_dict) and ('edge', edge_dict) from graph.json.

    If ijson is available, stream arrays to lower memory. Otherwise, load once.
    """
    try:
        import ijson  # type: ignore
        with open(graph_json_path, 'r', encoding='utf-8') as f:
            # Stream nodes
            for node in ijson.items(f, 'nodes.item'):
                yield ('node', node)
        with open(graph_json_path, 'r', encoding='utf-8') as f:
            # Stream edges
            for edge in ijson.items(f, 'edges.item'):
                yield ('edge', edge)
    except Exception:
        # Fallback: standard json load
        with open(graph_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        for n in data.get('nodes', []):
            yield ('node', n)
        for e in data.get('edges', []):
            yield ('edge', e)


def write_csvs_from_json(graph_json_path: str, output_dir: str, rels_chunk_size: int) -> Dict[str, List[str]]:
    ensure_dir(output_dir)
    # Idempotency: remove previous CSVs for a clean run
    try:
        for name in os.listdir(output_dir):
            if name == 'nodes.csv' or name.startswith('rels_') and name.endswith('.csv'):
                try:
                    os.remove(os.path.join(output_dir, name))
                except Exception:
                    pass
    except FileNotFoundError:
        pass
    nodes_path = os.path.join(output_dir, 'nodes.csv')
    rel_idx = 0
    rel_rows_in_current = 0
    rel_path = os.path.join(output_dir, f'rels_{rel_idx:03d}.csv')

    def open_nodes_writer():
        f = open(nodes_path, 'w', encoding='utf-8', newline='')
        w = csv.writer(f)
        w.writerow(["id:ID(State)", ":LABEL", "stones_no:INT"])  # minimal props
        return f, w

    def open_rels_writer(path: str):
        f = open(path, 'w', encoding='utf-8', newline='')
        w = csv.writer(f)
        w.writerow([
            ":START_ID(State)",
            ":END_ID(State)",
            ":TYPE",
            "column:INT",
            "player:STRING",
            "rotation:BOOLEAN",
        ])
        return f, w

    nf, nw = open_nodes_writer()
    rf, rw = open_rels_writer(rel_path)

    try:
        # Write nodes first pass, edges second pass if streaming; otherwise order doesn't matter
        # We accumulate labels/stones from the JSON structure already prepared by generator.
        seen_node_ids: Dict[int, bool] = {}
        rel_files: List[str] = [rel_path]

        # We iterate twice if not streaming; for streaming we rely on the generator order
        # but our iter function yields nodes then edges separately even with ijson.
        for kind, payload in iter_nodes_edges_from_json(graph_json_path):
            if kind == 'node':
                nid = int(payload["id"])  # numeric id
                if nid in seen_node_ids:
                    continue
                stones_no = int(payload.get("stones_no", 0))
                label = payload.get("label", f"Board_{stones_no}")
                nw.writerow([nid, f"State;{label}", stones_no])
                seen_node_ids[nid] = True

        # Second pass for edges. If we used fallback json, we can iterate again quickly; if ijson, we reopen.
        for kind, payload in iter_nodes_edges_from_json(graph_json_path):
            if kind != 'edge':
                continue
            src = int(payload["source"])  # numeric id
            dst = int(payload["target"])  # numeric id
            col = int(payload.get("column", 0))
            player = str(payload.get("player", ""))
            rotation = payload.get("rotation", False)

            if rel_rows_in_current >= rels_chunk_size:
                rf.close()
                rel_idx += 1
                rel_rows_in_current = 0
                rel_path = os.path.join(output_dir, f'rels_{rel_idx:03d}.csv')
                rf, rw = open_rels_writer(rel_path)
                rel_files.append(rel_path)

            rw.writerow([src, dst, "MOVE", col, player, "true" if rotation else "false"])
            rel_rows_in_current += 1

        return {"nodes": [nodes_path], "rels": rel_files}

    finally:
        try:
            nf.close()
        except Exception:
            pass
        try:
            rf.close()
        except Exception:
            pass


def run_neo4j_admin_import(nodes: List[str], rels: List[str], database: str, neo4j_admin_override: Optional[str] = None) -> int:
    neo4j_admin = neo4j_admin_override or shutil.which('neo4j-admin')
    if not neo4j_admin:
        # Signal to caller that the binary is missing
        return -1

    relationships_arg = ",".join(rels)
    cmd = [
        neo4j_admin,
        'database', 'import', 'full',
        database,
        '--id-type=integer',
        '--verbose',
        '--auto-skip-subsequent-headers=true',
        '--overwrite-destination',
        f'--nodes={nodes[0]}',
        f'--relationships={relationships_arg}',
    ]

    print("[neo4j-admin] Running:")
    print(" ".join(cmd))
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(proc.stdout)
    return proc.returncode


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert graph.json to Neo4j-admin CSVs and optionally import")
    parser.add_argument('--graph-json', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output', 'graph.json'), help='Path to graph.json')
    parser.add_argument('--output-dir', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output', 'neo4j_from_json'), help='Directory to write CSVs')
    parser.add_argument('--rels-chunk-size', type=int, default=2_000_000, help='Max relationship rows per CSV file')
    parser.add_argument('--database', default='states', help='Target Neo4j database name for import')
    parser.add_argument('--neo4j-admin', dest='neo4j_admin', default=None, help='Path to neo4j-admin binary (optional)')
    parser.add_argument('--run-import', action='store_true', help='If set, run neo4j-admin import after writing CSVs')

    args = parser.parse_args()

    # If invoked with no arguments, default to performing the import as well
    if len(sys.argv) == 1:
        args.run_import = True

    print(f"[json->csv] graph_json={args.graph_json}")
    print(f"[json->csv] output_dir={args.output_dir}")
    files = write_csvs_from_json(args.graph_json, args.output_dir, args.rels_chunk_size)
    print(f"[json->csv] Wrote: {files['nodes'][0]} and {len(files['rels'])} relationship file(s)")

    print("\n[import] Example import command (Neo4j 5.x):")
    rels_joined = ",".join(files['rels'])
    print(
        "neo4j-admin database import full "
        + args.database
        + " \\\n  --id-type=integer \\\n  --verbose \\\n  --auto-skip-subsequent-headers=true \\\n  --overwrite-destination \\\n  --nodes=\"" + files['nodes'][0] + "\" \\\n  --relationships=\"" + rels_joined + "\"\n"
    )

    if args.run_import:
        print("[neo4j-admin] Starting offline import (will overwrite database if it exists)...")
        rc = run_neo4j_admin_import(nodes=files['nodes'], rels=files['rels'], database=args.database, neo4j_admin_override=args.neo4j_admin)
        if rc == -1:
            print("[neo4j-admin] neo4j-admin not found. Skipping automatic import.")
            print("[neo4j-admin] Tip: add neo4j-admin to your PATH or pass --neo4j-admin /path/to/neo4j-admin")
        elif rc != 0:
            raise SystemExit(rc)
        else:
            print("[neo4j-admin] Import completed.")


if __name__ == '__main__':
    main()


