import { writeFileSync } from 'fs';
import path from 'path';
import data from 'emoji-datasource-google';

function unifiedToEmoji(unified: string): string {
  return unified
    .split('-')
    .map(code => String.fromCodePoint(parseInt(code, 16)))
    .join('');
}

function generateEmojiData() {
  const categories: Record<string, Set<string>> = {
    smileys: new Set(),
    people: new Set(),
    nature: new Set(),
    food: new Set(),
    activities: new Set(),
    travel: new Set(),
    objects: new Set(),
    symbols: new Set(),
    flags: new Set(),
  };

  const categoryLabels: Record<string, string> = {
    smileys: 'Smileys & Emotions',
    people: 'People',
    nature: 'Nature',
    food: 'Food & Drink',
    activities: 'Activities & Sports',
    travel: 'Travel & Places',
    objects: 'Objects',
    symbols: 'Symbols',
    flags: 'Flags',
  };

  // Map source categories to our categories
  const sourceToTarget: Record<string, string> = {
    'smileys': 'smileys',
    'smileys_people': 'smileys',
    'smileys & emotion': 'smileys',
    'people': 'people',
    'people & body': 'people',
    'nature': 'nature',
    'animals & nature': 'nature',
    'food': 'food',
    'foods': 'food',
    'food & drink': 'food',
    'activity': 'activities',
    'activities': 'activities',
    'activities & sports': 'activities',
    'travel': 'travel',
    'places': 'travel',
    'travel & places': 'travel',
    'objects': 'objects',
    'symbols': 'symbols',
    'flags': 'flags',
    'component': 'symbols',
  };

  // Map to store emoji names
  const emojiNames: Record<string, string> = {};

  // Process emojis
  for (const emoji of data) {
    const origCategory = (emoji.category as string).toLowerCase();
    const targetCategory = sourceToTarget[origCategory] || 'objects';

    // Skip skin tone variants and some compound emojis
    if (emoji.skin_variations || emoji.name?.includes('skin-tone')) {
      continue;
    }

    try {
      const char = unifiedToEmoji(emoji.unified);
      if (char && char.length > 0) {
        categories[targetCategory].add(char);
        // Store the name with proper formatting
        emojiNames[char] = (emoji.name as string)
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
      }
    } catch {
      // Skip invalid emojis
    }
  }

  // Convert to output format
  const result: Record<
    string,
    {
      label: string;
      emojis: Array<{ char: string; name: string }>;
    }
  > = {};

  for (const [category, label] of Object.entries(categoryLabels)) {
    const emojisSet = categories[category];
    const emojisArray = Array.from(emojisSet).slice(0, 300); // Increased limit
    result[category] = {
      label,
      emojis: emojisArray.map(char => ({
        char,
        name: emojiNames[char] || 'Emoji',
      })),
    };
  }

  return result;
}

function main() {
  try {
    const emojiData = generateEmojiData();
    const outputPath = path.join(
      import.meta.dir,
      '../src/public/static/data/emojis.json'
    );

    writeFileSync(outputPath, JSON.stringify(emojiData, null, 2));

    const totalEmojis = Object.values(emojiData).reduce(
      (acc, cat) => acc + cat.emojis.length,
      0
    );

    console.log('✅ Generated emojis.json');
    for (const [cat, data] of Object.entries(emojiData)) {
      console.log(`  ${cat}: ${data.emojis.length} emojis`);
    }
    console.log(`Total: ${totalEmojis} emojis`);
  } catch (error) {
    console.error('Error generating emojis:', error);
    process.exit(1);
  }
}

main();
