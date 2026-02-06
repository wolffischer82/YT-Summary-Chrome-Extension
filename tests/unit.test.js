const { formatMarkdown } = require('../src/sidepanel/sidepanel.js');

describe('Markdown Formatter', () => {
    test('converts headers', () => {
        expect(formatMarkdown('# Header 1')).toBe('<h1>Header 1</h1>');
        expect(formatMarkdown('## Header 2')).toBe('<h2>Header 2</h2>');
        expect(formatMarkdown('### Header 3')).toBe('<h3>Header 3</h3>');
    });

    test('converts bold text', () => {
        expect(formatMarkdown('**bold**')).toBe('<strong>bold</strong>');
    });

    test('converts italic text', () => {
        expect(formatMarkdown('*italic*')).toBe('<em>italic</em>');
    });

    test('converts lists', () => {
        expect(formatMarkdown('- Item 1')).toBe('<li>Item 1</li>');
    });

    test('converts newlines to br', () => {
        expect(formatMarkdown('Line 1\nLine 2')).toBe('Line 1<br>Line 2');
    });
});
