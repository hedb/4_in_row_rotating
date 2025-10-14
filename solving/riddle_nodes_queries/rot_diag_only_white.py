"""
Riddle Query: Rotation-diagonal-only win for White (single winning move)

Definition:
- It's White to move (even number of stones on the board)
- Exactly one outgoing move of type 'M_R_W' leads to a node labeled 'Board_W_D_W'
- There are no other White winning moves of any kind from this state
  (i.e. no edges to 'Board_W_W' and no non-rotation edges to 'Board_W_D_W').

Expected interface (used by fetch_riddle_states.py):
- Export QUERY_ID: str
- Export QUERY_DESCRIPTION: str
- Export CSV_COLUMNS: list[str]
- Export function run(graph) -> list[dict]

Where graph is a simple dict with:
  graph['nodes_by_id'][id] -> node dict {id, stones_no, label, board}
  graph['edges_by_source'][id] -> list of edge dicts

This module performs pure in-memory filtering on graph.json content.
"""

from __future__ import annotations

from typing import Dict, List, Iterable
import json


QUERY_ID: str = "rot_diag_only_white"
QUERY_DESCRIPTION: str = (
    "White to move; exactly one rotation move (M_R_W) wins diagonally (Board_W_D_W); "
    "no other White winning moves available"
)

# Ordered columns for the produced CSV
CSV_COLUMNS: List[str] = [
    # requested order begins with query_id, board, winning_move_column, ...
    "query_id",
    "board",  # JSON array string
    "winning_move_column",
    "rotation_number",
    # remaining useful fields
    "state_id",
    "stones",
    "label",
    "winning_move_type",
    "winning_target_id",
    "winning_target_label",
    "num_total_white_moves",
    "num_rot_diag_wins",
]


def _is_white_to_move(stones_no: int) -> bool:
    # White moves on even stone counts (W starts the game)
    return (stones_no % 2) == 0


def run(graph: Dict) -> List[Dict]:
    nodes_by_id: Dict[int, Dict] = graph["nodes_by_id"]
    edges_by_source: Dict[int, List[Dict]] = graph["edges_by_source"]

    results: List[Dict] = []

    for node_id, node in nodes_by_id.items():
        stones = int(node.get("stones_no", 0))
        if not _is_white_to_move(stones):
            continue

        outgoing: List[Dict] = edges_by_source.get(node_id, [])
        if not outgoing:
            continue

        # Consider only White moves out of this node
        white_moves: List[Dict] = [e for e in outgoing if e.get("player") == "W"]
        if not white_moves:
            continue

        # Count winning move categories
        rot_diag_wins: List[Dict] = []
        other_wins: int = 0

        for e in white_moves:
            rel_type = e.get("relationship_type")
            target = nodes_by_id.get(int(e.get("target")))
            if not target:
                continue
            tgt_label: str = target.get("label", "")

            if rel_type == "M_R_W" and tgt_label == "Board_W_D_W":
                rot_diag_wins.append(e)
                continue

            # Any other White win from this state disqualifies it
            if tgt_label in ("Board_W_W", "Board_W_D_W"):
                other_wins += 1

        if len(rot_diag_wins) != 1:
            continue
        if other_wins != 0:
            continue

        winning_edge = rot_diag_wins[0]
        winning_target = nodes_by_id.get(int(winning_edge.get("target")))

        # CSV row
        results.append({
            "query_id": QUERY_ID,
            "board": json.dumps(node.get("board", [])),
            "winning_move_column": winning_edge.get("column"),
            "rotation_number": (stones % 3) + 1,
            "state_id": node_id,
            "stones": stones,
            "label": node.get("label"),
            "winning_move_type": winning_edge.get("relationship_type"),
            "winning_target_id": int(winning_edge.get("target")),
            "winning_target_label": winning_target.get("label") if winning_target else None,
            "num_total_white_moves": len(white_moves),
            "num_rot_diag_wins": len(rot_diag_wins),
        })

    return results


