"""Decide whether a scheduled or dispatched run needs a full site build.

fastcron calls the workflow hourly. A full build takes about two minutes and
rewrites both deploy branches, so a run with nothing to publish must exit
cheaply. A build is needed when either deploy branch was built from a
different depot commit, a material became visible, or a Philippine midnight
passed after that branch was built.

Mirrors CourseContentProvider: a non-draft material is visible when its
`published` instant is no later than the build time. A date-only value is
midnight Philippine time.
"""

import argparse
import datetime
import os
import sys
from glob import glob
from pathlib import Path
from typing import NamedTuple, Optional

import frontmatter

import generate_feed


class Deployed(NamedTuple):
    name: str
    depot_sha: Optional[str]
    build_time: Optional[datetime.datetime]


def read_deployed(name: str, path: str) -> Deployed:
    """Read one branch's build-metadata.txt. A missing file yields None fields."""
    try:
        text = Path(path).read_text(encoding="utf-8")
    except OSError:
        print(f"[gate] No build metadata for {name}.", file=sys.stderr)
        return Deployed(name, None, None)

    depot_sha = None
    build_time = None
    for line in text.splitlines():
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()
        if key == "build time":
            build_time = generate_feed.parse_date(value)
        elif key == "depot commit":
            depot_sha = value

    if depot_sha is None or build_time is None:
        print(f"[gate] {name} metadata lacks a build time or depot commit.", file=sys.stderr)
    return Deployed(name, depot_sha, build_time)


def release_due(
    materials_dir: str, after: datetime.datetime, now: datetime.datetime
) -> Optional[str]:
    """Return the first non-draft material that releases in (after, now]."""
    for filepath in glob(os.path.join(materials_dir, "**", "*.md"), recursive=True):
        try:
            with open(filepath, "r", encoding="utf-8") as handle:
                metadata = frontmatter.load(handle).metadata or {}
        except Exception as exc:
            print(f"[gate] Cannot read {filepath}: {exc}", file=sys.stderr)
            continue

        raw_published = next(
            (value for key, value in metadata.items() if str(key).lower() == "published"),
            None,
        )
        if raw_published is None:
            continue
        if generate_feed.is_draft(metadata):
            continue

        published = generate_feed.parse_date(raw_published)
        if published is None:
            continue
        if after < published <= now:
            return f"{filepath} released at {published.isoformat()}"
    return None


def next_pht_midnight(after: datetime.datetime) -> datetime.datetime:
    """Return the first Philippine midnight after an aware instant."""
    local_after = after.astimezone(generate_feed.LMS_TZ)
    next_local_date = local_after.date() + datetime.timedelta(days=1)
    next_local_midnight = datetime.datetime.combine(
        next_local_date,
        datetime.time.min,
        tzinfo=generate_feed.LMS_TZ,
    )
    return next_local_midnight.astimezone(datetime.timezone.utc)


def decide(
    depot_sha: str,
    deployed: list,
    materials_dir: str,
    now: datetime.datetime,
):
    """Return (build, reason) for stale targets, releases, or passed PHT midnights."""
    if not deployed:
        return True, "no deployed branch metadata was read"

    for target in deployed:
        if target.depot_sha is None or target.build_time is None:
            return True, f"{target.name} has no usable build metadata"
        if target.depot_sha != depot_sha:
            return True, f"{target.name} was built from {target.depot_sha}, depot is {depot_sha}"

        due = release_due(materials_dir, target.build_time, now)
        if due:
            return True, f"{target.name} was built before {due}"

        midnight = next_pht_midnight(target.build_time)
        if midnight <= now:
            return True, f"{target.name} was built before PHT midnight {midnight.isoformat()}"

    return False, "the depot commit, release set, and PHT day are unchanged"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--materials-dir", required=True)
    parser.add_argument("--depot-sha", required=True)
    parser.add_argument("--deployed", action="append", default=[], metavar="NAME=PATH")
    parser.add_argument("--now", required=True)
    args = parser.parse_args(argv)

    now = generate_feed.parse_date(args.now)
    if now is None:
        raise SystemExit(f"Invalid --now value: {args.now}")

    deployed = []
    for raw in args.deployed:
        name, separator, path = raw.partition("=")
        if not separator:
            raise SystemExit(f"--deployed needs NAME=PATH, got: {raw}")
        deployed.append(read_deployed(name, path))

    build, reason = decide(args.depot_sha, deployed, args.materials_dir, now)
    print(f"[gate] {reason}", file=sys.stderr)
    print(f"build={'true' if build else 'false'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
