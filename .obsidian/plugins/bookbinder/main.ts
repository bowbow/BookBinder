import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

interface BookbinderSettings {
	folderToExamine: string;
	finalMode: boolean;
}

// Helper functions from parse2.ts

function extractWikilink(text: string): { linkTarget: string; isWikilink: boolean } {
	const match = text.trim().match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
	if (match) {
		return { linkTarget: match[1], isWikilink: true };
	}
	return { linkTarget: text, isWikilink: false };
}

function extractListItemsByHeading(content: string): Array<{ heading: string; items: string[] }> {
	const headingsWithItems: Array<{ heading: string; items: string[] }> = [];
	let currentHeading: string | null = null;
	let currentItems: string[] = [];

	const lines = content.split('\n');

	for (const line of lines) {
		const strippedLine = line.trim();

		if (strippedLine.startsWith('##') && (strippedLine.length === 2 || strippedLine[2] === ' ')) {
			if (currentHeading !== null) {
				headingsWithItems.push({ heading: currentHeading, items: currentItems });
			}

			if (strippedLine.length > 2) {
				currentHeading = strippedLine.substring(3).trim();
			} else {
				currentHeading = '';
			}
			currentItems = [];
		}
		else if (currentHeading !== null && (strippedLine.startsWith('- ') || strippedLine.startsWith('* '))) {
			const itemText = strippedLine.substring(2).trim();
			currentItems.push(itemText);
		}
	}

	if (currentHeading !== null) {
		headingsWithItems.push({ heading: currentHeading, items: currentItems });
	}

	return headingsWithItems;
}

function countWordsInMarkdown(text: string): number {
	text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '');
	text = text.replace(/^```[^\n]*$/gm, '');
	text = text.replace(/`/g, '');
	text = text.replace(/<[^>]+>/g, '');
	text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
	text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');
	text = text.replace(/^#{1,6}\s+/gm, '');
	text = text.replace(/^[-*+]\s+/gm, '');
	text = text.replace(/^\d+\.\s+/gm, '');
	text = text.replace(/[*_~]/g, '');

	const words = text.split(/\s+/).filter(word => word.length > 0);
	return words.length;
}

const DEFAULT_SETTINGS: BookbinderSettings = {
	folderToExamine: 'Sample book',
	finalMode: false
}

export default class BookbinderPlugin extends Plugin {
	settings: BookbinderSettings;

	async parseFiles(inputArg: string, finalMode: boolean): Promise<{ output: string; wordCount: number }> {
		const vault = this.app.vault;
		const vaultRoot = vault.getRoot();

		let filesToProcess: TFile[] = [];

		// Check if inputArg is a folder or filename
		const abstractFile = vault.getAbstractFileByPath(inputArg);

		if (abstractFile instanceof TFolder) {
			// It's a folder - get all markdown files
			const mdFiles = vault.getMarkdownFiles().filter(f => f.path.startsWith(inputArg + '/'));
			if (mdFiles.length === 0) {
				throw new Error(`No markdown files found in folder '${inputArg}'`);
			}
			// Sort alphabetically
			mdFiles.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
			filesToProcess = mdFiles;
		} else {
			// Try to find a single file
			let filename = inputArg;
			if (!filename.endsWith('.md')) {
				filename = `${filename}.md`;
			}

			const file = vault.getMarkdownFiles().find(f => f.name === filename || f.path === filename);
			if (!file) {
				throw new Error(`File '${inputArg}' not found`);
			}
			filesToProcess = [file];
		}

		let outputBuffer = '';
		let wordCountBuffer = '';

		// Process each file
		for (const file of filesToProcess) {
			const content = await vault.read(file);
			const headingsWithItems = extractListItemsByHeading(content);

			if (headingsWithItems.length > 0) {
				for (const { heading, items } of headingsWithItems) {
					if (items.length > 0) {
						for (let item of items) {
							// Remove checkbox markers
							if (item.startsWith('[ ] ')) {
								item = item.substring(4);
							} else if (item.startsWith('[x] ') || item.startsWith('[X] ')) {
								item = item.substring(4);
							}

							const { linkTarget, isWikilink } = extractWikilink(item);

							if (isWikilink) {
								// Find and read the linked file
								let linkedFile = vault.getMarkdownFiles().find(f =>
									f.basename === linkTarget || f.name === linkTarget + '.md'
								);

								if (linkedFile) {
									const linkedContent = await vault.read(linkedFile);

									if (finalMode) {
										outputBuffer += linkedContent.trim() + '\n';
									} else {
										outputBuffer += '---\n\n';
										outputBuffer += `[[${linkTarget}]]\n\n`;
										outputBuffer += linkedContent.trim() + '\n\n';
									}

									wordCountBuffer += linkedContent + '\n';
								} else {
									outputBuffer += `[Link not found: ${linkTarget}]\n`;
								}
							} else {
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

		const wordCount = countWordsInMarkdown(wordCountBuffer);
		return { output: outputBuffer, wordCount };
	}

	async onload() {
		console.log("Entering onload() function1");
		await this.loadSettings();
		console.log("Entering onload() function");
		const files = this.app.vault.getMarkdownFiles()
		console.log("I found ", files.length, " markdown files:");
		for (let i = 0; i < files.length; i++) {
			console.log(files[i].path);
		}


		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('book-open', 'Bind the files to make a book', async (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			console.log('Book icon clicked!');

			try {
				// Parse the configured folder when user clicks the book icon
				const folderToExamine = this.settings.folderToExamine || 'Sample book';
				const result = await this.parseFiles(folderToExamine, this.settings.finalMode);

				// Log the output to console
				console.log('Parse output:', result.output);
				console.log('Word count:', result.wordCount);

				// Create a new file with the output - use folder name as filename
				const outputFileName = `${folderToExamine}.md`;
				const existingFile = this.app.vault.getAbstractFileByPath(outputFileName);

				const outputContent = `Word Count: ${result.wordCount}\n${result.output}`;

				if (existingFile) {
					await this.app.vault.modify(existingFile as TFile, outputContent);
				} else {
					await this.app.vault.create(outputFileName, outputContent);
				}

				// No notice on success - output is logged to console
			} catch (error) {
				new Notice(`Error: ${error.message}`);
				console.error('Parse error:', error);
			}
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Add CSS to color the icon green
		const style = document.createElement('style');
		style.textContent = `
			.my-plugin-ribbon-class {
				color: #22c55e !important;
			}
		`;
		document.head.appendChild(style);

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a command to parse the book folder (can be mapped to keyboard shortcut)
		this.addCommand({
			id: 'parse-book-folder',
			name: 'Parse book folder',
			callback: async () => {
				try {
					// Parse the configured folder
					const folderToExamine = this.settings.folderToExamine || 'Sample book';
					const result = await this.parseFiles(folderToExamine, this.settings.finalMode);

					// Log the output to console
					console.log('Parse output:', result.output);
					console.log('Word count:', result.wordCount);

					// Create a new file with the output - use folder name as filename
					const outputFileName = `${folderToExamine}.md`;
					const existingFile = this.app.vault.getAbstractFileByPath(outputFileName);

					const outputContent = `Word Count: ${result.wordCount}\n${result.output}`;

					if (existingFile) {
						await this.app.vault.modify(existingFile as TFile, outputContent);
					} else {
						await this.app.vault.create(outputFileName, outputContent);
					}

					// No notice on success - output is logged to console
				} catch (error) {
					new Notice(`Error: ${error.message}`);
					console.error('Parse error:', error);
				}
			}
		});

		// This adds a command to parse the book folder in final mode
		this.addCommand({
			id: 'parse-book-folder-final',
			name: 'Bind book (final)',
			callback: async () => {
				try {
					new Notice('Binding book in final mode...');
					// Parse the configured folder with finalMode=true
					const folderToExamine = this.settings.folderToExamine || 'Sample book';
					const result = await this.parseFiles(folderToExamine, true);

					// Log the output to console
					console.log('Parse output:', result.output);
					console.log('Word count:', result.wordCount);

					// Create a new file with the output - use folder name as filename
					const outputFileName = `${folderToExamine}.md`;
					const existingFile = this.app.vault.getAbstractFileByPath(outputFileName);

					const outputContent = `Word Count: ${result.wordCount}\n${result.output}`;

					if (existingFile) {
						await this.app.vault.modify(existingFile as TFile, outputContent);
					} else {
						await this.app.vault.create(outputFileName, outputContent);
					}

					// No notice on success - output is logged to console
				} catch (error) {
					new Notice(`Error: ${error.message}`);
					console.error('Parse error:', error);
				}
			}
		});

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new BookbinderSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click detected', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class BookbinderSettingTab extends PluginSettingTab {
	plugin: BookbinderPlugin;

	constructor(app: App, plugin: BookbinderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Folder to examine')
			.setDesc('The folder containing markdown files to parse (e.g., "Sample book")')
			.addText(text => text
				.setPlaceholder('Sample book')
				.setValue(this.plugin.settings.folderToExamine)
				.onChange(async (value) => {
					this.plugin.settings.folderToExamine = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Final mode')
			.setDesc('When enabled, output will have no separators, links, or extra spacing')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.finalMode)
				.onChange(async (value) => {
					this.plugin.settings.finalMode = value;
					await this.plugin.saveSettings();
				}));
	}
}
