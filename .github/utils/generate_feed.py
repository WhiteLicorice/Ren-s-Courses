import os
import datetime
import html
from glob import glob
from typing import TypedDict, List, Optional, Union

# pip install python-frontmatter
import frontmatter 

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

def parse_date(date_obj: Union[str, datetime.date, datetime.datetime]) -> Optional[datetime.datetime]:
    """
    Robustly parses a date input into a timezone-aware UTC datetime object.
    Accepts Strings (classic regex path) OR native datetime objects (YAML auto-parsed).
    """
    dt = None

    # A. Handle Native Objects
    if isinstance(date_obj, (datetime.date, datetime.datetime)):
        # If it's just a date (naive), convert to datetime at midnight
        if not isinstance(date_obj, datetime.datetime):
            dt = datetime.datetime.combine(date_obj, datetime.time.min)
        else:
            dt = date_obj

        # If it's naive (no timezone), assign LMS_TZ (PHT) logic
        if dt.tzinfo is None:
             dt = dt.replace(tzinfo=LMS_TZ)

    # B. Handle Strings (Fallback if YAML loaded it as a string)
    elif isinstance(date_obj, str):
        try:
            clean_date = date_obj.strip().replace("Z", "+00:00")
            
            # 1. Try parsing as full ISO 
            try:
                dt = datetime.datetime.fromisoformat(clean_date)
                
                # Treat naive strings (like "2026-01-19") as PHT, just like Native Objects above.
                if dt.tzinfo is None:
                     dt = dt.replace(tzinfo=LMS_TZ)
                     
            except ValueError:
                # 2. Fallback: Parse as Date Only (e.g. 2025-12-13)
                dt = datetime.datetime.strptime(clean_date, "%Y-%m-%d")
                # Apply PHT (Midnight PH)
                dt = dt.replace(tzinfo=LMS_TZ)

        except ValueError as e:
             print(f"[FeedGen] Date parse error for string '{date_obj}': {e}")
             return None

    # C. Final Conversion to UTC
    if dt:
        return dt.astimezone(datetime.timezone.utc)
    
    return None

def generate_rss_xml(posts: List[PostItem], title_suffix: str = "") -> str:
    """Generates a valid RSS 2.0 XML string from a list of posts."""
    
    # RFC-822 Date Format for RSS
    def to_rfc822(dt: datetime.datetime) -> str:
        return dt.strftime("%a, %d %b %Y %H:%M:%S %z")

    items_xml = ""
    for p in posts:
        # Escape special characters to prevent XML breakage
        safe_title = html.escape(str(p['title']))
        safe_desc = html.escape(str(p['abstract']))
        safe_subtitle = html.escape(str(p['subtitle']))
        # Absolute URL is required for RSS readers/Email clients
        full_url = f"https://renscourses.netlify.app/{p['url']}"
        
        # Inject <subtitle> tag
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

    if not os.path.exists(CONTENT_DIR):
        print(f"[FeedGen] Error: Content directory '{CONTENT_DIR}' not found.")
        return

    # 1. SCAN (Replaced Regex loop with python-frontmatter)
    for filepath in glob(os.path.join(CONTENT_DIR, "*.md")):
        try:
            # Load file and parse FrontMatter automatically
            with open(filepath, 'r', encoding='utf-8') as f:
                post: frontmatter.Post = frontmatter.load(f)
            
            metadata = post.metadata
            
            # Safely access fields (dict.get handles missing keys)
            # We skip if 'published' is missing entirely
            if 'published' not in metadata:
                continue

            pub_date = parse_date(metadata.get('published'))
            
            # --- FILTERING LOGIC ---
            # FIXME: This does not seem to respect the IsDraft flag as intended. See logs later!
            is_draft = str(metadata.get('IsDraft', 'false')).lower() == 'true'
            print(is_draft, filepath)

            if not pub_date or is_draft:
                continue

            title = metadata.get('title', 'Untitled')
            
            if pub_date > now:
                print(f"Skipping Future Post: {title} ({pub_date} > {now})")
                continue
            
            if pub_date < start:
                print(f"Skipping Past Term Post: {title} ({pub_date} < {start})")
                continue
            
            if pub_date > end:
                print(f"Skipping Future Term Post: {title} ({pub_date} > {end})")
                continue
            
            # Prepare Data
            filename = os.path.basename(filepath)
            slug = os.path.splitext(filename)[0]
            url = f"articles/{slug}"
            
            # Handle Tags: YAML parser gives us a List or None. Ensure List.
            tags = metadata.get('tags', [])
            if not isinstance(tags, list):
                # Fallback if someone wrote tags: "tag1, tag2" string
                tags = [str(tags)] 

            all_posts.append({
                "title": title,
                "subtitle": metadata.get('subtitle', ''),
                "url": url,
                "date": pub_date,
                "tags": [str(t) for t in tags], # Ensure strings
                "abstract": metadata.get('lead', 'No description.')
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