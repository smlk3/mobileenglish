/**
 * generate-wordlist.ts
 *
 * Build-time script to generate vocabulary wordlists for language pairs using AI.
 * NOT run at app runtime — only during development to populate assets/wordlists/.
 *
 * Usage:
 *   npx ts-node scripts/generate-wordlist.ts --target de --native tr --level 1
 *   npx ts-node scripts/generate-wordlist.ts --target ja --native tr --all-levels
 *
 * Prerequisites:
 *   - OPENAI_API_KEY environment variable set
 *   - ts-node installed (npm i -D ts-node)
 *
 * Output:
 *   Writes to assets/wordlists/{target}/{native}.json
 *   If the file already exists, new words are merged (no duplicates).
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Config ──────────────────────────────────────────────────────────

const WORDS_PER_LEVEL = 400;
const BATCH_SIZE = 50; // Words per API call (to avoid token limits)

const LEVEL_DESCRIPTIONS: Record<number, string> = {
    1: 'Complete beginner (A1/N5). Basic greetings, numbers, colors, family, food, daily objects, simple verbs (be, have, go, eat). Very common words only.',
    2: 'Elementary (A2/N4). Simple daily conversations, travel basics, shopping, directions, time expressions, common adjectives and adverbs.',
    3: 'Intermediate (B1/N3). Work and education vocabulary, expressing opinions, describing experiences, emotions, health, technology basics.',
    4: 'Upper-intermediate (B2/N2). Business, media, politics, science basics, abstract concepts, idioms and phrasal verbs, formal vs informal.',
    5: 'Advanced (C1/N1). Academic vocabulary, nuanced expressions, professional jargon, literary terms, sophisticated connectors.',
    6: 'Mastery (C2/N1+). Rare but useful words, domain-specific terminology, archaic expressions used in literature, highly formal language.',
};

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
    ru: 'Russian', uk: 'Ukrainian', pl: 'Polish', bg: 'Bulgarian',
    sr: 'Serbian', hy: 'Armenian', ar: 'Arabic', ja: 'Japanese',
    zh: 'Chinese', tr: 'Turkish',
};

// ─── Proficiency Frameworks ──────────────────────────────────────────
// Each target language is calibrated to its own most widely used standard.

interface Framework {
    name: string;        // e.g. 'CEFR'
    labels: string[];    // 6 labels; index 0 = internal level 1
    references: string;  // official lists to calibrate against
}

const CEFR: Framework = {
    name: 'CEFR',
    labels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    references: 'the CEFR Companion Volume and official exam word lists (Goethe, DELF/DALF, DELE, CILS, TELC, TORFL, TÖMER/Yunus Emre)',
};

const JLPT: Framework = {
    name: 'JLPT',
    labels: ['N5', 'N4', 'N3', 'N2', 'N1', 'N1+'],
    references: 'the official JLPT vocabulary and kanji lists',
};

const HSK: Framework = {
    name: 'HSK',
    labels: ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'],
    references: 'the official HSK word lists',
};

// Target language → framework. Anything not listed defaults to CEFR.
const FRAMEWORK_BY_LANG: Record<string, Framework> = {
    ja: JLPT,
    zh: HSK,
};

function getFramework(targetLang: string): Framework {
    return FRAMEWORK_BY_LANG[targetLang] ?? CEFR;
}

// ─── Types ───────────────────────────────────────────────────────────

interface WordEntry {
    word: string;
    translation: string;
    level: number;
    exampleSentence: string;
    partOfSpeech: string;
}

// ─── OpenAI API Call ─────────────────────────────────────────────────

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AZURE_API_KEY;
    let baseUrl = process.env.OPENAI_BASE_URL || process.env.AZURE_BASE_URL || 'https://api.openai.com/v1/chat/completions';
    
    if (baseUrl.endsWith('/responses')) {
        baseUrl = baseUrl.replace(/\/responses$/, '/chat/completions');
    }
    
    if (!apiKey) throw new Error('API key not set. Define OPENAI_API_KEY or AZURE_API_KEY environment variable. If using Azure, also define AZURE_BASE_URL.');

    const isAzure = baseUrl.includes('azure.com');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (isAzure) {
        headers['api-key'] = apiKey;
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const payload: any = {
        model: process.env.MODEL_NAME || 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
    };
    
    if (isAzure) {
        payload.max_completion_tokens = 4096;
    } else {
        payload.max_tokens = 4096;
    }

    const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// ─── Word Generation ─────────────────────────────────────────────────

async function generateBatch(
    targetLang: string,
    nativeLang: string,
    level: number,
    existingWords: Set<string>,
    count: number,
): Promise<WordEntry[]> {
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
    const nativeName = LANGUAGE_NAMES[nativeLang] || nativeLang;
    const fw = getFramework(targetLang);
    const levelLabel = fw.labels[level - 1] ?? `L${level}`;
    const needsTransliteration = targetLang === 'ja' || targetLang === 'zh';

    const systemPrompt = `You are a vocabulary curriculum expert and lexicographer for ${targetName}. You build vocabulary lists STRICTLY calibrated to ${fw.name}, the most widely used proficiency framework for ${targetName}, using ${fw.references}. You output only precisely formatted JSON, and always give accurate ${nativeName} translations.`;

    const existingList = existingWords.size > 0
        ? `\n\nEXCLUSION LIST — do NOT include any of these (already generated): ${Array.from(existingWords).slice(-200).join(', ')}`
        : '';

    const prompt = `Generate exactly ${count} ${targetName} vocabulary words for a ${nativeName}-speaking learner at ${fw.name} level ${levelLabel} (internal level ${level} of 6).

CALIBRATION — ${fw.name} ${levelLabel}: ${LEVEL_DESCRIPTIONS[level]}
Every word must genuinely belong to ${fw.name} ${levelLabel} for ${targetName}. Calibrate strictly by ${fw.references} and corpus frequency — no harder or easier words.

RULES:
- ASYMMETRIC LANGUAGE: "word" and "exampleSentence" are ALWAYS in ${targetName}; "translation" is ALWAYS in ${nativeName}. Never swap or mix.
- Write "word" in ${targetName}'s native script.${needsTransliteration ? ` For ${targetName}, also add romaji/pinyin in parentheses inside "translation".` : ''}
- Cover a broad mix of everyday topics (greetings, daily life, food, family, work, travel, health, nature, emotions), with a healthy share of verbs and adjectives.
- The example sentence must be natural, grammatical, and must NOT exceed ${levelLabel} grammar complexity.
- partOfSpeech (lowercase): noun, verb, adjective, adverb, pronoun, preposition, conjunction, interjection, phrase.
- Each word must be unique.${existingList}

Return ONLY a JSON array (no markdown, no explanation):
[{"word":"...","translation":"...","level":${level},"exampleSentence":"...","partOfSpeech":"noun"}]`;

    const response = await callOpenAI(prompt, systemPrompt);

    // Parse JSON from response
    try {
        const match = response.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array found in response');
        const words: WordEntry[] = JSON.parse(match[0]);
        // Validate and clean
        return words
            .filter((w) => w.word && w.translation && !existingWords.has(w.word.toLowerCase()))
            .map((w) => ({
                word: w.word.trim(),
                translation: w.translation.trim(),
                level,
                exampleSentence: w.exampleSentence?.trim() || '',
                partOfSpeech: w.partOfSpeech?.trim() || '',
            }));
    } catch (err) {
        console.error(`  Failed to parse batch response:`, (err as Error).message);
        console.error(`  Response preview: ${response.substring(0, 200)}`);
        return [];
    }
}

async function generateLevel(
    targetLang: string,
    nativeLang: string,
    level: number,
    existingWords: WordEntry[],
): Promise<WordEntry[]> {
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
    const existing = new Set(existingWords.map((w) => w.word.toLowerCase()));
    const levelWords: WordEntry[] = existingWords.filter((w) => w.level === level);
    const needed = WORDS_PER_LEVEL - levelWords.length;

    if (needed <= 0) {
        console.log(`  Level ${level}: Already has ${levelWords.length} words, skipping.`);
        return [];
    }

    console.log(`  Level ${level}: Need ${needed} more words (have ${levelWords.length})`);

    const newWords: WordEntry[] = [];
    let remaining = needed;

    while (remaining > 0) {
        const batchCount = Math.min(BATCH_SIZE, remaining);
        console.log(`    Generating batch of ${batchCount} ${targetName} words...`);

        const batch = await generateBatch(targetLang, nativeLang, level, existing, batchCount);
        for (const word of batch) {
            if (!existing.has(word.word.toLowerCase())) {
                existing.add(word.word.toLowerCase());
                newWords.push(word);
            }
        }

        remaining = needed - newWords.length;

        // Safety: if we got no new words 3 times, stop
        if (batch.length === 0) {
            console.log(`    Warning: Empty batch, stopping level ${level}`);
            break;
        }

        // Rate limit: wait 1s between batches
        if (remaining > 0) {
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    console.log(`  Level ${level}: Generated ${newWords.length} new words`);
    return newWords;
}

// ─── File I/O ────────────────────────────────────────────────────────

function loadExisting(targetLang: string, nativeLang: string): WordEntry[] {
    const filePath = path.join(process.cwd(), 'assets', 'wordlists', targetLang, `${nativeLang}.json`);
    if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Array.isArray(data) ? data : [];
    }
    return [];
}

function saveWordlist(targetLang: string, nativeLang: string, words: WordEntry[]): void {
    const dir = path.join(process.cwd(), 'assets', 'wordlists', targetLang);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${nativeLang}.json`);
    // Sort by level then alphabetically
    words.sort((a, b) => a.level - b.level || a.word.localeCompare(b.word));
    fs.writeFileSync(filePath, JSON.stringify(words, null, 2));
    console.log(`\nSaved ${words.length} words to ${filePath}`);
}

function updateIndex(): void {
    const wordlistsDir = path.join(process.cwd(), 'assets', 'wordlists');
    const index: { version: number; pairs: { target: string; native: string; wordCount: number; levels: number[] }[] } = {
        version: 1,
        pairs: [],
    };

    if (!fs.existsSync(wordlistsDir)) {
        fs.mkdirSync(wordlistsDir, { recursive: true });
    }

    const targets = fs.readdirSync(wordlistsDir).filter((f) => {
        const stat = fs.statSync(path.join(wordlistsDir, f));
        return stat.isDirectory();
    });

    for (const target of targets) {
        const targetDir = path.join(wordlistsDir, target);
        const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.json'));
        for (const file of files) {
            const native = file.replace('.json', '');
            const data = JSON.parse(fs.readFileSync(path.join(targetDir, file), 'utf-8'));
            const words: WordEntry[] = Array.isArray(data) ? data : [];
            const levels = [...new Set(words.map((w) => w.level))].sort();
            index.pairs.push({
                target,
                native,
                wordCount: words.length,
                levels,
            });
        }
    }

    fs.writeFileSync(path.join(wordlistsDir, 'index.json'), JSON.stringify(index, null, 4));
    console.log('Updated index.json');
}

// ─── CLI ─────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const targetIdx = args.indexOf('--target');
    const nativeIdx = args.indexOf('--native');
    const levelIdx = args.indexOf('--level');
    const allLevels = args.includes('--all-levels');

    if (targetIdx === -1 || nativeIdx === -1) {
        console.log('Usage:');
        console.log('  npx ts-node scripts/generate-wordlist.ts --target de --native tr --level 1');
        console.log('  npx ts-node scripts/generate-wordlist.ts --target ja --native tr --all-levels');
        process.exit(1);
    }

    const targetLang = args[targetIdx + 1];
    const nativeLang = args[nativeIdx + 1];
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
    const nativeName = LANGUAGE_NAMES[nativeLang] || nativeLang;

    console.log(`\nGenerating ${targetName} wordlist for ${nativeName} speakers\n`);

    const existing = loadExisting(targetLang, nativeLang);
    console.log(`Existing words: ${existing.length}`);

    const levels = allLevels
        ? [1, 2, 3, 4, 5, 6]
        : levelIdx !== -1
            ? [parseInt(args[levelIdx + 1], 10)]
            : [1];

    let allWords = [...existing];

    for (const level of levels) {
        const newWords = await generateLevel(targetLang, nativeLang, level, allWords);
        allWords = [...allWords, ...newWords];
    }

    saveWordlist(targetLang, nativeLang, allWords);
    updateIndex();

    console.log(`\nDone! Total: ${allWords.length} words`);
}

main().catch(console.error);
