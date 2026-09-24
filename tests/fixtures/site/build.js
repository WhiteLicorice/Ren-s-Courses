'use strict';

/**
 * Build the end-to-end fixture site into output-e2e/.
 *
 * The real generator runs against tests/fixtures/site/Content instead of
 * Content/, so no browser test depends on a live material. SITE_PROFILE=e2e
 * selects that layout in Program.cs. The environment below is fixed, so every
 * build produces the same pages.
 *
 * Usage: npm run build:e2e-site
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

// Program.cs SiteLayout.EndToEndFixture keeps its PDF cache in artifacts/e2e-site,
// so the cache prune never sees a production slug. The pinned toolchain is
// read-only and identical for both layouts. Link it instead of downloading 270 MB again.
const productionToolchain = path.join(repoRoot, 'artifacts', 'pdf-toolchain');
const fixtureToolchain = path.join(repoRoot, 'artifacts', 'e2e-site', 'pdf-toolchain');
if (fs.existsSync(productionToolchain) && !fs.existsSync(fixtureToolchain)) {
    fs.mkdirSync(path.dirname(fixtureToolchain), { recursive: true });
    fs.symlinkSync(productionToolchain, fixtureToolchain, 'junction');
}

const env = {
    ...process.env,
    SITE_PROFILE: 'e2e',
    ASPNETCORE_ENVIRONMENT: 'Production',
    STATIC_GEN_TIME: '2026-09-15T02:00:00Z',
    TERM_START: '2026-08-01',
    TERM_END: '2026-12-31',
    ACTIVE_COURSES: 'fixture-course-a,fixture-course-b',
    // The real visibility rules run. Every fixture sits inside the term window.
    SHOWCASE_MODE: 'false'
};

const result = spawnSync('dotnet', ['run', '--no-launch-profile', '--configuration', 'Release'], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
