from __future__ import annotations

import os
import re
import json
import datetime
from glob import glob
from typing import TypedDict, List, Optional

CONTENT_DIR: str = "Content/Materials"
OUTPUT_FILE: str = "feed.json"

class PostItem(TypedDict):
    title: str
    url: str
    date: str
    tags: List[str]

def get_current_time() -> datetime.datetime:
    """
        Determines the reference 'now' time.
        Prioritizes the frozen environment variable for deterministic builds.
        Returns a timezone-aware UTC datetime.
    """
    frozen_time_str: Optional[str] = os.environ.get("STATIC_GEN_TIME")
    
    if frozen_time_str:
        try:
            # Parse ISO format (e.g. 2025-12-12T08:00:00Z)
            # We explicitly set timezone to UTC to ensure awareness
            now = datetime.datetime.strptime(frozen_time_str, "%Y-%m-%dT%H:%M:%SZ")
            now = now.replace(tzinfo=datetime.timezone.utc)
            print(f"[FeedGen] Using Frozen Time: {now}")
            return now
        except ValueError:
            print(f"[FeedGen] Error parsing frozen time '{frozen_time_str}'. Defaulting to UTC Now.")
    
    # Fallback to current UTC time
    now = datetime.datetime.now(datetime.timezone.utc)
    print(f"[FeedGen] No frozen time found. Using UTC Now: {now}")
    return now

def parse_date(date_str: str) -> Optional[datetime.datetime]:
    """
        Robustly parses a date string into a timezone-aware datetime object.
        Handles 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SSZ' formats.
    """
    try:
        # Clean string
        clean_date = date_str.strip().replace("Z", "+00:00")
        
        # Attempt ISO parsing
        dt = datetime.datetime.fromisoformat(clean_date)
        
        # Ensure timezone awareness
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
            
        return dt
    except ValueError as e:
        print(f"[FeedGen] Date parse error for '{date_str}': {e}")
        return None

def generate_feed() -> None:
    now = get_current_time()
    posts: List[PostItem] = []

    # Regex patterns optimized for CourseFrontmatter
    # Matches: title: Scanner OR title: "Scanner"
    re_title = re.compile(r'^title:\s*["\']?(.*?)["\']?\s*$', re.MULTILINE | re.IGNORECASE)
    # Matches: published: 2025-08-31
    re_date = re.compile(r'^published:\s*([\d\-\:T\+Z]+)', re.MULTILINE | re.IGNORECASE)
    # Matches: isDraft: true
    re_draft = re.compile(r'^isdraft:\s*(true|false)', re.MULTILINE | re.IGNORECASE)
    # Matches: tags: [cmsc-124, algo] OR tags: [cmsc-124]
    re_tags = re.compile(r'^tags:\s*\[(.*?)\]', re.MULTILINE | re.IGNORECASE)

    if not os.path.exists(CONTENT_DIR):
        print(f"[FeedGen] Error: Content directory '{CONTENT_DIR}' not found.")
        return

    # Scan Markdown Files
    for filepath in glob(os.path.join(CONTENT_DIR, "*.md")):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # 1. Extract Metadata
                title_match = re_title.search(content)
                date_match = re_date.search(content)
                draft_match = re_draft.search(content)
                tags_match = re_tags.search(content)

                # Mandatory field check
                if not date_match: 
                    continue

                # 2. Parse Fields
                title = title_match.group(1).strip() if title_match else "Untitled"
                pub_date_str = date_match.group(1).strip()
                
                is_draft = False
                if draft_match and draft_match.group(1).lower() == 'true':
                    is_draft = True
                
                # Parse Tags
                tags: List[str] = []
                if tags_match:
                    # Split by comma, strip whitespace and quotes
                    raw_tags = tags_match.group(1).split(',')
                    tags = [t.strip().strip("'\"") for t in raw_tags if t.strip()]

                # 3. Date Handling
                pub_date = parse_date(pub_date_str)
                if not pub_date:
                    continue

                # 4. Filtering Logic
                if is_draft:
                    continue
                
                if pub_date > now:
                    # Post is scheduled for future
                    continue 

                # 5. Build URL Slug
                filename = os.path.basename(filepath)
                slug = os.path.splitext(filename)[0]
                url = f"materials/{slug}" 

                posts.append({
                    "title": title,
                    "url": url,
                    "date": pub_date.isoformat(),
                    "tags": tags
                })

        except Exception as e:
            print(f"[FeedGen] Error processing file {filepath}: {e}")
            continue

    # Sort & Save (Newest First)
    posts.sort(key=lambda x: x['date'], reverse=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
    
    print(f"[FeedGen] Success! Generated {OUTPUT_FILE} with {len(posts)} items.")

if __name__ == "__main__":
    generate_feed()