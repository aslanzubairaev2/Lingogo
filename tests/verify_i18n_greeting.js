const fs = require('fs');
const path = require('path');

const localesDir = path.join(process.cwd(), 'src', 'i18n');

const testCases = [
    { lng: 'en', key: 'practice.chat.greeting.text', expected: "Hello! Let's practice English!" },
    { lng: 'es', key: 'practice.chat.greeting.translation', expected: "¡Hola! ¡Practiquemos {{language}}!" },
    { lng: 'de', key: 'practice.chat.greeting.suggestions', expectedType: 'array' },
    { lng: 'ja', key: 'practice.chat.greeting.explanation', expected: "あなたの語彙のフレーズを使って自然な会話をします。始めましょう！" },
    { lng: 'ru', key: 'practice.chat.greeting.text', expected: "Привет! Давай практиковать русский!" },
    { lng: 'ar', key: 'practice.chat.greeting.explanation', expected: "سأجري محادثة طبيعية معك باستخدام عبارات من مفرداتك. لنبدأ!" },
];

function getNestedValue(obj, path) {
    return path.split('.').reduce((prev, curr) => prev ? prev[curr] : undefined, obj);
}

function run() {
    console.log('Verifying i18n greeting texts (direct JSON check)...');

    let passed = true;
    for (const test of testCases) {
        const filePath = path.join(localesDir, `${test.lng}.json`);
        if (!fs.existsSync(filePath)) {
            console.error(`FAILED: File not found ${filePath}`);
            passed = false;
            continue;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const json = JSON.parse(content);
            const result = getNestedValue(json, test.key);

            if (test.expectedType === 'array') {
                if (!Array.isArray(result)) {
                    console.error(`FAILED: ${test.lng} ${test.key} - Expected array, got ${typeof result}`);
                    passed = false;
                } else {
                    console.log(`PASSED: ${test.lng} ${test.key} (Array length: ${result.length})`);
                }
            } else if (result !== test.expected) {
                console.error(`FAILED: ${test.lng} ${test.key} - Expected "${test.expected}", got "${result}"`);
                passed = false;
            } else {
                console.log(`PASSED: ${test.lng} ${test.key}`);
            }
        } catch (e) {
            console.error(`FAILED: Error reading/parsing ${filePath}`, e);
            passed = false;
        }
    }

    if (passed) {
        console.log('All tests passed!');
        process.exit(0);
    } else {
        console.error('Some tests failed.');
        process.exit(1);
    }
}

run();
