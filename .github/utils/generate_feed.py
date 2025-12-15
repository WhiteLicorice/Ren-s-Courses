import os
import re
import datetime
import html
from glob import glob
from typing import TypedDict, List, Optional

# Configuration
CONTENT_DIR: str = "Content/Materials"
OUTPUT_DIR: str = "." 

# --- SINGLE SOURCE OF TRUTH: TIMEZONE ---
# We define PHT here.
LMS_TZ = datetime.timezone(datetime.timedelta(hours=8))

class PostItem(TypedDict):
    title: str
    subtitle: str
    url: str
    date: datetime.datetime
    abstract: str
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
            # We must set tzinfo to UTC, not PHT.
            now = datetime.datetime.strptime(frozen_time_str, "%Y-%m-%dT%H:%M:%SZ")
            now = now.replace(tzinfo=datetime.timezone.utc)
            
            print(f"[FeedGen] Using Frozen Time (UTC): {now}")
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
        clean_date = date_str.strip().replace("Z", "+00:00")
        
        # 1. Try parsing as full ISO (e.g. 2025-12-13T08:00:00Z)
        try:
            dt = datetime.datetime.fromisoformat(clean_date)
            if dt.tzinfo is None:
                 dt = dt.replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            # 2. Fallback: Parse as Date Only (e.g. 2025-12-13)
            # LOGIC: We assume a date without a time is Midnight in the Philippines.
            dt = datetime.datetime.strptime(clean_date, "%Y-%m-%d")
            
            # Apply PHT (Midnight PH)
            dt = dt.replace(tzinfo=LMS_TZ)
            
            # Convert to UTC for consistent comparison with 'now'
            dt = dt.astimezone(datetime.timezone.utc)
            
        return dt
    except ValueError as e:
        print(f"[FeedGen] Date parse error for '{date_str}': {e}")
        return None

def generate_rss_xml(posts: List[PostItem], title_suffix: str = "") -> str:
    """Generates a valid RSS 2.0 XML string from a list of posts."""
    
    # RFC-822 Date Format for RSS (e.g., Wed, 02 Oct 2002 13:00:00 GMT)
    def to_rfc822(dt: datetime.datetime) -> str:
        return dt.strftime("%a, %d %b %Y %H:%M:%S %z")

    items_xml = ""
    for p in posts:
        # Escape special characters to prevent XML breakage
        safe_title = html.escape(p['title'])
        safe_desc = html.escape(p['abstract'])
        safe_subtitle = html.escape(p['subtitle'])
        # Absolute URL is required for RSS readers/Email clients
        full_url = f"https://renscourses.netlify.app/{p['url']}"
        
        # Inject <subtitle> tag (Custom non-standard tag, but readable by our parser)
        items_xml += f"""
        <item>
            <title>{safe_title}</title>
            <subtitle>{safe_subtitle}</subtitle>
            <link>{full_url}</link>
            <guid>{full_url}</guid>
            <pubDate>{to_rfc822(p['date'])}</pubDate>
            <description>{safe_desc}</description>
        </item>"""

    return f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
    <title>Ren's Courses {title_suffix}</title>
    <link>https://renscourses.netlify.app/</link>
    <description>Latest course materials and announcements.</description>
    <language>en-us</language>
    {items_xml}
</channel>
</rss>"""

def generate_feed() -> None:
    now = get_current_time()
    start_str = os.environ.get("TERM_START")
    end_str = os.environ.get("TERM_END")
    
    if not start_str or not end_str:
        raise OSError(f"[FeedGen] Error: TERM_START or TERM_END not configured.")

    # These use parse_date, so they are interpreted as Midnight PHT -> Converted to UTC
    start = parse_date(start_str)
    end = parse_date(end_str)
    
    print(f"[FeedGen] Term Window (UTC): {start} to {end}")
    
    # Compare UTC to UTC
    if now > end:
        print(f"[FeedGen] Term ended on {end}. Current time is {now}. Skipping feed generation.")
        return
    
    all_posts: List[PostItem] = []

    # Regex patterns
    re_title = re.compile(r'^title:\s*["\']?(.*?)["\']?\s*$', re.MULTILINE | re.IGNORECASE)
    re_subtitle = re.compile(r'^subtitle:\s*["\']?(.*?)["\']?\s*$', re.MULTILINE | re.IGNORECASE)
    re_date = re.compile(r'^published:\s*([\d\-\:T\+Z]+)', re.MULTILINE | re.IGNORECASE)
    re_draft = re.compile(r'^isdraft:\s*(true|false)', re.MULTILINE | re.IGNORECASE)
    re_tags = re.compile(r'^tags:\s*\[(.*?)\]', re.MULTILINE | re.IGNORECASE)
    re_lead = re.compile(r'^lead:\s*["\']?(.*?)["\']?\s*$', re.MULTILINE | re.IGNORECASE)

    if not os.path.exists(CONTENT_DIR):
        print(f"[FeedGen] Error: Content directory '{CONTENT_DIR}' not found.")
        return

    for filepath in glob(os.path.join(CONTENT_DIR, "*.md")):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
                date_match = re_date.search(content)
                if not date_match:
                    continue

                # Parse Frontmatter
                title_match = re_title.search(content)
                subtitle_match = re_subtitle.search(content)
                draft_match = re_draft.search(content)
                tags_match = re_tags.search(content)
                lead_match = re_lead.search(content)

                title = title_match.group(1).strip() if title_match else "Untitled"
                subtitle = subtitle_match.group(1).strip() if subtitle_match else ""
                pub_date = parse_date(date_match.group(1).strip())
                is_draft = draft_match and draft_match.group(1).lower() == 'true'
                abstract = lead_match.group(1).strip() if lead_match else "No description."
                
                tags = []
                if tags_match:
                    raw_tags = tags_match.group(1).split(',')
                    tags = [t.strip().strip("'\"") for t in raw_tags if t.strip()]

                # --- FILTERING LOGIC ---
                if not pub_date or is_draft:
                    continue

                if pub_date > now:
                    print(f"Skipping Future Post: {title} ({pub_date} > {now})")
                    continue
                
                if pub_date < start:
                    print(f"Skipping Past Term Post: {title} ({pub_date} < {start})")
                    continue
                
                if pub_date > end:
                    print(f"Skipping Future Term Post: {title} ({pub_date} > {end})")
                    continue
                
                filename = os.path.basename(filepath)
                slug = os.path.splitext(filename)[0]
                url = f"articles/{slug}"

                all_posts.append({
                    "title": title,
                    "subtitle": subtitle,
                    "url": url,
                    "date": pub_date,
                    "tags": tags,
                    "abstract": abstract
                })
        except Exception as e:
            print(f"[FeedGen] Error parsing {filepath}: {e}")

    # Sort Newest First
    all_posts.sort(key=lambda x: x['date'], reverse=True)

    # 2. OUTPUT XML FOR RSS FEED
    # A. Master Feed
    with open(os.path.join(OUTPUT_DIR, "feed.xml"), 'w', encoding='utf-8') as f:
        f.write(generate_rss_xml(all_posts))

    # B. Tag-Specific Feeds (e.g., cmsc-124.xml)
    # Find all unique tags
    unique_tags = set(tag for p in all_posts for tag in p['tags'])
    for tag in unique_tags:
        # Filter posts for this tag
        tag_posts = [p for p in all_posts if tag in p['tags']]
        if tag_posts:
            filename = f"feed-{tag}.xml"
            with open(os.path.join(OUTPUT_DIR, filename), 'w', encoding='utf-8') as f:
                f.write(generate_rss_xml(tag_posts, title_suffix=f"({tag})"))
            print(f"[FeedGen] Generated {filename}")

    print(f"[FeedGen] Success! Generated feed.xml and {len(unique_tags)} tag feeds.")

if __name__ == "__main__":
    generate_feed()