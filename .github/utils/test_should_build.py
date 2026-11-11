import contextlib
import io
import tempfile
import unittest
from pathlib import Path

import should_build


class ShouldBuildTests(unittest.TestCase):
    def test_unchanged_depot_and_no_release_skips(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act1/act1.md", "2026-11-10")

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T19:17:29Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T19:30:00Z"),
            )

            self.assertFalse(build)

    def test_changed_depot_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act1/act1.md", "2026-11-10")

            build, reason = should_build.decide(
                "abc1234",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T19:17:29Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T19:30:00Z"),
            )

            self.assertTrue(build)
            self.assertIn("9e9af1b", reason)

    def test_release_after_last_build_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            # published: 2026-11-12 is midnight Manila, or 2026-11-11T16:00Z.
            self._write_material(materials, "course-a/act15/act15.md", "2026-11-12")

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T14:10:51Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T16:12:00Z"),
            )

            self.assertTrue(build)

    def test_release_exactly_at_last_build_skips(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act15/act15.md", "2026-11-12")

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T16:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T17:00:00Z"),
            )

            self.assertFalse(build)

    def test_release_exactly_at_now_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act15/act15.md", "2026-11-12")

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T14:10:51Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T16:00:00Z"),
            )

            self.assertTrue(build)

    def test_future_release_skips(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/ps4/ps4.md", "2026-11-13")

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T19:17:29Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-12T12:00:00Z"),
            )

            self.assertFalse(build)

    def test_draft_release_does_not_build(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act15/act15.md", "2026-11-12", draft=True)

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T14:10:51Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T16:12:00Z"),
            )

            self.assertFalse(build)

    def test_any_stale_branch_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act1/act1.md", "2026-11-10")

            build, reason = should_build.decide(
                "9e9af1b",
                [
                    self._deployed("netlify-pages", "9e9af1b", "2026-11-11T19:17:29Z"),
                    self._deployed("gh-pages", "oldc0de", "2026-11-11T19:17:29Z"),
                ],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T19:30:00Z"),
            )

            self.assertTrue(build)
            self.assertIn("gh-pages", reason)

    def test_metadata_without_depot_commit_builds(self):
        with tempfile.TemporaryDirectory() as materials, tempfile.TemporaryDirectory() as metadata:
            self._write_material(materials, "course-a/act1/act1.md", "2026-11-10")
            path = Path(metadata, "netlify-pages.txt")
            path.write_text("Build Time: 2026-11-11T19:17:29Z\n", encoding="utf-8")

            build, _ = should_build.decide(
                "9e9af1b",
                [should_build.read_deployed("netlify-pages", str(path))],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T19:30:00Z"),
            )

            self.assertTrue(build)

    def test_missing_metadata_file_builds(self):
        with tempfile.TemporaryDirectory() as materials, tempfile.TemporaryDirectory() as metadata:
            self._write_material(materials, "course-a/act1/act1.md", "2026-11-10")

            build, _ = should_build.decide(
                "9e9af1b",
                [should_build.read_deployed("netlify-pages", str(Path(metadata, "missing.txt")))],
                materials,
                should_build.generate_feed.parse_date("2026-11-11T19:30:00Z"),
            )

            self.assertTrue(build)

    def test_metadata_round_trip(self):
        with tempfile.TemporaryDirectory() as metadata:
            path = Path(metadata, "gh-pages.txt")
            path.write_text(
                "Build Time: 2026-11-11T19:17:29Z\nDepot Commit: 9e9af1bb63\n",
                encoding="utf-8",
            )

            deployed = should_build.read_deployed("gh-pages", str(path))

            self.assertEqual("gh-pages", deployed.name)
            self.assertEqual("9e9af1bb63", deployed.depot_sha)
            self.assertEqual(
                should_build.generate_feed.parse_date("2026-11-11T19:17:29Z"),
                deployed.build_time,
            )

    def test_cli_prints_build_false(self):
        with tempfile.TemporaryDirectory() as materials, tempfile.TemporaryDirectory() as metadata:
            self._write_material(materials, "course-a/act1/act1.md", "2026-11-10")
            path = Path(metadata, "netlify-pages.txt")
            path.write_text(
                "Build Time: 2026-11-11T19:17:29Z\nDepot Commit: 9e9af1b\n",
                encoding="utf-8",
            )

            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                should_build.main(
                    [
                        "--materials-dir", materials,
                        "--depot-sha", "9e9af1b",
                        "--deployed", f"netlify-pages={path}",
                        "--now", "2026-11-11T19:30:00Z",
                    ]
                )

            self.assertEqual("build=false\n", stdout.getvalue())

    @staticmethod
    def _write_material(materials: str, relative: str, published: str, draft: bool = False) -> None:
        path = Path(materials, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        draft_line = "isDraft: true\n" if draft else ""
        path.write_text(
            f"---\ntitle: Test\npublished: {published}\n{draft_line}---\nBody\n",
            encoding="utf-8",
        )

    @staticmethod
    def _deployed(name: str, depot_sha: str, build_time: str) -> should_build.Deployed:
        return should_build.Deployed(
            name, depot_sha, should_build.generate_feed.parse_date(build_time)
        )


if __name__ == "__main__":
    unittest.main()
