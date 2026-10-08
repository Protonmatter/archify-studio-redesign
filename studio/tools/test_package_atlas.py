"""Regression tests for the reusable Python evidence packager."""
from __future__ import annotations

import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from package_atlas import build_packet, publish_packet, read_json


class PacketTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="studio-python-")
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "evidence.md").write_bytes(b"First line.\r\nSecond line.\r\n")
        self.model = {
            "schemaVersion": 1, "title": "Example", "demonstration": True,
            "sources": [{"id": "source", "path": "evidence.md", "repo": "example"}],
            "terms": [{"term": "ExampleSymbol", "references": [{"source": "source", "line": 2}]}],
            "routes": [{"id": "example", "title": "Example diagram", "group": "EXAMPLES", "summary": "Authored example.",
                        "nodes": [{"id": "a", "label": "First", "kind": "backend", "status": "documented", "symbols": [], "sources": [{"source": "source", "line": 1, "end_line": 2}], "x": 40, "y": 80, "width": 220, "height": 90}],
                        "edges": [], "unknowns": []}],
        }

    def tearDown(self) -> None:
        self.assertEqual(self.root.parent.resolve(), Path(tempfile.gettempdir()).resolve())
        self.temp.cleanup()

    def test_deterministic_packet_and_exact_bytes(self) -> None:
        packet = build_packet(self.model, self.source)
        self.assertEqual(packet, build_packet(self.model, self.source))
        atlas = json.loads(packet["atlas-data.json"])
        snapshot = atlas["sources"][0]
        self.assertEqual(packet[snapshot["raw"]], (self.source / "evidence.md").read_bytes())
        self.assertEqual(snapshot["scope"], "snapshot")
        self.assertEqual(atlas["routes"][0]["nodes"][0]["sources"][0]["sha256"], snapshot["sha256"])
        self.assertEqual(atlas["terms"][0]["references"][0]["line"], 2)

    def test_publication_is_idempotent_and_refuses_changed_destination(self) -> None:
        packet = build_packet(self.model, self.source)
        destination = self.root / "packet"
        self.assertEqual(publish_packet(packet, destination), "created")
        before = {p.relative_to(destination).as_posix(): p.read_bytes() for p in destination.rglob("*") if p.is_file()}
        self.assertEqual(publish_packet(packet, destination), "unchanged")
        (destination / "unrelated.txt").write_text("preserve", encoding="utf-8")
        with self.assertRaises(ValueError):
            publish_packet(packet, destination)
        self.assertEqual((destination / "unrelated.txt").read_text(), "preserve")
        for path, contents in before.items():
            self.assertEqual((destination / path).read_bytes(), contents)

    def test_input_path_escape_and_false_provenance_fail(self) -> None:
        for change in (lambda d: d["sources"][0].update(path="../outside.md"),
                       lambda d: d["sources"][0].update(scope="committed"),
                       lambda d: d["routes"][0]["nodes"][0]["sources"][0].update(path="wrong.md"),
                       lambda d: d["routes"][0]["nodes"][0]["sources"][0].update(sha256="0" * 64)):
            data = copy.deepcopy(self.model)
            change(data)
            with self.assertRaises(ValueError):
                build_packet(data, self.source)

    def test_duplicate_json_names_and_invalid_utf8_fail(self) -> None:
        p = self.root / "bad.json"
        for content in (b'{"x":1,"x":2}', b'{"x":NaN}', b'"\xc0\xaf"'):
            p.write_bytes(content)
            with self.assertRaises(ValueError):
                read_json(p)

    def test_invalid_lines_and_dangling_edges_fail_before_output(self) -> None:
        for change in (lambda d: d["routes"][0]["nodes"][0]["sources"][0].update(line=999, end_line=1000),
                       lambda d: d["routes"][0]["edges"].append({"id": "bad", "from": "a", "to": "missing", "label": "bad", "status": "documented"})):
            data = copy.deepcopy(self.model)
            change(data)
            with self.assertRaises(ValueError):
                build_packet(data, self.source)

    def test_relationship_transport_passes_through_and_is_validated(self) -> None:
        data = copy.deepcopy(self.model)
        data["routes"][0]["nodes"].append({"id": "b", "label": "Second", "kind": "backend", "status": "documented", "symbols": [], "sources": [], "x": 400, "y": 80, "width": 220, "height": 90})
        data["routes"][0]["edges"].append({"id": "call", "from": "a", "to": "b", "label": "Control", "status": "documented",
                                             "transport": {"mechanism": "IOCTL", "call": "DeviceIoControl(IOCTL_EXAMPLE)", "attributes": [{"name": "Access", "value": "FILE_ANY_ACCESS"}]}})
        atlas = json.loads(build_packet(data, self.source)["atlas-data.json"])
        self.assertEqual(atlas["routes"][0]["edges"][0]["transport"]["call"], "DeviceIoControl(IOCTL_EXAMPLE)")
        data["routes"][0]["edges"][0]["transport"] = {"port": 70000}
        with self.assertRaises(ValueError):
            build_packet(data, self.source)

    def test_python_packet_is_accepted_by_real_studio_builder(self) -> None:
        packet = build_packet(self.model, self.source)
        destination = self.root / "packet"
        publish_packet(packet, destination)
        repo = Path(__file__).resolve().parents[2]
        output = self.root / "output.html"
        result = subprocess.run(["node", str(repo / "studio/build.mjs"), "--atlas", str(destination), "--out", str(output)], capture_output=True, text=True, encoding="utf-8", timeout=30, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        content = output.read_text(encoding="utf-8")
        self.assertIn('"group":"EXAMPLES"', content)
        self.assertIn('"demonstration":true', content)
        self.assertIn("First line.", content)

    def test_profile_checks_original_ignored_values_and_keys(self) -> None:
        p = self.root / "profile.json"
        for unused in ("\ud800", "\udfff"):
            data = copy.deepcopy(self.model)
            data["sources"][0]["unused"] = unused
            p.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaises(ValueError):
                read_json(p)
            data = copy.deepcopy(self.model)
            data["sources"][0][unused] = "value"
            p.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaises(ValueError):
                read_json(p)
        p.write_text('{"unused":' + '[' * 128 + '0' + ']' * 128 + '}', encoding="utf-8")
        with self.assertRaises(ValueError):
            read_json(p)
        p.write_text('{"unused":' + '[' * 127 + '0' + ']' * 127 + ',"valid":"\\ud83d\\udd0e"}', encoding="utf-8")
        self.assertEqual(read_json(p)["valid"], "🔎")

    def test_enriched_packet_cannot_exceed_import_file_limit(self) -> None:
        repo = Path(__file__).resolve().parents[2]
        model = read_json(repo / "studio/examples/atlas-model.json")
        model["terms"] = [{"term": f"term-{i}", "references": [{"source": "reference", "line": line} for line in (4, 5, 6)]} for i in range(18000)]
        self.assertLess(len(json.dumps(model).encode("utf-8")), 20 * 1024 * 1024)
        with self.assertRaisesRegex(ValueError, "20 MiB"):
            build_packet(model, repo / "studio/examples")
        self.assertFalse((self.root / "never-published").exists())

    def test_publication_rejects_escaping_packet_entries_before_writes(self) -> None:
        packet = build_packet(self.model, self.source)
        packet["../escaped.txt"] = b"not written"
        destination = self.root / "new-packet"
        with self.assertRaises(ValueError):
            publish_packet(packet, destination)
        self.assertFalse(destination.exists())
        self.assertFalse((self.root / "escaped.txt").exists())


if __name__ == "__main__":
    unittest.main()
