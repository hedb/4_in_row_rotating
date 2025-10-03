



#!/usr/bin/env python3

"""
Generate all unique board states after exactly 3 moves followed by a single
90° counter-clockwise rotation and gravity settle, for a 6x6 grid.

Rules modeled after the web app:
- Players alternate: move 1 = White (W), move 2 = Black (B), move 3 = White (W)
- A move is selecting a column; the stone falls to the lowest empty row
- After 3 moves, rotate the board 90° counter-clockwise and apply gravity

Outputs are written to solving/output/ as:
- states.txt: All unique states, each as 6 lines of 6 chars, separated by a blank line
- state_XXXX.txt: One file per unique state (zero-padded index)

Notation:
  '_' for empty, 'W' for White (player 1), 'B' for Black (player 2)
"""

from __future__ import annotations

import os
from typing import List, Tuple, Iterable, Set, Dict
import uuid
import json


GRID_SIZE: int = 6
EMPTY: int = 0
WHITE: int = 1
BLACK: int = 2


def ensure_output_dir(base: str) -> str:
    out_dir = os.path.join(base, "output")
    os.makedirs(out_dir, exist_ok=True)
    return out_dir


class Board:
    def __init__(self, size: int = GRID_SIZE) -> None:
        self.size: int = size
        self.grid: List[List[int]] = [[EMPTY for _ in range(size)] for _ in range(size)]

    def clone(self) -> "Board":
        b = Board(self.size)
        b.grid = [row[:] for row in self.grid]
        return b

    def drop_stone(self, column: int, player: int) -> bool:
        """Drop a stone in the given column for player. Return False if column full."""
        if column < 0 or column >= self.size:
            return False
        for row in range(self.size - 1, -1, -1):
            if self.grid[row][column] == EMPTY:
                self.grid[row][column] = player
                return True
        return False

    def rotate_ccw(self) -> None:
        """Rotate the grid 90 degrees counter-clockwise (in-place)."""
        n = self.size
        new_grid: List[List[int]] = [[EMPTY for _ in range(n)] for _ in range(n)]
        for r in range(n):
            for c in range(n):
                new_grid[n - c - 1][r] = self.grid[r][c]
        self.grid = new_grid

    def apply_gravity(self) -> None:
        """Let stones fall down in each column to the lowest available rows."""
        n = self.size
        for c in range(n):
            # Collect non-empty cells in this column from bottom to top
            stack: List[int] = []
            for r in range(n - 1, -1, -1):
                val = self.grid[r][c]
                if val != EMPTY:
                    stack.append(val)
            # Refill column bottom-up
            idx = 0
            for r in range(n - 1, -1, -1):
                if idx < len(stack):
                    self.grid[r][c] = stack[idx]
                    idx += 1
                else:
                    self.grid[r][c] = EMPTY

    def to_ascii_lines(self) -> List[str]:
        def sym(v: int) -> str:
            if v == EMPTY:
                return "_"
            if v == WHITE:
                return "W"
            return "B"

        return ["".join(sym(v) for v in row) for row in self.grid]

    def to_hashable(self) -> Tuple[Tuple[int, ...], ...]:
        return tuple(tuple(row) for row in self.grid)


def all_sequences(columns: int, length: int) -> Iterable[Tuple[int, ...]]:
    """Yield all sequences of given length with values in range(columns)."""
    if length == 0:
        yield tuple()
        return
    # Iterative product to avoid recursion depth concerns (length is tiny anyway)
    seq = [0] * length
    while True:
        yield tuple(seq)
        # Increment like odometer
        i = length - 1
        while i >= 0 and seq[i] == columns - 1:
            seq[i] = 0
            i -= 1
        if i < 0:
            break
        seq[i] += 1


def generate_states_after_3_moves_rotated() -> List[List[str]]:
    unique: Set[Tuple[Tuple[int, ...], ...]] = set()
    ordered: List[List[str]] = []

    for seq in all_sequences(columns=GRID_SIZE, length=3):
        board = Board(GRID_SIZE)
        # Move order: W, B, W
        players = (WHITE, BLACK, WHITE)
        valid = True
        for move_idx, col in enumerate(seq):
            if not board.drop_stone(col, players[move_idx]):
                valid = False
                break
        if not valid:
            continue

        # After 3 moves, rotate + gravity
        board.rotate_ccw()
        board.apply_gravity()

        key = board.to_hashable()
        if key not in unique:
            unique.add(key)
            ordered.append(board.to_ascii_lines())

    return ordered


def build_state_graph_depth3(base_dir: str) -> Tuple[Dict[Tuple[Tuple[int, ...], ...], Tuple[int, str]], List[Tuple[int, int, int]], List[Tuple[Tuple[int, ...], ...]]]:
    """
    Build a graph of all states encountered from empty by applying all 6^3
    sequences of columns (W,B,W) with gravity each move and a rotation+gravity
    after the 3rd move. Assign incrementing numeric IDs in order of first
    encounter, along with a 36-char UUID string per state.

    Returns:
        state_index: { state_key -> (numeric_id, uuid_str) }
        transitions: [ (src_numeric_id, column_1_to_6, dst_numeric_id) ]
    """
    # Helpers
    def register(board: Board) -> Tuple[int, str]:
        key = board.to_hashable()
        if key in state_index:
            return state_index[key]
        nonlocal next_id
        numeric_id = next_id
        next_id += 1
        uid = str(uuid.uuid4())  # 36 chars including hyphens
        state_index[key] = (numeric_id, uid)
        order.append(key)
        return state_index[key]

    # Init containers
    state_index: Dict[Tuple[Tuple[int, ...], ...], Tuple[int, str]] = {}
    transitions: List[Tuple[int, int, int]] = []
    order: List[Tuple[Tuple[int, ...], ...]] = []
    next_id: int = 1

    # Register initial empty state
    start = Board(GRID_SIZE)
    register(start)

    players = (WHITE, BLACK, WHITE)

    for seq in all_sequences(columns=GRID_SIZE, length=3):
        cur = start.clone()
        src_id, _ = register(cur)
        # Step through moves, emit transitions per move
        for idx, col in enumerate(seq):
            moved = cur.clone()
            if not moved.drop_stone(col, players[idx]):
                # invalid move, stop this path
                break
            # On 3rd move (idx=2), rotate then gravity
            if idx == 2:
                moved.rotate_ccw()
                moved.apply_gravity()
            dst_id, _ = register(moved)
            # Column recorded 1..6
            transitions.append((src_id, col + 1, dst_id))
            # Advance
            cur = moved
            src_id = dst_id

    return state_index, transitions, order


def write_outputs(base_dir: str, states: List[List[str]]) -> None:
    """Deprecated: We now emit only graph.json via write_state_graph_json."""
    ensure_output_dir(base_dir)


def stones_count_from_key(key: Tuple[Tuple[int, ...], ...]) -> int:
    return sum(1 for row in key for v in row if v != EMPTY)


def serialize_board_from_key(key: Tuple[Tuple[int, ...], ...]) -> List[str]:
    def sym(v: int) -> str:
        if v == EMPTY:
            return "_"
        if v == WHITE:
            return "W"
        return "B"
    return ["".join(sym(v) for v in row) for row in key]


def write_state_graph_json(base_dir: str,
                           state_index: Dict[Tuple[Tuple[int, ...], ...], Tuple[int, str]],
                           order: List[Tuple[Tuple[int, ...], ...]],
                           transitions: List[Tuple[int, int, int]]) -> str:
    out_dir = ensure_output_dir(base_dir)
    path = os.path.join(out_dir, 'graph.json')

    # Build node list with properties: id (numeric), board (array of 6 strings), stones_no, label
    nodes = []
    for key in order:
        nid, _uid = state_index[key]
        stones = stones_count_from_key(key)
        nodes.append({
            "id": nid,
            "board": serialize_board_from_key(key),
            "stones_no": stones,
            "label": f"Board_{stones}",
        })

    # Build edge list: source, column, target, relationship_type
    edges = []
    for src, col, dst in transitions:
        # Determine relationship type based on move sequence
        # All transitions in our 3-move sequences end with rotation, so use M_R_W or M_R_B
        # We need to determine which player made the move that led to this transition
        # For simplicity, we'll use M_R_W for all since our sequences are W,B,W
        edges.append({
            "source": src,
            "column": col,
            "target": dst,
            "relationship_type": "M_R_W",  # All our transitions include rotation
        })

    payload = {"nodes": nodes, "edges": edges}
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    return path


def main() -> None:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    print("[gen] Generating unique final states after 3 moves + rotation...")
    states = generate_states_after_3_moves_rotated()
    # Legacy emit removed; we only keep graph.json now
    ensure_output_dir(base_dir)
    print(f"[gen] Output directory ensured: {os.path.join(base_dir, 'output')}")

    # Build state graph and transitions from empty across depth-3 sequences
    print("[gen] Building state graph and transitions for depth-3 sequences...")
    state_index, transitions, order = build_state_graph_depth3(base_dir)
    print(f"[gen] Encountered states: {len(state_index)} | Transitions: {len(transitions)}")

    # Write unified JSON graph (nodes + edges)
    graph_json_path = write_state_graph_json(base_dir, state_index, order, transitions)
    print(f"[gen] Wrote unified graph JSON: {graph_json_path}")

    # Optionally load into Neo4j if password is provided via env var
    pwd = os.environ.get('LOCAL_NEO4J_PASSWORD')
    graph_json = os.path.join(base_dir, 'output', 'graph.json')
    if pwd:
        uri = 'bolt://localhost:7687'
        user = 'neo4j'
        print(f"[neo4j] Password env var found. Loading graph JSON from {graph_json}")
        print(f"[neo4j] Connecting to {uri} as '{user}'...")
        try:
            load_graph_json_to_neo4j(uri=uri, user=user, password=pwd, graph_json_path=graph_json)
        except Exception as e:
            print(f"[neo4j] Load failed: {e}")
    else:
        print("[neo4j] LOCAL_NEO4J_PASSWORD not set. Skipping Neo4j load.")


# -------------------------------
# Optional: Neo4j loader utility
# -------------------------------
def load_transitions_to_neo4j(uri: str, user: str, password: str, transitions_csv_path: str) -> None:
    """
    Load transitions from a CSV file into Neo4j.

    CSV format (no header):
        src_numeric_id, column_1_to_6, dst_numeric_id

    This function will:
    - Ensure a unique constraint on :State(id)
    - MERGE nodes (:State {id}) for source and destination
    - MERGE relationships (src)-[:MOVE {column}]->(dst)

    Usage example:
        load_transitions_to_neo4j(
            uri="bolt://localhost:7687",
            user="neo4j",
            password="password",
            transitions_csv_path="/absolute/path/to/solving/output/transitions.csv",
        )
    """
    # Import here to avoid requiring the driver when not used
    try:
        from neo4j import GraphDatabase
    except Exception as e:
        raise RuntimeError(
            "neo4j Python driver not installed. Install with 'pip install neo4j'"
        ) from e

    # Read transitions
    rows: List[dict] = []
    with open(transitions_csv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) != 3:
                continue
            try:
                src = int(parts[0])
                col = int(parts[1])
                dst = int(parts[2])
            except ValueError:
                continue
            rows.append({"src": src, "col": col, "dst": dst})

    if not rows:
        print("[neo4j] No transitions found to load.")
        return

    print(f"[neo4j] Read {len(rows)} transitions from CSV.")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    try:
        with driver.session() as session:
            # Purge database
            print("[neo4j] Deleting all nodes and relationships...")
            session.run("MATCH (n) DETACH DELETE n")
            # Create constraint with modern syntax (Neo4j 4.4+/5.x), fallback to legacy
            print("[neo4j] Ensuring unique constraint on :State(id)...")
            try:
                session.run(
                    "CREATE CONSTRAINT state_id_unique IF NOT EXISTS FOR (s:State) REQUIRE s.id IS UNIQUE"
                )
                print("[neo4j] Constraint ensured (modern syntax).")
            except Exception as e1:
                print(f"[neo4j] Modern constraint syntax failed, trying legacy... ({e1})")
                try:
                    session.run("CREATE CONSTRAINT ON (s:State) ASSERT s.id IS UNIQUE")
                    print("[neo4j] Constraint ensured (legacy syntax).")
                except Exception as e2:
                    print(f"[neo4j] Failed to ensure constraint with both syntaxes: {e2}")

            cypher = (
                "UNWIND $rows AS row "
                "MERGE (src:State {id: row.src}) "
                "MERGE (dst:State {id: row.dst}) "
                "MERGE (src)-[:MOVE {column: row.col}]->(dst)"
            )
            print("[neo4j] Writing transitions (this may take a moment)...")
            session.run(cypher, rows=rows)
        print(f"[neo4j] Loaded {len(rows)} transitions into Neo4j.")
    finally:
        driver.close()


def load_graph_json_to_neo4j(uri: str, user: str, password: str, graph_json_path: str) -> None:
    """
    Load graph.json (nodes + edges) into Neo4j with properties:
      - Nodes labeled :State with props {id, stones_no, board}
      - Relationships :MOVE with prop {column}
    """
    try:
        from neo4j import GraphDatabase
    except Exception as e:
        raise RuntimeError(
            "neo4j Python driver not installed. Install with 'pip install neo4j'"
        ) from e

    with open(graph_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes = data.get('nodes', [])
    edges = data.get('edges', [])
    print(f"[neo4j] Read graph JSON: {len(nodes)} nodes, {len(edges)} edges")

    driver = GraphDatabase.driver(uri, auth=(user, password))
    try:
        with driver.session() as session:
            # Purge database
            print("[neo4j] Deleting all nodes and relationships...")
            session.run("MATCH (n) DETACH DELETE n")
            # Ensure unique constraint
            print("[neo4j] Ensuring unique constraint on :State(id)...")
            try:
                session.run(
                    "CREATE CONSTRAINT state_id_unique IF NOT EXISTS FOR (s:State) REQUIRE s.id IS UNIQUE"
                )
                print("[neo4j] Constraint ensured (modern syntax).")
            except Exception as e1:
                print(f"[neo4j] Modern constraint syntax failed, trying legacy... ({e1})")
                try:
                    session.run("CREATE CONSTRAINT ON (s:State) ASSERT s.id IS UNIQUE")
                    print("[neo4j] Constraint ensured (legacy syntax).")
                except Exception as e2:
                    print(f"[neo4j] Failed to ensure constraint with both syntaxes: {e2}")

            # Write nodes with dynamic labels (without APOC)
            print("[neo4j] Writing nodes with Board_X labels...")
            for node in nodes:
                # Create node with dynamic label by constructing the cypher dynamically
                label = node["label"]
                session.run(
                    f"MERGE (s:{label} {{id: $id}}) SET s.stones_no = $stones_no, s.board = $board",
                    id=node["id"], stones_no=node["stones_no"], board=node["board"]
                )

            # Write edges with dynamic relationship types (without APOC)
            print("[neo4j] Writing relationships with dynamic types...")
            for edge in edges:
                # Create relationship with dynamic type by constructing the cypher dynamically
                rel_type = edge["relationship_type"]
                session.run(
                    f"MATCH (src {{id: $source}}) MATCH (dst {{id: $target}}) "
                    f"MERGE (src)-[r:{rel_type} {{column: $column}}]->(dst)",
                    source=edge["source"], target=edge["target"], column=edge["column"]
                )

        print("[neo4j] Graph JSON load completed.")
    finally:
        driver.close()


if __name__ == "__main__":
    main()

