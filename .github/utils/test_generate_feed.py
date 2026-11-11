import datetime
import json
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
  - fixture-course-a
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
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")

            self.assertIn("Last Day Post", feed_xml)
            self.assertIn("Latest course materials and announcements.", feed_xml)

    def test_term_end_boundary_is_inclusive_for_full_day(self):
        now = generate_feed.parse_date("2026-05-25T23:20:01Z")
        end = generate_feed.parse_date("2026-05-26") + datetime.timedelta(days=1)

        self.assertLess(now, end)

    def test_exact_term_end_boundary_writes_empty_feed(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._run_generate_feed(
                content_dir,
                output_dir,
                static_gen_time="2026-05-26T16:00:00Z",  # exactly midnight PHT of day-after-term-end
                term_start="2026-01-19",
                term_end="2026-05-26",
            )

            feed_path = Path(output_dir, "feed.xml")
            self.assertTrue(feed_path.exists())
            self.assertIn("No current materials", feed_path.read_text(encoding="utf-8"))

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

    def test_active_course_post_outside_term_window_excluded(self):
        # Parity with the site: posts outside the term window are not
        # published at all, even for active courses.
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "carry-over-post.md",
                """---
title: Carry Over Post
published: 2025-08-24
tags:
  - fixture-course-a
lead: Old material of an active course is not published.
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
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")
            self.assertNotIn("Carry Over Post", feed_xml)
            self.assertNotIn("<item>", feed_xml)

    def test_inactive_course_post_excluded_from_feed(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "inactive-post.md",
                """---
title: Inactive Course Post
published: 2026-05-20
tags:
  - fixture-course-c
lead: Hidden from the site, so hidden from the feed.
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
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")
            self.assertNotIn("Inactive Course Post", feed_xml)
            self.assertNotIn("<item>", feed_xml)

    def test_untagged_post_in_term_window_included(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "untagged-post.md",
                """---
title: Untagged In-Window Post
published: 2026-05-20
lead: Untagged posts keep the term-window rule.
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
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")
            self.assertIn("Untagged In-Window Post", feed_xml)

    def test_untagged_post_outside_term_window_excluded(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            self._write_post(
                content_dir,
                "old-untagged-post.md",
                """---
title: Old Untagged Post
published: 2025-08-24
lead: Untagged posts keep the term-window rule.
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
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")
            self.assertNotIn("Old Untagged Post", feed_xml)

    def test_nested_material_is_included_with_its_flat_article_link(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            nested = Path(content_dir, "fixture-course-a", "fixture-lab-nested")
            nested.mkdir(parents=True)
            (nested / "fixture-course-a-lab-nested.md").write_text(
                """---
title: Nested Material
published: 2026-05-20
tags:
  - fixture-course-a
lead: A material inside course and material folders.
---
Body
""",
                encoding="utf-8",
            )

            self._run_generate_feed(
                content_dir,
                output_dir,
                static_gen_time="2026-05-25T23:20:01Z",
                term_start="2026-01-19",
                term_end="2026-05-26",
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")

            self.assertIn("Nested Material", feed_xml)
            self.assertIn(
                "<link>https://renscourses.netlify.app/articles/fixture-course-a-lab-nested</link>",
                feed_xml,
            )

    def test_nested_index_material_links_to_its_folder_name(self):
        with tempfile.TemporaryDirectory() as content_dir, tempfile.TemporaryDirectory() as output_dir:
            nested = Path(content_dir, "fixture-course-a", "fixture-lab-index")
            nested.mkdir(parents=True)
            (nested / "index.md").write_text(
                """---
title: Nested Index Material
published: 2026-05-20
tags:
  - fixture-course-a
lead: An index file inside course and material folders.
---
Body
""",
                encoding="utf-8",
            )

            self._run_generate_feed(
                content_dir,
                output_dir,
                static_gen_time="2026-05-25T23:20:01Z",
                term_start="2026-01-19",
                term_end="2026-05-26",
                active_courses="fixture-course-a",
            )

            feed_xml = Path(output_dir, "feed.xml").read_text(encoding="utf-8")

            self.assertIn("Nested Index Material", feed_xml)
            self.assertIn(
                "<link>https://renscourses.netlify.app/articles/fixture-lab-index</link>",
                feed_xml,
            )

    def test_article_slug_matches_the_shared_material_table(self):
        table = json.loads(
            (Path(__file__).resolve().parents[2]
             / "tests" / "fixtures" / "material-slugs.json").read_text(encoding="utf-8")
        )

        with tempfile.TemporaryDirectory() as content_dir:
            for raw, expected in table.items():
                path = Path(content_dir, raw + ".md")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("---\ntitle: Test\n---\n", encoding="utf-8")

                with mock.patch.object(generate_feed, "CONTENT_DIR", content_dir):
                    self.assertEqual(expected, generate_feed.article_slug(str(path)), raw)

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
        active_courses: str = "",
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
                     "ACTIVE_COURSES": active_courses,
                 },
                 clear=False,
             ):
            generate_feed.generate_feed()


if __name__ == "__main__":
    unittest.main()
