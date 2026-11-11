'use strict';

/**
 * Build the end-to-end fixture site.
 *
 * SITE_PROFILE=e2e builds the absolute fixture layout into output-e2e/. The
 * `--relative` flag builds the relative production-like layout into
 * output-e2e-relative/. It copies the fixture tree into bin/Content, so the
 * site and the PDF generator read the same relative path production uses.
 * No browser test depends on a live material. The environment below is fixed.
 *
 * Usage: npm run build:e2e-site
 *        npm run build:e2e-relative
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const relative = process.argv.includes('--relative');
const shell = process.platform === 'win32';

// Program.cs keeps each fixture PDF cache apart from production, so the cache
// prune never sees a production slug. The pinned toolchain is read-only and
// identical for both layouts. Link it instead of downloading 270 MB again.
const productionToolchain = path.join(repoRoot, 'artifacts', 'pdf-toolchain');
const fixtureToolchain = path.join(repoRoot, 'artifacts',
    relative ? 'e2e-site-relative' : 'e2e-site', 'pdf-toolchain');
if (fs.existsSync(productionToolchain) && !fs.existsSync(fixtureToolchain)) {
    fs.mkdirSync(path.dirname(fixtureToolchain), { recursive: true });
    fs.symlinkSync(productionToolchain, fixtureToolchain, 'junction');
}

const env = {
    ...process.env,
    SITE_PROFILE: relative ? 'e2e-relative' : 'e2e',
    ASPNETCORE_ENVIRONMENT: 'Production',
    STATIC_GEN_TIME: '2026-09-15T02:00:00Z',
    TERM_START: '2026-08-01',
    TERM_END: '2026-12-31',
    ACTIVE_COURSES: 'fixture-course-a,fixture-course-b',
    // The real visibility rules run. Every fixture sits inside the term window.
    SHOWCASE_MODE: 'false'
};

if (relative) {
    const build = spawnSync('dotnet', ['build', '--configuration', 'Release'], {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
        shell
    });
    if (build.error) throw build.error;
    if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);

    // Replace the production bin copy with the fixture tree. The tracked Content
    // folder is never touched, and the cleanup below removes the fixture files.
    const binContent = path.join(repoRoot, 'bin', 'Release', 'net9.0', 'Content');
    fs.rmSync(binContent, { recursive: true, force: true });
    fs.cpSync(path.join(repoRoot, 'tests', 'fixtures', 'site', 'Content'),
        binContent, { recursive: true });

    const run = spawnSync('dotnet', [
        'run', '--no-build', '--no-launch-profile', '--configuration', 'Release'
    ], {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
        shell
    });
    fs.rmSync(binContent, { recursive: true, force: true });
    if (run.error) throw run.error;
    process.exit(run.status ?? 1);
}

// A later production build must not inherit a fixture tree from a relative build.
// The production build copies the tracked Content/** into bin again.
fs.rmSync(path.join(repoRoot, 'bin', 'Release', 'net9.0', 'Content'),
    { recursive: true, force: true });

const result = spawnSync('dotnet', ['run', '--no-launch-profile', '--configuration', 'Release'], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
