'use strict';

/**
 * Names in the end-to-end fixture site. `npm run build:e2e-site` builds that
 * site from tests/fixtures/site/Content into output-e2e/. Keep these values in
 * step with the Markdown files there.
 */

const path = require('path');

module.exports = {
    /** The built fixture site. The e2e suite never reads output/, the real site. */
    OUTPUT_ROOT: path.resolve(__dirname, '..', '..', '..', 'output-e2e'),

    /** Course A has a native PDF. Course B has an external download link. */
    COURSE: 'fixture-course-a',
    OTHER_COURSE: 'fixture-course-b',

    ARTICLE_SLUG: 'fixture-course-a-lab1',
    ARTICLE_ROUTE: '/articles/fixture-course-a-lab1',

    /** Declares downloadLink, so the build generates no PDF for it. */
    EXTERNAL_ARTICLE_ROUTE: '/articles/fixture-course-b-lab1',
    EXTERNAL_DOWNLOAD_LINK: 'https://example.com/fixture-course-b-lab1.pdf',

    /** SlugHelper.Slugify("How do I submit a fixture laboratory?") */
    FAQ_SLUG: 'how-do-i-submit-a-fixture-laboratory'
};
