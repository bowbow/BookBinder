#!/usr/bin/env node
/**
 * Parse markdown files to extract level 2 headings and process list items.
 */

import * as fs from 'fs';
import * as path from 'path';

function findMarkdownFile(rootFolder: string, filename: string): string | null {
    /**
     * Find a markdown file in the root folder (searches recursively).
     */
    // Add .md extension if not present
    if (!filename.endsWith('.md')) {
        filename = `${filename}.md`;
    }

    // First check root folder
    const filePath = path.join(rootFolder, filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return filePath;
    }

    // Search recursively in subdirectories
    function searchDir(dir: string): string | null {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    const result = searchDir(fullPath);
                    if (result) return result;
                } else if (entry.isFile() && entry.name === filename) {
                    return fullPath;
                }
            }
        } catch (e) {
            // Skip directories we can't read
        }
        return null;
    }

    return searchDir(rootFolder);
}

function extractWikilink(text: string): { linkTarget: string; isWikilink: boolean } {
    /**
     * Extract wikilink from text if present.
     */
    const match = text.trim().match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    if (match) {
        return { linkTarget: match[1], isWikilink: true };
    }
    return { linkTarget: text, isWikilink: false };
}

function readFileContents(filePath: string): string {
    /**
     * Read the full contents of a file.
     */
    try {
        return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (e) {
        return `[Error reading file: ${e}]`;
    }
}

function extractListItemsByHeading(filePath: string): Array<{ heading: string; items: string[] }> {
    /**
     * Extract list items under each level 2 heading from a markdown file.
     */
    const headingsWithItems: Array<{ heading: string; items: string[] }> = [];
    let currentHeading: string | null = null;
    let currentItems: string[] = [];

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const strippedLine = line.trim();

        // Check if this is a level 2 heading
        if (strippedLine.startsWith('##') && (strippedLine.length === 2 || strippedLine[2] === ' ')) {
            // Save previous heading and its items if they exist
            if (currentHeading !== null) {
                headingsWithItems.push({ heading: currentHeading, items: currentItems });
            }

            // Start new heading (handle both '## text' and '##')
            if (strippedLine.length > 2) {
                currentHeading = strippedLine.substring(3).trim();
            } else {
                currentHeading = '';
            }
            currentItems = [];
        }
        // Check if this is a list item (starts with - or *)
        else if (currentHeading !== null && (strippedLine.startsWith('- ') || strippedLine.startsWith('* '))) {
            // Extract list item text (remove leading - or * and whitespace)
            const itemText = strippedLine.substring(2).trim();
            currentItems.push(itemText);
        }
    }

    // Don't forget to add the last heading
    if (currentHeading !== null) {
        headingsWithItems.push({ heading: currentHeading, items: currentItems });
    }

    return headingsWithItems;
}

function findAllMarkdownFilesInFolder(folderPath: string): string[] {
    /**
     * Find all markdown files in a folder (non-recursive) and return them in alphabetical order.
     */
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return [];
    }

    // Get all .md files in the folder (not recursive)
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const mdFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
        .map(entry => path.join(folderPath, entry.name));

    // Sort alphabetically by filename
    mdFiles.sort((a, b) => path.basename(a).toLowerCase().localeCompare(path.basename(b).toLowerCase()));

    return mdFiles;
}

function countWordsInMarkdown(text: string): number {
    /**
     * Count words in markdown text, excluding markdown syntax.
     */
    // Remove wikilinks (keep empty since they're just navigation)
    text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '');

    // Remove code fence markers but keep the content inside
    text = text.replace(/^```[^\n]*$/gm, '');

    // Remove inline code markers but keep content
    text = text.replace(/`/g, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Remove markdown links but keep the text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // [text](url) -> text

    // Remove images
    text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');

    // Remove markdown heading markers
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Remove list markers
    text = text.replace(/^[-*+]\s+/gm, '');
    text = text.replace(/^\d+\.\s+/gm, '');

    // Remove other markdown formatting characters
    text = text.replace(/[*_~]/g, '');

    // Remove extra whitespace and split into words
    const words = text.split(/\s+/).filter(word => word.length > 0);

    return words.length;
}

function parseFiles(inputArg: string, rootFolder: string, finalMode: boolean): { output: string; wordCount: number } {
    /**
     * Parse markdown files and extract content from wikilinks.
     * 
     * @param inputArg - Filename or folder name to process
     * @param rootFolder - Root folder to search for files
     * @param finalMode - If true, output without separators and links
     * @returns Object with output string and word count
     */
    // Check if inputArg is a folder or a filename
    const inputPath = path.join(rootFolder, inputArg);

    let filesToProcess: string[] = [];

    // First check if it's an existing directory
    if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
        // It's a folder - process all markdown files in it
        const mdFiles = findAllMarkdownFilesInFolder(inputPath);
        if (mdFiles.length === 0) {
            throw new Error(`No markdown files found in folder '${inputArg}'`);
        }
        filesToProcess = mdFiles;
    } else {
        // Treat as a filename - find the single file
        const filePath = findMarkdownFile(rootFolder, inputArg);
        if (filePath === null) {
            // Also check if inputArg itself is an absolute path to a directory
            if (fs.existsSync(inputArg) && fs.statSync(inputArg).isDirectory()) {
                const mdFiles = findAllMarkdownFilesInFolder(inputArg);
                if (mdFiles.length === 0) {
                    throw new Error(`No markdown files found in folder '${inputArg}'`);
                }
                filesToProcess = mdFiles;
            } else {
                throw new Error(`File or folder '${inputArg}' not found`);
            }
        } else {
            filesToProcess = [filePath];
        }
    }

    // Collect all output in a buffer and track content for word counting
    let outputBuffer = '';
    let wordCountBuffer = '';

    // Process each file
    for (const filePath of filesToProcess) {
        const headingsWithItems = extractListItemsByHeading(filePath);

        if (headingsWithItems.length > 0) {
            for (const { heading, items } of headingsWithItems) {
                if (items.length > 0) {
                    for (let item of items) {
                        // Remove checkbox markers like [ ] or [x]
                        if (item.startsWith('[ ] ')) {
                            item = item.substring(4);
                        } else if (item.startsWith('[x] ') || item.startsWith('[X] ')) {
                            item = item.substring(4);
                        }

                        // Check if this is a wikilink
                        const { linkTarget, isWikilink } = extractWikilink(item);

                        if (isWikilink) {
                            // Try to find and read the linked file
                            const linkedFile = findMarkdownFile(rootFolder, linkTarget);
                            if (linkedFile) {
                                const content = readFileContents(linkedFile);

                                if (finalMode) {
                                    // Final mode: just content, no separators or links
                                    outputBuffer += content + '\n';
                                } else {
                                    // Normal mode: with horizontal rule separator and link
                                    outputBuffer += '---\n\n';
                                    outputBuffer += `[[${linkTarget}]]\n\n`;
                                    outputBuffer += content + '\n\n';
                                }

                                // Also write to word count buffer (only wikilink content counts)
                                wordCountBuffer += content + '\n';
                            } else {
                                outputBuffer += `[Link not found: ${linkTarget}]\n`;
                            }
                        } else {
                            // Write the raw text to output only (don't count it)
                            outputBuffer += item + '\n';
                            if (!finalMode) {
                                outputBuffer += '\n';
                            }
                        }
                    }
                }
            }
        }
    }

    // Count words only from wikilink content
    const wordCount = countWordsInMarkdown(wordCountBuffer);

    return { output: outputBuffer, wordCount };
}

function main() {
    /**
     * Main function to parse command line arguments.
     */
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log("Usage: node parse2.js <filename_or_folder> [root_folder] [--final]");
        console.log("Example: node parse2.js 'kanban 1'");
        console.log("Example: node parse2.js 'my_folder'");
        console.log("Example: node parse2.js 'my_folder' . --final");
        process.exit(1);
    }

    const inputArg = args[0];
    const finalMode = args.includes('--final');
    const argsWithoutFlag = args.slice(1).filter(arg => arg !== '--final');
    const rootFolder = argsWithoutFlag.length > 0 ? argsWithoutFlag[0] : '.';

    try {
        const { output, wordCount } = parseFiles(inputArg, rootFolder, finalMode);
        console.log(`Word Count: ${wordCount}`);
        process.stdout.write(output);
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    }
}

main();
