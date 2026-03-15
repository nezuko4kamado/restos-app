import fs from 'fs';

// Read the i18n file
const content = fs.readFileSync('src/lib/i18n.ts', 'utf8');

// Extract the interface definition
const interfaceMatch = content.match(/export interface Translations \{([\s\S]*?)\n\}/);
if (!interfaceMatch) {
  console.log('❌ Could not find Translations interface');
  process.exit(1);
}

// Extract all keys from interface
const interfaceContent = interfaceMatch[1];
const keys = interfaceContent.match(/^\s*(\w+):/gm)
  ?.map(k => k.trim().replace(':', ''))
  .filter(k => k && !k.startsWith('//'));

console.log(`✅ Found ${keys?.length || 0} translation keys in interface`);

// Check each language
const languages = ['it', 'en', 'es', 'fr', 'de', 'lt'];
const results = {};

languages.forEach(lang => {
  const langMatch = content.match(new RegExp(`${lang}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},?\\n`));
  
  if (!langMatch) {
    console.log(`❌ ${lang}: Could not find language section`);
    results[lang] = { found: false, keys: 0 };
    return;
  }
  
  const langContent = langMatch[1];
  const langKeys = langContent.match(/^\s*(\w+):/gm)
    ?.map(k => k.trim().replace(':', ''))
    .filter(k => k && !k.startsWith('//'));
  
  results[lang] = {
    found: true,
    keys: langKeys?.length || 0,
    complete: langKeys?.length === keys?.length
  };
  
  if (results[lang].complete) {
    console.log(`✅ ${lang}: ${results[lang].keys} keys (COMPLETE)`);
  } else {
    console.log(`❌ ${lang}: ${results[lang].keys} keys (MISSING ${(keys?.length || 0) - (langKeys?.length || 0)} keys)`);
    
    // Find missing keys
    const missingKeys = keys.filter(k => !langKeys?.includes(k));
    if (missingKeys.length > 0 && missingKeys.length <= 10) {
      console.log(`   Missing keys: ${missingKeys.join(', ')}`);
    }
  }
});

// Check if all languages are complete
const allComplete = Object.values(results).every(r => r.complete);
if (allComplete) {
  console.log('\n✅ ALL TRANSLATIONS COMPLETE!');
  process.exit(0);
} else {
  console.log('\n❌ SOME TRANSLATIONS INCOMPLETE');
  process.exit(1);
}
