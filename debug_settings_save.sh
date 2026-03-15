#!/bin/bash
echo "=== Checking SettingsSection Save Button ==="
grep -B 5 -A 10 "Salva Impostazioni" src/components/SettingsSection.tsx | head -20

echo ""
echo "=== Checking handleSave function ==="
grep -B 3 -A 15 "const handleSave" src/components/SettingsSection.tsx

echo ""
echo "=== Checking saveSettings in storage.ts ==="
grep -B 2 -A 25 "export const saveSettings" src/lib/storage.ts | head -30

echo ""
echo "=== Checking getSettings in storage.ts ==="
grep -B 2 -A 25 "export const getSettings" src/lib/storage.ts | head -30
