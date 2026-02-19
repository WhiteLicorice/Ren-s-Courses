# Custom Calendar Events

This directory contains user-defined calendar events that appear on the `/calendar` page alongside holidays and course-related events.

## Creating a Custom Calendar Event

Create a markdown file (`.md`) in this directory with the following frontmatter structure:

```yaml
---
title: Event Name
dates: [2026-03-15]
tooltip: Description shown on hover
eventType: Custom
url: https://example.com
cssClass: bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500
---

Optional content describing the event in detail.
```

## Frontmatter Fields

### Required Fields
- **title**: The name of the event (string)
- **dates**: Array of dates when this event occurs (DateTime array, format: `[YYYY-MM-DD]` or `[YYYY-MM-DD, YYYY-MM-DD, ...]`)
  - Single day event: `dates: [2026-03-15]`
  - Multi-day event: `dates: [2026-02-25, 2026-02-26, 2026-02-27, 2026-02-28]`

### Optional Fields
- **tooltip**: Description shown when hovering over the event (string)
  - If not provided, defaults to the event type name
- **eventType**: The type of event, determines default styling (enum)
  - Options: `Holiday`, `Release`, `Deadline`, `Progress`, `Defense`, `Custom`
  - Default: `Custom`
- **url**: Link to open when the event is clicked (string)
  - If not provided, the event is non-clickable
- **cssClass**: Custom Tailwind CSS classes for styling (string)
  - If not provided, uses default styling based on `eventType`

## Event Type Default Styles

- **Holiday**: Accent color (configurable theme color)
- **Custom**: Accent color (same as Holiday)
- **Release**: Blue
- **Deadline**: Orange, bold
- **Progress**: Yellow
- **Defense**: Green

## Examples

### Simple Event (using default styling)
```yaml
---
title: University Week
dates: [2026-02-16]
tooltip: Annual University Week celebration
eventType: Custom
url: https://upv.edu.ph
---
```

### Multi-Day Event
```yaml
---
title: IIARS Conference
dates: [2026-02-25, 2026-02-26, 2026-02-27, 2026-02-28]
tooltip: 4th International Conference on ICT Applications in Research
eventType: Custom
---
```

### Event with Custom Styling
```yaml
---
title: Faculty Development Day
dates: [2026-04-10]
tooltip: No classes - faculty professional development
eventType: Custom
cssClass: bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500
---
```

### Important Deadline
```yaml
---
title: Midterm Examination Period
dates: [2026-03-15]
tooltip: University-wide midterm exam period begins
eventType: Deadline
---
```

## Notes

- Events are automatically filtered to only show during the configured term period
- Events appear in both desktop grid view and mobile list view
- Multiple events can occur on the same day
- Multi-day events will appear on each date in the `dates` array
- The content below the frontmatter is optional and not displayed on the calendar
