'use strict';

/**
 * Permanent, in-memory article fixture for inline code inside a table cell.
 *
 * This fixture is test infrastructure. It is independent of Content/Materials,
 * so no production or fixture material is required to exercise the stylesheet.
 * The article body copies the wrapper from Components/Pages/Blog.razor: the
 * `.prose max-w-none` div. The stylesheets load from the built fixture site by
 * their normal paths. Keep the class names in step with Blog.razor.
 */

/** Token cell text. Short, so the table fits a phone without extra width. */
const CELL_CODE = 'cmsc-124';

function buildTableCodeMarkup() {
    return `<h1>Table Code Harness</h1>
<p>The paragraph carries inline code such as <code>${CELL_CODE}</code> at the body size.</p>
<table>
<thead>
<tr><th>Token</th><th>Meaning</th></tr>
</thead>
<tbody>
<tr><td><code>${CELL_CODE}</code></td><td>A course tag.</td></tr>
<tr><td><code>fixture-course-a</code></td><td>An active course tag.</td></tr>
</tbody>
</table>`;
}

module.exports = { CELL_CODE, buildTableCodeMarkup };
