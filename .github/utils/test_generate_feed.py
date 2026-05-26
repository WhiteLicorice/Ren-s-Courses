import datetime
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import generate_feed


class GenerateFeedTests(unittest.TestCase):
    def test_parse_date_date_only_uses_midnight_pht(self):
        parsed = generate_feed.parse_date("2026-05-26")

        self.assertEqual(
            datetime.datetime(2026, 5, 25, 16, 0, tzinfo=datetime.timezone.utc),
            parsed,
        )

    def test_parse_date_z_suffix_stays_utc(self):
        parsed = generate_feed.parse_date("2026-05-25T23:20:01Z")

        self.assertEqual(
            datetime.datetime(2026, 5, 25, 23, 20, 1, tzinfo=datetime.timezone.utc),
            parsed,
        )

    def test_last_day_of_term_still_generates_posts(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "last-day-post.md",
                """---
title: Last Day Post
subtitle: Boundary check
published: 2026-05-25
tags:
  - cmsc-124
lead: Still visible on the last day.
---
Body
""",
            )

            self._run_generate_feed(
                content_dir,
                output_dir,
                static_gen_time="2026-05-25T23:20:01Z",
                term_start="2026-01-19",
                term_end="2026-05-26",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")

            self.assertIn("Last Day Post", feed_xml)
            self.assertIn("Latest course materials and announcements.", feed_xml)

    def test_term_end_boundary_is_inclusive_for_full_day(self):
        now = generate_feed.parse_date("2026-05-25T23:20:01Z")
        end = generate_feed.parse_date("2026-05-26") + datetime.timedelta(days=1)

        self.assertLess(now, end)

    def test_term_ended_writes_empty_feed(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "archived-post.md",
                """---
title: Archived Post
published: 2026-05-20
lead: Past post.
---
Body
""",
            )

            self._run_generate_feed(
                content_dir,
                output_dir,
                static_gen_time="2026-05-27T01:00:00Z",
                term_start="2026-01-19",
                term_end="2026-05-26",
            )

            feed_path = Path(output_dir, "feed.xml")
            self.assertTrue(feed_path.exists())

            feed_xml = feed_path.read_text(encoding="utf-8")
            self.assertIn("No current materials. The term has ended.", feed_xml)
            self.assertNotIn("<item>", feed_xml)

    def test_showcase_mode_skips_feed_generation(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "showcase-post.md",
                """---
title: Showcase Post
published: 2026-05-20
lead: Hidden from RSS in showcase mode.
---
Body
""",
            )

            self._run_generate_feed(
                content_dir,
                output_dir,
                static_gen_time="2026-05-20T01:00:00Z",
                term_start="2026-01-19",
                term_end="2026-05-26",
                showcase_mode="true",
            )

            self.assertFalse(Path(output_dir, "feed.xml").exists())
            self.assertEqual([], list(Path(output_dir).glob("feed*.xml")))

    @staticmethod
    def _write_post(content_dir: str, file_name: str, content: str) -> None:
        Path(content_dir, file_name).write_text(content, encoding="utf-8")

    def _run_generate_feed(
        self,
        content_dir: str,
        output_dir: str,
        *,
        static_gen_time: str,
        term_start: str,
        term_end: str,
        showcase_mode: str = "false",
    ) -> None:
        with mock.patch.object(generate_feed, "CONTENT_DIR", content_dir), \
             mock.patch.object(generate_feed, "OUTPUT_DIR", output_dir), \
             mock.patch.dict(
                 os.environ,
                 {
                     "STATIC_GEN_TIME": static_gen_time,
                     "TERM_START": term_start,
                     "TERM_END": term_end,
                     "SHOWCASE_MODE": showcase_mode,
                 },
                 clear=False,
             ):
            generate_feed.generate_feed()


if __name__ == "__main__":
    unittest.main()
