"""Create a portable Studio evidence packet from an authored model and text files.

Python 3.11+ and Node.js 22+ are required. No third-party Python modules, network
calls, repository discovery, or import-time writes. See contracts/atlas-input-v1.md.
"""
from __future__ import annotations

import argparse
import copy
from dataclasses import dataclass
import hashlib
import json
import logging
import math
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
from typing import Any

JSON = dict[str, Any]
MAX_JSON_BYTES = 20 * 1024 * 1024
MAX_SOURCE_BYTES = 5 * 1024 * 1024
MAX_TOTAL_SOURCE_BYTES = 64 * 1024 * 1024
SAFE_INTEGER = 2**53 - 1
LOGGER = logging.getLogger("archify_studio.package")


def _unique_members(pairs: list[tuple[str, Any]]) -> JSON:
    result: JSON = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("JSON contains a duplicate object member")
        result[key] = value
    return result


def _number(value: str) -> int | float:
    result = float(value) if any(c in value for c in ".eE") else int(value)
    if (isinstance(result, int) and abs(result) > SAFE_INTEGER) or (isinstance(result, float) and
            (not math.isfinite(result) or (result.is_integer() and abs(result) > SAFE_INTEGER))):
        raise ValueError("JSON number exceeds the interoperability profile")
    return result


def _invalid_constant(_value: str) -> None:
    raise ValueError("JSON contains a nonfinite constant")


def _check_json_profile(value: Any) -> None:
    """Inspect the original tree, including fields normalization will discard."""
    pending = [(value, 0)]
    while pending:
        item, parent_depth = pending.pop()
        if isinstance(item, (dict, list)):
            depth = parent_depth + 1
            if depth > 128:
                raise ValueError("JSON nesting exceeds 128 levels")
            if isinstance(item, dict):
                for key, child in item.items():
                    if not isinstance(key, str):
                        raise ValueError("JSON object member name must be text")
                    key.encode("utf-8", errors="strict")
                    pending.append((child, depth))
            else:
                pending.extend((child, depth) for child in item)
        elif isinstance(item, str):
            item.encode("utf-8", errors="strict")
        elif isinstance(item, bool) or item is None:
            continue
        elif isinstance(item, int):
            if abs(item) > SAFE_INTEGER:
                raise ValueError("JSON integer exceeds the interoperability profile")
        elif isinstance(item, float):
            if not math.isfinite(item) or (item.is_integer() and abs(item) > SAFE_INTEGER):
                raise ValueError("JSON number exceeds the interoperability profile")
        else:
            raise ValueError("Unsupported JSON value type")


def read_json(path: Path) -> JSON:
    with path.open("rb") as stream:
        raw = stream.read(MAX_JSON_BYTES + 1)
    if len(raw) > MAX_JSON_BYTES:
        raise ValueError("Model JSON exceeds 20 MiB")
    try:
        result = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_unique_members,
                            parse_constant=_invalid_constant, parse_int=_number, parse_float=_number)
    except (UnicodeError, RecursionError) as exc:
        raise ValueError("Model is not bounded UTF-8 JSON") from exc
    if not isinstance(result, dict):
        raise ValueError("Model must be a JSON object")
    _check_json_profile(result)
    return result


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def _records(value: Any, name: str, limit: int) -> list[JSON]:
    if not isinstance(value, list) or len(value) > limit or any(not isinstance(v, dict) for v in value):
        raise ValueError(f"Invalid {name} collection")
    return value


def _relative_path(value: Any) -> str:
    if not isinstance(value, str) or not value or ":" in value or "\x00" in value:
        raise ValueError("Source path must be a relative file path")
    path = PurePosixPath(value.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts or str(path) == ".":
        raise ValueError("Source path escapes the declared source root")
    return str(path)


@dataclass(frozen=True)
class Snapshot:
    identifier: str
    relative: str
    repository: str
    content: bytes
    text: str

    @property
    def digest(self) -> str:
        return hashlib.sha256(self.content).hexdigest()

    @property
    def raw_path(self) -> str:
        return "sources/" + hashlib.sha256(self.identifier.encode("utf-8")).hexdigest() + ".txt"

    def record(self, include_text: bool = False) -> JSON:
        result: JSON = {"id": self.identifier, "path": self.relative, "repo": self.repository,
                        "scope": "snapshot", "revision": None, "sha256": self.digest,
                        "bytes": len(self.content), "lines": len(self.text.split("\n")),
                        "raw": self.raw_path, "href": self.raw_path}
        if include_text:
            result["text"] = self.text
        return result


def _capture_sources(model: JSON, source_root: Path) -> dict[str, Snapshot]:
    root = source_root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Source root must be a directory")
    result: dict[str, Snapshot] = {}
    total = 0
    for source in _records(model.get("sources"), "sources", 5000):
        identifier = source.get("id")
        if not isinstance(identifier, str) or not identifier.strip() or identifier in result:
            raise ValueError("Source IDs must be unique nonempty strings")
        relative = _relative_path(source.get("path"))
        if source.get("scope") not in (None, "snapshot") or source.get("revision") is not None:
            raise ValueError("This packager creates snapshots; it does not certify Git provenance")
        target = (root / relative).resolve(strict=True)
        if not target.is_relative_to(root) or not target.is_file():
            raise ValueError("Source is not a regular file inside the declared root")
        with target.open("rb") as stream:
            content = stream.read(MAX_SOURCE_BYTES + 1)
        total += len(content)
        if len(content) > MAX_SOURCE_BYTES or total > MAX_TOTAL_SOURCE_BYTES:
            raise ValueError("Source byte limit exceeded")
        try:
            decoded = content.decode("utf-8")
        except UnicodeError as exc:
            raise ValueError("Source is not valid UTF-8 text") from exc
        repository = source.get("repo", "authored source")
        if not isinstance(repository, str):
            raise ValueError("Source repository label must be text")
        snapshot = Snapshot(identifier, relative, repository, content, decoded)
        if source.get("sha256") not in (None, snapshot.digest):
            raise ValueError("Declared source digest does not match current bytes")
        result[identifier] = snapshot
    return result


def _bind_references(value: Any, sources: dict[str, Snapshot]) -> list[JSON]:
    result = []
    for reference in _records(value if value is not None else [], "references", 1000):
        source = sources.get(reference.get("source"))
        if source is None:
            raise ValueError("Reference has no declared source")
        record = source.record()
        for key in ("path", "repo", "scope", "sha256"):
            if key in reference and reference[key] != record[key]:
                raise ValueError(f"Reference {key} disagrees with captured source")
        result.append({**reference, **{key: record[key] for key in ("path", "repo", "scope", "sha256")},
                       "href": record["href"] + "#L" + str(reference.get("line", ""))})
    return result


def build_packet(model: JSON, source_root: Path, node: str = "node") -> dict[str, bytes]:
    if not isinstance(model, dict):
        raise ValueError("Model must be an object")
    _check_json_profile(model)
    data = copy.deepcopy(model)
    snapshots = _capture_sources(data, source_root)
    data["sources"] = [s.record(include_text=True) for s in snapshots.values()]
    for route in _records(data.get("routes"), "routes", 100):
        for collection, limit in (("nodes", 500), ("edges", 2000)):
            for item in _records(route.get(collection), collection, limit):
                item["sources"] = _bind_references(item.get("sources"), snapshots)
    for term in _records(data.get("terms", []), "terms", 30000):
        term["references"] = _bind_references(term.get("references"), snapshots)
    data.setdefault("terms", [])
    # One shared model authority: avoid a second Python interpretation of node,
    # relationship and line-bound semantics. No caller-controlled shell code.
    gate = Path(__file__).resolve().parents[1] / "validate-model.mjs"
    result = subprocess.run([node, str(gate), "-"], input=_json_bytes(data), capture_output=True,
                            timeout=30, check=False)
    if result.returncode:
        raise ValueError("Studio model validation failed: " + result.stderr.decode("utf-8", errors="replace").strip())
    try:
        validation = json.loads(result.stdout)
    except (ValueError, UnicodeError) as exc:
        raise ValueError("Node validator returned no valid receipt") from exc
    if not isinstance(validation, dict) or validation.get("status") != "pass" or validation.get("contract") != "studio-atlas-v1" or validation.get("routes") != len(data["routes"]) or validation.get("sources") != len(data["sources"]):
        raise ValueError("Node validator returned an inconsistent receipt")
    files: dict[str, bytes] = {snapshot.raw_path: snapshot.content for snapshot in snapshots.values()}
    data["sources"] = [s.record() for s in snapshots.values()]
    kinds = {"frontend", "backend", "database", "cloud", "security", "messagebus", "external"}
    for route in data["routes"]:
        filename = "candidates/" + hashlib.sha256(route["id"].encode("utf-8")).hexdigest() + ".json"
        candidate: JSON = {
            "schema_version": 1, "diagram_type": "architecture",
            "meta": {"title": route["title"], "output": "diagram.html"},
            "components": [{"id": n["id"], "label": n["label"],
                            "type": n.get("kind") if n.get("kind") in kinds else "backend",
                            "sublabel": n.get("sublabel", n.get("kind", "Component")),
                            "pos": [n["x"], n["y"]], "size": [n["width"], n["height"]]}
                           for n in route["nodes"]],
            "connections": [{**{key: e[key] for key in ("id", "from", "to", "label", "via", "route", "fromSide", "toSide", "channelX", "channelY", "labelAt") if key in e},
                             "variant": "dashed" if e["status"] in ("unresolved", "failed") else "default"}
                            for e in route["edges"]],
        }
        route["candidate"] = filename
        route["provenance"] = "Hash-pinned source snapshots; no Git or runtime claim"
        files[filename] = _json_bytes(candidate)
    files["atlas-data.json"] = _json_bytes(data)
    receipt = {"contract": "studio-atlas-v1", "validation": "model and source integrity only",
               "files": {name: hashlib.sha256(content).hexdigest() for name, content in sorted(files.items())}}
    files["packet-manifest.json"] = _json_bytes(receipt)
    if any(len(content) > MAX_JSON_BYTES for name, content in files.items() if name.endswith(".json")):
        raise ValueError("Generated packet JSON exceeds the Studio import limit of 20 MiB")
    return files


def publish_packet(files: dict[str, bytes], output: Path) -> str:
    if "atlas-data.json" not in files or "packet-manifest.json" not in files:
        raise ValueError("Packet is missing its index or manifest")
    for name, content in files.items():
        if _relative_path(name) != name or not isinstance(content, bytes):
            raise ValueError("Invalid packet entry")
    output = output.parent.resolve() / output.name
    if output.exists():
        if not output.is_dir() or output.resolve() != output:
            raise ValueError("Refusing a non-directory or redirected output destination")
        existing: dict[str, bytes] = {}
        for candidate in output.rglob("*"):
            if candidate.resolve() != candidate:
                raise ValueError("Refusing a linked output entry")
            if candidate.is_file():
                name = candidate.relative_to(output).as_posix()
                if name not in files or candidate.stat().st_size != len(files[name]):
                    raise ValueError("Existing packet differs; choose a new output directory")
                existing[name] = candidate.read_bytes()
        if existing == files:
            return "unchanged"
        raise ValueError("Existing packet differs; choose a new output directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir()  # Exclusive ownership: never overwrite an existing directory.
    for name, contents in sorted(files.items()):
        if name == "atlas-data.json":
            continue
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("xb") as stream:
            stream.write(contents)
    # The importer-visible index is the commit marker, published only after all
    # referenced bytes exist. Failed new packets stay visible for diagnosis.
    pending = output / ".atlas-data.pending"
    with pending.open("xb") as stream:
        stream.write(files["atlas-data.json"])
    os.replace(pending, output / "atlas-data.json")
    return "created"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--node", default="node", help="Node.js executable; passed as one argument, never a shell command")
    args = parser.parse_args()
    try:
        packet = build_packet(read_json(args.model), args.source_root, args.node)
        status = publish_packet(packet, args.out)
        sys.stdout.write(json.dumps({"status": status, "contract": "studio-atlas-v1", "files": len(packet),
                                     "atlas_sha256": hashlib.sha256(packet["atlas-data.json"]).hexdigest()}) + "\n")
        return 0
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        LOGGER.error("Packet generation failed: %s", exc)
        return 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    raise SystemExit(main())
