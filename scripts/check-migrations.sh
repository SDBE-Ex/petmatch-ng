#!/usr/bin/env bash
# Checks whether every local Supabase migration has actually been applied
# to the linked remote database. Migrations here are written but not
# auto-applied on push/deploy — nothing else in this project's workflow
# catches it if one is written and never run. Run this after adding or
# pulling a migration, before considering a schema-touching feature done.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Checking migration status against linked Supabase project..."
RESULT=$(supabase migration list --linked 2>&1)

if ! echo "$RESULT" | grep -q '"migrations"'; then
  echo "Could not get migration status. Raw output:"
  echo "$RESULT"
  exit 1
fi

echo "$RESULT" | python3 -c "
import json, re, sys

raw = sys.stdin.read()
match = re.search(r'\{.*\}', raw, re.S)
if not match:
    print('Could not parse migration list output.')
    sys.exit(1)

data = json.loads(match.group(0))
migrations = data.get('migrations', [])
drifted = [m for m in migrations if m.get('local') and not m.get('remote')]

if not drifted:
    print(f'All {len(migrations)} migrations are applied to remote. No drift.')
    sys.exit(0)

print(f'{len(drifted)} migration(s) NOT applied to remote:')
for m in drifted:
    print(f'  - {m[\"local\"]}')
print()
print('Run: supabase db push --linked')
sys.exit(1)
"
