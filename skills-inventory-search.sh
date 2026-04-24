#!/usr/bin/env bash
# skills-inventory-search.sh
# One-shot discovery: does a vizora-skills / agency-skills collection actually exist as artifacts?
# Run from Git Bash, WSL, or any Unix shell. Writes findings to ./skills-inventory-findings.txt
# and prints a summary. Does NOT classify or rework — just finds and flags.

set -u  # no -e; we want the script to finish even if individual checks fail

OUTPUT_FILE="./skills-inventory-findings.txt"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Reset output file
: > "$OUTPUT_FILE"

log() {
  echo "$1" | tee -a "$OUTPUT_FILE"
}

header() {
  echo "" | tee -a "$OUTPUT_FILE"
  echo "=== $1 ===" | tee -a "$OUTPUT_FILE"
}

log "Skill inventory search run at $TIMESTAMP"
log "Host: $(hostname 2>/dev/null || echo unknown)"
log "User: $(whoami 2>/dev/null || echo unknown)"

# -----------------------------------------------------------------------------
# Step 1: Local filesystem search
# -----------------------------------------------------------------------------
header "STEP 1: Local filesystem"

SEARCH_ROOTS=(
  "/c/Users/srini"
  "/c/Users/$(whoami)"
  "$HOME"
  "/c/dev"
  "/c/code"
  "/c/projects"
  "/c/repos"
)

log ""
log "1a. Directories matching *vizora-skill* or *agency-skill*:"
FOUND_DIRS=0
for root in "${SEARCH_ROOTS[@]}"; do
  if [ -d "$root" ]; then
    matches=$(find "$root" -maxdepth 6 -type d \( -iname "*vizora-skill*" -o -iname "*agency-skill*" -o -iname "*hisaku-skill*" \) 2>/dev/null)
    if [ -n "$matches" ]; then
      echo "$matches" | tee -a "$OUTPUT_FILE"
      FOUND_DIRS=$((FOUND_DIRS + $(echo "$matches" | wc -l)))
    fi
  fi
done
if [ $FOUND_DIRS -eq 0 ]; then
  log "  (none found)"
fi

log ""
log "1b. Markdown files with 'name:' YAML frontmatter (skill-shaped):"
FOUND_SKILLS=0
for root in "${SEARCH_ROOTS[@]}"; do
  if [ -d "$root" ]; then
    while IFS= read -r file; do
      if [ -f "$file" ] && head -5 "$file" 2>/dev/null | grep -q "^name:" 2>/dev/null; then
        echo "  $file" | tee -a "$OUTPUT_FILE"
        FOUND_SKILLS=$((FOUND_SKILLS + 1))
      fi
    done < <(find "$root" -maxdepth 6 -type f -name "*.md" 2>/dev/null | head -200)
  fi
done
if [ $FOUND_SKILLS -eq 0 ]; then
  log "  (none found)"
else
  log ""
  log "  Total skill-shaped .md files: $FOUND_SKILLS"
fi

log ""
log "1c. Claude Code session directories:"
if [ -d "$HOME/.claude/projects" ]; then
  ls -la "$HOME/.claude/projects/" 2>/dev/null | tee -a "$OUTPUT_FILE"
else
  log "  (~/.claude/projects does not exist)"
fi

log ""
log "1d. Claude config / skills cache locations:"
for path in "$HOME/.claude" "$HOME/.config/claude" "/c/Users/$(whoami)/AppData/Roaming/Claude" "/c/Users/$(whoami)/AppData/Local/Claude"; do
  if [ -d "$path" ]; then
    log "  EXISTS: $path"
    subdirs=$(find "$path" -maxdepth 3 -type d -iname "*skill*" 2>/dev/null)
    if [ -n "$subdirs" ]; then
      echo "$subdirs" | sed 's/^/    /' | tee -a "$OUTPUT_FILE"
    fi
  fi
done

# -----------------------------------------------------------------------------
# Step 2: GitHub search
# -----------------------------------------------------------------------------
header "STEP 2: GitHub"

if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    log ""
    log "2a. trivenidigital repos matching 'skill':"
    gh repo list trivenidigital --limit 100 2>/dev/null | grep -i skill | tee -a "$OUTPUT_FILE" || log "  (none)"

    log ""
    log "2b. trivenidigital repos matching 'agency':"
    gh repo list trivenidigital --limit 100 2>/dev/null | grep -i agency | tee -a "$OUTPUT_FILE" || log "  (none)"

    log ""
    log "2c. trivenidigital repos matching 'hisaku':"
    gh repo list trivenidigital --limit 100 2>/dev/null | grep -i hisaku | tee -a "$OUTPUT_FILE" || log "  (none)"

    log ""
    log "2d. Personal account repos with 'skill' in name (if any personal account set up):"
    gh search repos "skill" --owner="@me" --limit 20 2>/dev/null | tee -a "$OUTPUT_FILE" || log "  (search failed or no results)"
  else
    log "  gh CLI installed but not authenticated. Run: gh auth login"
  fi
else
  log "  gh CLI not installed. Skip or install from https://cli.github.com/"
fi

# -----------------------------------------------------------------------------
# Step 3: Cloud surfaces — manual reminder
# -----------------------------------------------------------------------------
header "STEP 3: Cloud surfaces (manual check required)"
log ""
log "The script cannot search these. Check them yourself and add findings below:"
log "  [ ] claude.ai Projects — search 'skill', 'agency', 'vizora', 'hisaku'"
log "  [ ] claude.ai Cowork — any saved skills or plugins"
log "  [ ] Notion — search literal 'vizora-skills-v3' and 'agency-skills'"
log "  [ ] Google Drive — same literal searches"
log "  [ ] Obsidian vault (if any) — search for skill-shaped .md files"
log ""
log "Manual findings:"
log "  (fill in)"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
header "SUMMARY"
log ""
log "Directories matching skill patterns: $FOUND_DIRS"
log "Skill-shaped .md files (with name: frontmatter): $FOUND_SKILLS"
log ""
log "Next step:"
if [ $FOUND_DIRS -eq 0 ] && [ $FOUND_SKILLS -eq 0 ]; then
  log "  LOCAL + GITHUB EMPTY. Before doing classification work:"
  log "  1. Complete the Step 3 manual checks above."
  log "  2. If Step 3 is also empty/fuzzy, STOP. Finding is 'nothing exists.'"
  log "     Do not invent classification work. Come back with the empty result."
else
  log "  Material found. Proceed to Step 4 classification only on the items listed above."
  log "  For each found item, capture: name | location | form | shape | portable? | est_hours"
fi

log ""
log "Output file: $OUTPUT_FILE"
log "Commit to: docs/hermes/skills-inventory-2026-04-23.md in the vizora repo"
log ""
log "Run complete."

echo ""
echo "---"
echo "Findings written to: $OUTPUT_FILE"
echo "Review, complete the manual Step 3 checks, then decide whether Step 4 is warranted."
