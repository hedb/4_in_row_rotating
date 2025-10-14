"""
Riddle Query: Forced win in two moves for White (mate-in-2)

Definition:
- White to move.
- There exists at least one White first move W1 such that for every legal
  Black reply B, White has a responding move W2 that results in a win
  (Board_W_W or Board_W_D_W) regardless of Black's choice.

Output rows are per (state, W1 column) that guarantees the forced win.
If multiple W1 columns work from the same state, multiple rows are emitted.

Interface:
- QUERY_ID, QUERY_DESCRIPTION, CSV_COLUMNS
- run(graph) -> list[dict]
"""

from __future__ import annotations

from typing import Dict, List, Set
import json


QUERY_ID: str = "forced_win_in_two_white"
QUERY_DESCRIPTION: str = (
    "White to move; a first move exists such that for every Black reply, "
    "White has a winning response (mate in 2)"
)

CSV_COLUMNS: List[str] = [
    "query_id",
    "board",
    "winning_move_column",  # W1 column that guarantees mate-in-2
    "rotation_number",
    "state_id",
    "stones",
    "label",
    "w1_move_type",
    "num_black_replies",
]


def _is_white_to_move(stones_no: int) -> bool:
    return (stones_no % 2) == 0


def _is_white_win_label(label: str) -> bool:
    return label in ("Board_W_W", "Board_W_D_W")


def run(graph: Dict) -> List[Dict]:
    nodes_by_id: Dict[int, Dict] = graph["nodes_by_id"]
    edges_by_source: Dict[int, List[Dict]] = graph["edges_by_source"]

    results: List[Dict] = []

    for node_id, node in nodes_by_id.items():
        stones = int(node.get("stones_no", 0))
        if not _is_white_to_move(stones):
            continue

        white_first_moves: List[Dict] = [e for e in edges_by_source.get(node_id, []) if e.get("player") == "W"]
        if not white_first_moves:
            continue

        for w1 in white_first_moves:
            after_w1_id = int(w1.get("target"))
            black_replies: List[Dict] = [e for e in edges_by_source.get(after_w1_id, []) if e.get("player") == "B"]

            if not black_replies:
                # If Black has no legal reply, we don't consider this a mate-in-2 pattern
                continue

            all_black_forced = True
            for b in black_replies:
                after_b_id = int(b.get("target"))
                white_responses: List[Dict] = [e for e in edges_by_source.get(after_b_id, []) if e.get("player") == "W"]

                # White must have at least one winning response
                has_winning = False
                for w2 in white_responses:
                    tgt = nodes_by_id.get(int(w2.get("target")))
                    if not tgt:
                        continue
                    if _is_white_win_label(tgt.get("label", "")):
                        has_winning = True
                        break

                if not has_winning:
                    all_black_forced = False
                    break

            if not all_black_forced:
                continue

            results.append({
                "query_id": QUERY_ID,
                "board": json.dumps(node.get("board", [])),
                "winning_move_column": w1.get("column"),
                "rotation_number": (stones % 3) + 1,
                "state_id": node_id,
                "stones": stones,
                "label": node.get("label"),
                "w1_move_type": w1.get("relationship_type"),
                "num_black_replies": len(black_replies),
            })

    return results


