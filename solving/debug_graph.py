#!/usr/bin/env python3

"""
debug_graph.py

Quick analyzer for solving/output/graph.json to validate counts and detect
unexpected deduplication from Board_3 to Board_4.

Usage:
  python debug_graph.py [path_to_graph_json]

Defaults to: ./output/graph.json (relative to this script directory)
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter, defaultdict
from typing import Dict, List, Tuple, Any


def load_graph_json(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def count_nodes_by_label(nodes: List[Dict]) -> Counter:
    counter = Counter()
    for n in nodes:
        label = n.get("label")
        counter[label] += 1
    return counter


def list_label_mismatches(nodes: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """Return two lists:
    - stones4_not_board4: nodes with stones_no==4 but label != 'Board_4'
    - board4_not_stones4: nodes with label=='Board_4' but stones_no != 4
    """
    stones4_not_board4 = []
    board4_not_stones4 = []
    for n in nodes:
        stones_no = n.get("stones_no")
        label = n.get("label")
        if stones_no == 4 and label != "Board_4":
            stones4_not_board4.append(n)
        if label == "Board_4" and stones_no != 4:
            board4_not_stones4.append(n)
    return stones4_not_board4, board4_not_stones4


def analyze_board3_to_board4(nodes: List[Dict], edges: List[Dict]) -> Dict[int, List[Tuple[int, int, str]]]:
    id_to_label = {n.get("id"): n.get("label") for n in nodes}

    board3_ids = [n.get("id") for n in nodes if n.get("label") == "Board_3"]
    board4_ids = set(n.get("id") for n in nodes if n.get("label") == "Board_4")

    # Edges originating from Board_3
    out_edges = [
        e for e in edges
        if e.get("source") in board3_ids and isinstance(e.get("relationship_type"), str)
    ]

    total_out = len(out_edges)
    # Destinations that are Board_4
    out_to_board4 = [e for e in out_edges if id_to_label.get(e.get("target")) == "Board_4"]
    total_out_to_board4 = len(out_to_board4)

    unique_targets = {e.get("target") for e in out_to_board4}
    unique_targets_count = len(unique_targets)

    # Group targets to see collisions (multiple incoming from different sources/columns)
    target_to_sources = defaultdict(list)
    for e in out_to_board4:
        target_to_sources[e.get("target")].append((e.get("source"), e.get("column"), e.get("relationship_type")))

    collisions = {t: lst for t, lst in target_to_sources.items() if len(lst) > 1}

    print("-- Board_3 → Board_4 analysis --")
    print(f"Board_3 nodes: {len(board3_ids)}")
    print(f"Board_4 nodes: {len(board4_ids)}")
    print(f"Edges out of Board_3: {total_out}")
    print(f"Edges from Board_3 to Board_4: {total_out_to_board4}")
    print(f"Unique Board_4 targets reached from Board_3: {unique_targets_count}")

    if collisions:
        print(f"Collisions (Board_4 reached by multiple (source,column)): {len(collisions)}")
        # Show a few examples
        shown = 0
        for tgt, lst in collisions.items():
            if shown >= 10:
                print("… (more collisions omitted)")
                break
            print(f"  target={tgt} reached by:")
            for (src, col, rel) in lst:
                print(f"    source={src}, column={col}, rel={rel}")
            shown += 1
    else:
        print("No collisions detected.")

    return collisions


# ---------------- Deep inspection helpers ----------------

def display_board(lines: List[str]) -> str:
    return "\n".join(lines)


def grid_from_lines(lines: List[str]) -> List[List[str]]:
    return [list(row) for row in lines]


def lines_from_grid(grid: List[List[str]]) -> List[str]:
    return ["".join(row) for row in grid]


def drop_stone(grid: List[List[str]], column_1_based: int, player: str) -> bool:
    col = column_1_based - 1
    n = len(grid)
    stone = 'W' if player == 'W' else 'B'
    for r in range(n - 1, -1, -1):
        if grid[r][col] == '_':
            grid[r][col] = stone
            return True
    return False


def rotate_ccw(grid: List[List[str]]) -> List[List[str]]:
    n = len(grid)
    new_grid = [[ '_' for _ in range(n)] for _ in range(n)]
    for r in range(n):
        for c in range(n):
            new_grid[n - c - 1][r] = grid[r][c]
    return new_grid


def apply_gravity(grid: List[List[str]]) -> None:
    n = len(grid)
    for c in range(n):
        stack: List[str] = []
        for r in range(n - 1, -1, -1):
            if grid[r][c] != '_':
                stack.append(grid[r][c])
        idx = 0
        for r in range(n - 1, -1, -1):
            if idx < len(stack):
                grid[r][c] = stack[idx]
                idx += 1
            else:
                grid[r][c] = '_'


def deep_inspect_collision(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], target_id: int, triples: List[Tuple[int, int, str]]) -> None:
    id_to_node = {n["id"]: n for n in nodes}
    tgt_node = id_to_node.get(target_id)
    if not tgt_node:
        print(f"[deep] Target node {target_id} not found")
        return
    print(f"[deep] Target {target_id} label={tgt_node.get('label')} stones_no={tgt_node.get('stones_no')}")
    print("[deep] Target board:")
    print(display_board(tgt_node.get("board", [])))

    for (src_id, column, rel_type) in triples:
        src_node = id_to_node.get(src_id)
        if not src_node:
            print(f"[deep]  Source {src_id} not found")
            continue
        print(f"\n[deep] From source {src_id} label={src_node.get('label')} via column={column}, rel={rel_type}")
        print("[deep] Source board:")
        print(display_board(src_node.get("board", [])))

        # Find the specific edge to get player/rotation props if present
        edge = next((e for e in edges if e.get("source") == src_id and e.get("target") == target_id and e.get("column") == column), None)
        player = None
        rotation = False
        if edge is not None:
            player = edge.get("player")
            rotation = bool(edge.get("rotation"))
        if not player:
            # Fallback from relationship_type
            player = 'W' if rel_type.endswith('_W') else 'B'

        # Simulate
        grid = grid_from_lines(src_node.get("board", []))
        ok = drop_stone(grid, column, player)
        if not ok:
            print("[deep]  Drop failed (column full?)")
            continue
        if rotation:
            grid = rotate_ccw(grid)
            apply_gravity(grid)

        sim_lines = lines_from_grid(grid)
        print("[deep] Resulting board after sim:")
        print(display_board(sim_lines))
        # Compare with target
        matches = sim_lines == tgt_node.get("board", [])
        print(f"[deep] Matches target: {matches}")


def main() -> None:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_path = os.path.join(base_dir, "output", "graph.json")
    path = sys.argv[1] if len(sys.argv) > 1 else default_path

    if not os.path.isfile(path):
        print(f"graph.json not found at: {path}")
        sys.exit(1)

    data = load_graph_json(path)
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])

    print(f"Loaded nodes={len(nodes)}, edges={len(edges)} from {path}")

    # Node counts by label
    label_counts = count_nodes_by_label(nodes)
    print("\n-- Node counts by label --")
    for label, cnt in sorted(label_counts.items(), key=lambda x: (str(x[0]), x[1])):
        print(f"{label}: {cnt}")

    # Mismatches: stones_no vs label for 4
    stones4_not_board4, board4_not_stones4 = list_label_mismatches(nodes)
    print("\n-- Label/stones_no mismatches for 4 --")
    print(f"stones_no==4 but label!=Board_4: {len(stones4_not_board4)}")
    print(f"label==Board_4 but stones_no!=4: {len(board4_not_stones4)}")

    # Detailed Board_3 -> Board_4 analysis
    print()
    collisions = analyze_board3_to_board4(nodes, edges)
    # Deep inspect first few collisions
    if collisions:
        print("\n-- Deep inspect first collision(s) --")
        inspected = 0
        for tgt, lst in collisions.items():
            deep_inspect_collision(nodes, edges, tgt, lst)
            inspected += 1
            if inspected >= 3:
                break


if __name__ == "__main__":
    main()


