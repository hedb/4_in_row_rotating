#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import random
from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOLVING_DIR = os.path.join(REPO_ROOT, "solving")
OUTPUT_DIR = os.path.join(SOLVING_DIR, "output")


def find_latest_combined_csv(explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    pattern = os.path.join(OUTPUT_DIR, "riddles__combined__*.csv")
    paths = glob.glob(pattern)
    if not paths:
        raise FileNotFoundError(f"No combined CSV files found under {pattern}. Generate it via fetch_riddle_states.py")
    paths.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return paths[0]


def parse_board_str(board_json_str: str) -> List[str]:
    try:
        arr = json.loads(board_json_str)
        if not (isinstance(arr, list) and len(arr) == 6 and all(isinstance(x, str) for x in arr)):
            raise ValueError("board must be a list of 6 strings")
        return arr
    except Exception as e:
        raise ValueError(f"Failed to parse board JSON: {board_json_str!r} ({e})")


def flat_board(board_rows: List[str]) -> str:
    return "".join(board_rows)


def hamming_distance(a: str, b: str) -> int:
    if len(a) != len(b):
        raise ValueError("Hamming distance requires equal-length strings")
    return sum(1 for i in range(len(a)) if a[i] != b[i])


def mirror_board_rows(board_rows: List[str]) -> List[str]:
    # Horizontal mirror: reverse each row string
    return [row[::-1] for row in board_rows]


def date_range(start: date, end: date) -> List[date]:
    if end < start:
        return []
    days: List[date] = []
    d = start
    one = timedelta(days=1)
    while d <= end:
        days.append(d)
        d = d + one
    return days


def load_rows(csv_path: str) -> List[Dict]:
    rows: List[Dict] = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                board_rows = parse_board_str(r["board"])  # JSON array string
            except Exception:
                continue
            # Compute stones from CSV if present, otherwise from board content
            stones_val: int = 0
            try:
                stones_val = int(r.get("stones", "0") or 0)
            except Exception:
                stones_val = 0
            if stones_val <= 0:
                flat = flat_board(board_rows)
                stones_val = sum(1 for ch in flat if ch in ("W", "B"))
            r_parsed = {
                "query_id": r.get("query_id"),
                "board_rows": board_rows,
                "flat": flat_board(board_rows),
                # Always compute rotation from stones: 0→3, 1→2, 2→1
                "rotation_number": 3 - (stones_val % 3),
                # Keep state id for traceability back to the graph
                "state_id": int(r.get("state_id", "0") or 0),
            }
            # Map steps to win from query id
            qid = r_parsed["query_id"]
            if qid == "rot_diag_only_white":
                r_parsed["step_to_win"] = 1
            elif qid == "forced_win_in_two_white":
                r_parsed["step_to_win"] = 2
            else:
                # Unknown query types default to 2
                r_parsed["step_to_win"] = 2
            rows.append(r_parsed)
    return rows


def select_diverse(rows: List[Dict], min_dist: int, seed: int, use_mirror: bool, alternate: bool) -> List[Dict]:
    if not rows:
        return []

    rng = random.Random(seed)

    # Optionally alternate query types: interleave lists
    if alternate:
        by_q: Dict[str, List[Dict]] = {}
        for r in rows:
            by_q.setdefault(r["query_id"], []).append(r)
        # Shuffle deterministically within each bucket
        for lst in by_q.values():
            rng.shuffle(lst)
        keys = sorted(by_q.keys())
        interleaved: List[Dict] = []
        exhausted = False
        idx = 0
        while not exhausted:
            exhausted = True
            for k in keys:
                lst = by_q[k]
                if idx < len(lst):
                    interleaved.append(lst[idx])
                    exhausted = False
            idx += 1
        candidates = interleaved
    else:
        candidates = rows[:]
        rng.shuffle(candidates)

    selected: List[Dict] = []

    def is_far_enough(cand_flat: str, cand_rows: List[str]) -> bool:
        for s in selected:
            if hamming_distance(cand_flat, s["flat"]) < min_dist:
                return False
            if use_mirror:
                mirror_flat = flat_board(mirror_board_rows(s["board_rows"]))
                if hamming_distance(cand_flat, mirror_flat) < min_dist:
                    return False
        return True

    for r in candidates:
        if is_far_enough(r["flat"], r["board_rows"]):
            selected.append(r)

    return selected


def select_with_auto_relax(
    rows: List[Dict],
    needed: int,
    min_dist: int,
    relax_step: int,
    floor: int,
    seed: int,
    use_mirror: bool,
    alternate: bool,
) -> Tuple[List[Dict], int]:
    """Select rows with diversity; if insufficient, relax distance down to floor.

    Returns (selected_rows, final_min_dist).
    """
    d = min_dist
    while d >= floor:
        selected = select_diverse(rows, d, seed, use_mirror, alternate)
        if len(selected) >= needed or d == floor:
            return selected, d
        d = max(floor, d - relax_step)
    return [], d


def reorder_for_adjacency(rows: List[Dict], adj_min_dist: int, use_mirror: bool, seed: int, alternate: bool) -> List[Dict]:
    """Greedy reordering so consecutive items are not too similar.

    If no candidate satisfies the adjacency constraint, pick the farthest.
    If alternate=True, prefer switching query_id when multiple candidates tie.
    """
    if not rows:
        return []
    rng = random.Random(seed)
    remaining = rows[:]
    rng.shuffle(remaining)

    ordered: List[Dict] = [remaining.pop(0)]

    def dist(a: Dict, b: Dict) -> int:
        base = hamming_distance(a["flat"], b["flat"])
        if use_mirror:
            b_mirror_flat = flat_board(mirror_board_rows(b["board_rows"]))
            base = min(base, hamming_distance(a["flat"], b_mirror_flat))
        return base

    while remaining:
        prev = ordered[-1]
        # Candidates that pass adjacency constraint
        ok = [r for r in remaining if dist(prev, r) >= adj_min_dist]
        pick: Optional[Dict] = None
        if ok:
            # Prefer alternating query types if requested
            if alternate:
                alt = [r for r in ok if r["query_id"] != prev["query_id"]]
                if alt:
                    ok = alt
            # Choose one with max distance; if tie, random among best
            maxd = -1
            best: List[Dict] = []
            for r in ok:
                d = dist(prev, r)
                if d > maxd:
                    maxd = d
                    best = [r]
                elif d == maxd:
                    best.append(r)
            pick = rng.choice(best)
        else:
            # No candidate satisfies; pick farthest available
            maxd = -1
            best: List[Dict] = []
            for r in remaining:
                d = dist(prev, r)
                if d > maxd:
                    maxd = d
                    best = [r]
                elif d == maxd:
                    best.append(r)
            pick = rng.choice(best)

        remaining.remove(pick)  # type: ignore[arg-type]
        ordered.append(pick)  # type: ignore[arg-type]

    return ordered


def assign_to_dates(rows: List[Dict], start_s: str, end_s: str) -> Dict[str, Dict]:
    start = date.fromisoformat(start_s)
    end = date.fromisoformat(end_s)
    days = date_range(start, end)
    out: Dict[str, Dict] = {}
    # Truncate to available rows
    take = min(len(days), len(rows))
    for i in range(take):
        d = days[i].isoformat()
        r = rows[i]
        out[d] = {
            "board": r["board_rows"],
            "step_to_win": int(r["step_to_win"]),
            "rotation_counter": int(r["rotation_number"]),
            "state_id": int(r.get("state_id", 0)),
        }
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Turn combined riddles CSV into date-keyed JSON with diversity filter")
    parser.add_argument("--csv", dest="csv_path", help="Path to combined CSV; default = latest in output")
    parser.add_argument("--start", default="2025-09-01")
    parser.add_argument("--end", default="2026-12-31")
    parser.add_argument("--min-dist", type=int, default=8, dest="min_dist")
    parser.add_argument("--mirror", action="store_true", help="Avoid near-duplicates by also comparing mirrored boards")
    parser.add_argument("--alternate", action="store_true", help="Alternate query types when selecting candidates")
    # Auto-relax enabled by default to meet expected behavior
    parser.add_argument("--auto-relax", dest="auto_relax", action="store_true", default=True,
                        help="Automatically relax min-dist until enough boards to fill the date range (default: on)")
    parser.add_argument("--no-auto-relax", dest="auto_relax", action="store_false",
                        help="Disable auto-relax; use fixed --min-dist only")
    parser.add_argument("--relax-step", type=int, default=1, help="Amount to decrease min-dist per relaxation step")
    parser.add_argument("--min-dist-floor", type=int, default=2, help="Lower bound for auto-relax min-dist")
    parser.add_argument("--adjacent-min-dist", type=int, default=6, help="Minimum distance required between adjacent scheduled riddles")
    parser.add_argument("--seed", type=int, default=17)
    args = parser.parse_args()

    csv_path = find_latest_combined_csv(args.csv_path)
    rows = load_rows(csv_path)

    # Determine number of dates to fill
    num_days = len(date_range(date.fromisoformat(args.start), date.fromisoformat(args.end)))

    if args.auto_relax:
        selected, final_d = select_with_auto_relax(
            rows,
            needed=num_days,
            min_dist=args.min_dist,
            relax_step=args.relax_step,
            floor=args.min_dist_floor,
            seed=args.seed,
            use_mirror=args.mirror,
            alternate=args.alternate,
        )
    else:
        selected = select_diverse(rows, min_dist=args.min_dist, seed=args.seed, use_mirror=args.mirror, alternate=args.alternate)

    # Reorder to satisfy adjacency constraint as much as possible
    ordered = reorder_for_adjacency(selected, adj_min_dist=args.adjacent_min_dist, use_mirror=args.mirror, seed=args.seed, alternate=args.alternate)

    schedule = assign_to_dates(ordered, args.start, args.end)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, "riddles_calendar.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(schedule, f, indent=2)
    print(f"[riddles] Wrote {len(schedule)} dates → {out_path}")


if __name__ == "__main__":
    main()


