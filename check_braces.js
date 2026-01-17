const fs = require('fs');

const content = fs.readFileSync('d:/Scripts/RefBoard/src/App.tsx', 'utf8');

let stack = [];
let lines = content.split('\n');

const MATCH = {
    '{': '}',
    '(': ')',
    '[': ']'
};

for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (MATCH[char]) {
        stack.push({ char, index: i });
    } else if (Object.values(MATCH).includes(char)) {
        if (stack.length === 0) {
            const lineNum = content.substring(0, i).split('\n').length;
            console.log(`Extra '${char}' at line ${lineNum}`);
            // process.exit(1); 
            // Don't exit, just log to see all issues
        } else {
            const last = stack[stack.length - 1];
            if (MATCH[last.char] !== char) {
                const lineNum = content.substring(0, i).split('\n').length;
                const lastLineNum = content.substring(0, last.index).split('\n').length;
                console.log(`Mismatched '${char}' at line ${lineNum}. Expected '${MATCH[last.char]}' for '${last.char}' from line ${lastLineNum}`);
                // Pop anyway to continue checking? Or stop?
                // Usually indicates fatal structure error.
                stack.pop();
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log(`Unclosed items count: ${stack.length}`);
    const last = stack[stack.length - 1];
    const lineNum = content.substring(0, last.index).split('\n').length;
    console.log(`Last unclosed '${last.char}' at line ${lineNum}`);
    console.log('Context:');
    console.log(lines[lineNum - 1]);
} else {
    console.log('All brackets balanced.');
}
