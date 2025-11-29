# Bookbinder

An Obsidian plugin that compiles linked notes from folders into cohesive manuscripts and books.

## How to build and run the plugin whilst developing it

1. **Install dependencies:**
   ```bash
   cd .obsidian/plugins/bookbinder
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   This will watch for changes and automatically recompile the plugin as you edit `main.ts`.

3. **Reload the plugin in Obsidian:**
   - After the dev server compiles your changes, reload the plugin in Obsidian
   - Open Command Palette (Cmd+Shift+P) → "Reload app without saving"
   - Or disable and re-enable the plugin in Settings → Community plugins

4. **View console output:**
   - Open Developer Tools: View → Toggle Developer Tools (Cmd+Option+I)
   - Check the Console tab for logs and errors

## How to build and publish the plugin

1. **Build the production version:**
   ```bash
   cd .obsidian/plugins/bookbinder
   npm run build
   ```
   This creates an optimized `main.js` file.

2. **Use the publish script (recommended):**
   ```bash
   ./publish.sh
   ```
   This script automatically builds the plugin and copies the necessary files (`main.js`, `manifest.json`, `styles.css`) to the `PublishedVersions/` directory.

3. **Install in another vault:**
   - Copy the contents of `PublishedVersions/` to `<target-vault>/.obsidian/plugins/bookbinder/`
   - Restart Obsidian or reload the vault
   - Enable the plugin in Settings → Community plugins

## Using the plugin

### Setting up your book folder

1. **Configure the plugin:**
   - Go to Settings → Bookbinder
   - Set "Folder to examine" to your book folder name (e.g., "Sample book")
   - Toggle "Final mode" if you want clean output by default

2. **Organize your content:**
   The plugin works with markdown files containing level 2 headings (`##`) and list items. For example:

   **Sample book/Act 1.md:**
   ```markdown
   ## Scene 1
   - [[sc1]]
   - [[parking up]]
   
   ## Scene 2
   - [[Sc2]]
   ```

   Each wikilink (`[[sc1]]`, `[[parking up]]`, etc.) points to another markdown file whose content will be included in the compiled output.

### Compiling your book

There are three ways to compile your book:

1. **Click the book icon** in the left sidebar (uses your default final mode setting)

2. **Use keyboard shortcuts:**
   - **Cmd+Shift+B** (Draft mode): Includes horizontal rule separators and shows wikilink labels
   - **Cmd+Option+B** (Final mode): Clean output with no separators or wikilink labels

3. **Use the Command Palette:**
   - Press Cmd+Shift+P
   - Search for "Parse book folder" or "Bind book (final)"

### Output

The plugin creates a new markdown file named after your folder (e.g., `Sample book.md`) containing:
- Word count at the top
- All content from the list items under level 2 headings
- Content from all wikilinked files
- In draft mode: visual separators (`---`) between sections
- In final mode: clean, continuous text ready for export or publishing

### Example workflow

1. Create a folder called "Sample book"
2. Add a main file (e.g., "Act 1.md") with level 2 headings and wikilinked list items
3. Create separate markdown files for each scene or section
4. Press **Cmd+Shift+B** to review your compiled draft
5. Press **Cmd+Option+B** to generate the final, clean version
6. Find your compiled book in `Sample book.md`

## Features

- **Parse book folders:** Compiles markdown files with level 2 headings and list items
- **Follow wikilinks:** Automatically includes content from linked notes
- **Word count:** Tracks total word count across all compiled content
- **Two compilation modes:**
  - **Draft mode** (Cmd+Shift+B): Includes separators and wikilink labels for review
  - **Final mode** (Cmd+Option+B): Clean output ready for publishing
- **Configurable settings:** Set your book folder and default compilation mode
