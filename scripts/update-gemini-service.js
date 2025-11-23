/**
 * Script to update geminiService.ts with dynamic language support
 * Replaces hardcoded "Native" and "Learning" with dynamic language names
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../services/geminiService.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replacements mapping
const replacements = [
    // Schema descriptions
    { from: "'The phrase in Learning.'", to: "`The phrase in ${getLang().learning}.`" },
    { from: "'The phrase in Native.'", to: "`The phrase in ${getLang().native}.`" },
    { from: "'The translated phrase in Learning.'", to: "`The translated phrase in ${getLang().learning}.`" },
    { from: "'The translated phrase in Native.'", to: "`The translated phrase in ${getLang().native}.`" },
    { from: "'The example sentence in Learning.'", to: "`The example sentence in ${getLang().learning}.`" },
    { from: "'The Native translation.'", to: "`The ${getLang().native} translation.`" },
    { from: "'Native translation of the text, ONLY if type is \\'learning\\'.'", to: "`${getLang().native} translation of the text, ONLY if type is 'learning'.`" },
    { from: "'The Native translation of the example sentence.'", to: "`The ${getLang().native} translation of the example sentence.`" },
    { from: "'The native (e.g., Native) translation of the movie title.'", to: "`The native (${getLang().native}) translation of the movie title.`" },
    { from: "'The exact dialogue snippet in the learning language (Learning) containing the phrase.'", to: "`The exact dialogue snippet in the learning language (${getLang().learning}) containing the phrase.`" },
    { from: "'The native (e.g., Native) translation of the dialogue snippet.'", to: "`The native (${getLang().native}) translation of the dialogue snippet.`" },
    { from: "'The Native translation of the word.'", to: "`The ${getLang().native} translation of the word.`" },
    { from: "'A new example sentence in Learning using the word.'", to: "`A new example sentence in ${getLang().learning} using the word.`" },
    { from: "'The full example sentence in Learning for this pronoun.'", to: "`The full example sentence in ${getLang().learning} for this pronoun.`" },
    { from: "'The Native translation of the Learning sentence.'", to: "`The ${getLang().native} translation of the ${getLang().learning} sentence.`" },
    { from: "'The correct Learning translation of the provided Native phrase.'", to: "`The correct ${getLang().learning} translation of the provided ${getLang().native} phrase.`" },
    { from: "'Constructive feedback in Native.'", to: "`Constructive feedback in ${getLang().native}.`" },
    { from: "\"Reason in Native.\"", to: "`Reason in ${getLang().native}.`" },
    { from: "'Reason in Native.'", to: "`Reason in ${getLang().native}.`" },

    // Prompt text replacements - these are more complex
    { from: 'Translate this Native phrase to Learning:', to: '`Translate this ${getLang().native} phrase to ${getLang().learning}:`' },
    { from: 'Translate this Learning phrase to Native:', to: '`Translate this ${getLang().learning} phrase to ${getLang().native}:`' },
    { from: 'native" for the Native translation', to: '${getLang().nativeCode}" for the ${getLang().native} translation' },
    { from: 'learning" for the translation', to: '${getLang().learningCode}" for the translation' },
    { from: 'into a common, natural-sounding Learning phrase:', to: 'into a common, natural-sounding ${getLang().learning} phrase:' },
    { from: 'Native phrase into a common', to: '${getLang().native} phrase into a common' },
    { from: 'You are a friendly and patient Learning language tutor', to: '`You are a friendly and patient ${getLang().learning} language tutor`' },
    { from: 'all the Learning phrases the student is learning', to: 'all the ${getLang().learning} phrases the student is learning' },
    { from: 'greet the student in Learning', to: 'greet the student in ${getLang().learning}' },
    { from: "if the student's Learning has errors", to: "if the student's ${getLang().learning} has errors" },
    { from: 'provide the corrected Learning sentence', to: 'provide the corrected ${getLang().learning} sentence' },
    { from: 'short and simple explanation for the correction **in Native**', to: '**in ${getLang().native}**' },
    { from: 'Keep it Learning:', to: '`Keep it ${getLang().learning}:`' },
    { from: 'Your main conversational responses should be in Learning. Only use Native for explanations', to: 'Your main conversational responses should be in ${getLang().learning}. Only use ${getLang().native} for explanations' },
    { from: "'text' for Native explanations, 'learning'", to: "'text' for ${getLang().native} explanations, 'learning'" },
    { from: "for your Learning conversational response", to: "for your ${getLang().learning} conversational response" },
    { from: "'learning' for your Learning conversational response", to: "'learning' for your ${getLang().learning} conversational response" },
    { from: "with Native explanations of corrections", to: "with ${getLang().native} explanations of corrections" },
    { from: "short, relevant Learning phrases the user could say next", to: "short, relevant ${getLang().learning} phrases the user could say next" },
];

console.log(`Updating ${filePath}...`);
console.log(`File size before: ${content.length} characters`);

let changeCount = 0;
replacements.forEach((replacement, index) => {
    const before = content.length;
    content = content.replace(new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement.to);
    const after = content.length;
    if (before !== after) {
        changeCount++;
        console.log(`✅ Applied replacement ${index + 1}: ${replacement.from.substring(0, 50)}...`);
    }
});

console.log(`\nApplied ${changeCount} replacements`);
console.log(`File size after: ${content.length} characters`);

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✅ File updated successfully!`);
console.log(`\n⚠️  NOTE: You must manually review and test the changes.`);
console.log(`Some complex replacements may need manual adjustment.`);
