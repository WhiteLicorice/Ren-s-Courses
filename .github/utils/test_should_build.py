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

    def test_release_during_day_after_midnight_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "course-a/act15/act15.md",
                "2026-11-12T14:00:00Z",
            )

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T16:00:01Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-12T14:00:00Z"),
            )

            self.assertTrue(build)

    def test_case_insensitive_published_release_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            path = Path(materials, "course-a/act15/act15.md")
            path.parent.mkdir(parents=True)
            path.write_text(
                "---\ntitle: Test\nPublished: 2026-11-12T14:00:00Z\n---\nBody\n",
                encoding="utf-8",
            )

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T16:00:01Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-12T14:00:00Z"),
            )

            self.assertTrue(build)

    def test_capital_draft_key_does_not_build_for_daytime_release(self):
        with tempfile.TemporaryDirectory() as materials:
            path = Path(materials, "course-a/act15/act15.md")
            path.parent.mkdir(parents=True)
            path.write_text(
                "---\ntitle: Test\nPublished: 2026-11-12T14:00:00Z\nIsDraft: true\n---\nBody\n",
                encoding="utf-8",
            )

            build, _ = should_build.decide(
                "9e9af1b",
                [self._deployed("netlify-pages", "9e9af1b", "2026-11-11T16:00:01Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-12T15:00:00Z"),
            )

            self.assertFalse(build)

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
                should_build.generate_feed.parse_date("2026-11-11T15:12:00Z"),
            )

            self.assertFalse(build)

    def test_ps3_deadline_pht_midnight_builds_after_last_build(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "cmsc-124/ps3.md",
                "2026-10-29",
                deadline="2026-11-12",
            )

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-12T05:40:03Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-16T02:49:50Z"),
            )

            self.assertTrue(build)

    def test_act15_deadline_pht_midnight_builds_after_last_build(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "cmsc-124/act15.md",
                "2026-11-12",
                deadline="2026-11-15",
            )

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-12T05:40:03Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-16T02:49:50Z"),
            )

            self.assertTrue(build)

    def test_deadline_day_midnight_builds_due_today_badge(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "course-a/ps3.md",
                "2026-10-29",
                deadline="2026-11-20",
            )

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-19T05:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-20T02:00:00Z"),
            )

            self.assertTrue(build)

    def test_term_end_midnight_builds_empty_pages_and_feed(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "course-a/no-deadline.md",
                "2026-10-29",
                no_deadline=True,
            )

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-12-30T05:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2027-01-01T01:00:00Z"),
            )

            self.assertTrue(build)

    def test_next_calendar_day_midnight_builds(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "course-a/no-deadline.md",
                "2026-10-29",
                no_deadline=True,
            )

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-18T05:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-19T02:00:00Z"),
            )

            self.assertTrue(build)

    def test_build_after_last_pht_midnight_does_not_repeat(self):
        with tempfile.TemporaryDirectory() as materials:
            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-20T01:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-20T02:00:00Z"),
            )

            self.assertFalse(build)

    def test_same_day_rerun_does_not_build_again(self):
        with tempfile.TemporaryDirectory() as materials:
            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-19T16:00:10Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-19T17:00:00Z"),
            )

            self.assertFalse(build)

    def test_deadline_pht_midnight_builds_due_today_and_does_not_repeat(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "course-a/act1.md",
                "2026-10-29",
                deadline="2026-11-12",
            )
            deployed = [self._deployed("gh-pages", "a6c8c96", "2026-11-12T05:40:03Z")]

            before_expiry, _ = should_build.decide(
                "a6c8c96",
                deployed,
                materials,
                should_build.generate_feed.parse_date("2026-11-12T15:59:59Z"),
            )
            at_expiry, _ = should_build.decide(
                "a6c8c96",
                deployed,
                materials,
                should_build.generate_feed.parse_date("2026-11-12T16:00:00Z"),
            )
            after_expiry_build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-12T16:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-12T17:00:00Z"),
            )

            self.assertFalse(before_expiry)
            self.assertTrue(at_expiry)
            self.assertFalse(after_expiry_build)

    def test_default_deadline_pht_midnight_builds_after_last_build(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(materials, "course-a/act1.md", "2026-01-31")

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-02-28T15:59:59Z")],
                materials,
                should_build.generate_feed.parse_date("2026-02-28T16:00:00Z"),
            )

            self.assertTrue(build)

    def test_draft_and_no_deadline_materials_still_trigger_daily_build(self):
        with tempfile.TemporaryDirectory() as materials:
            self._write_material(
                materials,
                "course-a/draft.md",
                "2026-10-29",
                deadline="2026-11-12",
                draft=True,
            )
            self._write_material(
                materials,
                "course-a/no-deadline.md",
                "2026-10-29",
                deadline="2026-11-12",
                no_deadline=True,
            )

            build, _ = should_build.decide(
                "a6c8c96",
                [self._deployed("gh-pages", "a6c8c96", "2026-11-18T05:00:00Z")],
                materials,
                should_build.generate_feed.parse_date("2026-11-19T02:00:00Z"),
            )

            self.assertTrue(build)

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
    def _write_material(
        materials: str,
        relative: str,
        published: str,
        draft: bool = False,
        deadline=None,
        no_deadline: bool = False,
    ) -> None:
        path = Path(materials, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        draft_line = "isDraft: true\n" if draft else ""
        deadline_line = f"deadline: {deadline}\n" if deadline else ""
        no_deadline_line = "noDeadline: true\n" if no_deadline else ""
        path.write_text(
            f"---\ntitle: Test\npublished: {published}\n{deadline_line}{draft_line}{no_deadline_line}---\nBody\n",
            encoding="utf-8",
        )

    @staticmethod
    def _deployed(name: str, depot_sha: str, build_time: str) -> should_build.Deployed:
        return should_build.Deployed(
            name, depot_sha, should_build.generate_feed.parse_date(build_time)
        )


if __name__ == "__main__":
    unittest.main()
