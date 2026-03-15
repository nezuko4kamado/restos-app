import json

# Read the incomplete file to see what we have
with open('src/lib/i18n.ts', 'r', encoding='utf-8') as f:
    existing_content = f.read()

# Since the file is incomplete, let me generate a complete version
# I'll create a simplified approach - copy the Italian translations and create proper translations for other languages

# For now, let me create a working version by reading from git history or creating fresh
import subprocess
import os

# Check if there's a git backup
result = subprocess.run(['git', 'show', 'HEAD:src/lib/i18n.ts'], 
                       capture_output=True, text=True, cwd='/workspace/shadcn-ui')

if result.returncode == 0:
    # We have a backup, use it as base
    original_content = result.stdout
    print("Found git backup, using it as base")
    
    # Now I need to add complete translations for es, fr, de, lt
    # This is a large file, so I'll use a template approach
    
    with open('src/lib/i18n.ts', 'w', encoding='utf-8') as f:
        f.write(original_content)
    print("Restored from git backup successfully")
else:
    print("No git backup found, will need to create from scratch")
    print("File size:", len(existing_content))

