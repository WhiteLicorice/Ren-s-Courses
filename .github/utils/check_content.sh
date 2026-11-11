#!/usr/bin/env bash
# Fail the workflow when the material depot checkout holds no Markdown file.
# The public repository tracks only Content/.gitkeep. The workflow clones the
# private depot into Content before this script runs. An empty folder means the
# checkout failed or the deploy key is missing.
set -eu

materials_dir="Content/Materials"
count=$(find "$materials_dir" -type f -name '*.md' 2>/dev/null | wc -l)

if [ "$count" -eq 0 ]; then
  echo "::error title=Material depot checkout failed::No Markdown file under Content/Materials. Check the MATERIAL_DEPOT_DEPLOY_KEY secret and the depot repository."
  exit 1
fi

echo "Found $count Markdown files under Content/Materials."
