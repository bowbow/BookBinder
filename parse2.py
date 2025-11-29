#!/usr/bin/env python3
"""
Parse markdown files to extract level 2 headings.
"""

import os
import sys
import re
from pathlib import Path
from io import StringIO


def find_markdown_file(root_folder, filename):
    """
    Find a markdown file in the root folder (searches recursively).
    
    Args:
        root_folder: Path to the root folder to search
        filename: Name of the file (without .md extension)
    
    Returns:
        Path to the file if found, None otherwise
    """
    # Add .md extension if not present
    if not filename.endswith('.md'):
        filename = f"{filename}.md"
    
    root_path = Path(root_folder)
    
    # First check root folder
    file_path = root_path / filename
    if file_path.exists() and file_path.is_file():
        return file_path
    
    # Search recursively in subdirectories
    for file_path in root_path.rglob(filename):
        if file_path.is_file():
            return file_path
    
    return None


def extract_wikilink(text):
    """
    Extract wikilink from text if present.
    
    Args:
        text: Text that may contain a wikilink like [[page]] or [[page|display]]
    
    Returns:
        Tuple of (link_target, has_wikilink) where link_target is the page name
        and has_wikilink is True if a wikilink was found
    """
    # Match [[link]] or [[link|display]]
    match = re.match(r'^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$', text.strip())
    if match:
        return match.group(1), True
    return text, False


def read_file_contents(file_path):
    """
    Read the full contents of a file.
    
    Args:
        file_path: Path to the file
    
    Returns:
        String contents of the file
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        return f"[Error reading file: {e}]"


def count_words_in_markdown(text):
    """
    Count words in markdown text, excluding markdown syntax.
    
    Args:
        text: Markdown text
    
    Returns:
        Number of words (excluding markdown syntax)
    """
    # Remove wikilinks (keep empty since they're just navigation)
    text = re.sub(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', '', text)
    
    # Remove code fence markers but keep the content inside
    text = re.sub(r'^```[^\n]*$', '', text, flags=re.MULTILINE)
    
    # Remove inline code markers but keep content
    text = re.sub(r'`', '', text)
    
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Remove markdown links but keep the text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # [text](url) -> text
    
    # Remove images
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)
    
    # Remove markdown heading markers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    
    # Remove list markers
    text = re.sub(r'^[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
    
    # Remove other markdown formatting characters
    text = re.sub(r'[*_~]', '', text)
    
    # Remove extra whitespace and split into words
    words = text.split()
    
    return len(words)


def extract_list_items_by_heading(file_path):
    """
    Extract list items under each level 2 heading from a markdown file.
    
    Args:
        file_path: Path to the markdown file
    
    Returns:
        List of tuples: (heading_text, list_items)
    """
    headings_with_items = []
    current_heading = None
    current_items = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            stripped_line = line.strip()
            
            # Check if this is a level 2 heading
            if stripped_line.startswith('##') and (len(stripped_line) == 2 or stripped_line[2] == ' '):
                # Save previous heading and its items if they exist
                if current_heading is not None:
                    headings_with_items.append((current_heading, current_items))
                
                # Start new heading (handle both '## text' and '##')
                if len(stripped_line) > 2:
                    current_heading = stripped_line[3:].strip()
                else:
                    current_heading = ''
                current_items = []
            
            # Check if this is a list item (starts with - or *)
            elif current_heading is not None and (stripped_line.startswith('- ') or stripped_line.startswith('* ')):
                # Extract list item text (remove leading - or * and whitespace)
                item_text = stripped_line[2:].strip()
                current_items.append(item_text)
        
        # Don't forget to add the last heading
        if current_heading is not None:
            headings_with_items.append((current_heading, current_items))
    
    return headings_with_items


def find_all_markdown_files_in_folder(folder_path):
    """
    Find all markdown files in a folder (non-recursive) and return them in alphabetical order.
    
    Args:
        folder_path: Path to the folder
    
    Returns:
        List of Path objects for markdown files, sorted alphabetically
    """
    folder = Path(folder_path)
    if not folder.exists() or not folder.is_dir():
        return []
    
    # Get all .md files in the folder (not recursive)
    md_files = [f for f in folder.glob('*.md') if f.is_file()]
    
    # Sort alphabetically by filename
    md_files.sort(key=lambda x: x.name.lower())
    
    return md_files


def main():
    """Main function to parse command line arguments and extract headings."""
    if len(sys.argv) < 2:
        print("Usage: python parse2.py <filename_or_folder> [root_folder] [--final]")
        print("Example: python parse2.py 'kanban 1'")
        print("Example: python parse2.py 'my_folder'")
        print("Example: python parse2.py 'my_folder' . --final")
        sys.exit(1)
    
    input_arg = sys.argv[1]
    
    # Check for --final flag
    final_mode = '--final' in sys.argv
    
    # Use provided root folder or default to current directory
    # Filter out the --final flag when looking for root_folder
    args_without_flag = [arg for arg in sys.argv[2:] if arg != '--final']
    root_folder = args_without_flag[0] if args_without_flag else '.'
    
    # Check if input_arg is a folder or a filename
    input_path = Path(root_folder) / input_arg
    
    # First check if it's an existing directory
    if input_path.exists() and input_path.is_dir():
        # It's a folder - process all markdown files in it
        md_files = find_all_markdown_files_in_folder(input_path)
        if not md_files:
            print(f"Error: No markdown files found in folder '{input_arg}'")
            sys.exit(1)
        files_to_process = md_files
    else:
        # Treat as a filename - find the single file
        file_path = find_markdown_file(root_folder, input_arg)
        if file_path is None:
            # Also check if input_arg itself is an absolute path to a directory
            abs_input = Path(input_arg)
            if abs_input.exists() and abs_input.is_dir():
                md_files = find_all_markdown_files_in_folder(abs_input)
                if not md_files:
                    print(f"Error: No markdown files found in folder '{input_arg}'")
                    sys.exit(1)
                files_to_process = md_files
            else:
                print(f"Error: File or folder '{input_arg}' not found")
                sys.exit(1)
        else:
            files_to_process = [file_path]
    
    # Collect all output in a buffer and track content for word counting
    output_buffer = StringIO()
    word_count_buffer = StringIO()  # Separate buffer for content to count
    
    # Process each file
    for file_path in files_to_process:
        # Extract list items under each level 2 heading
        headings_with_items = extract_list_items_by_heading(file_path)
        
        if headings_with_items:
            for heading, items in headings_with_items:
                if items:
                    for item in items:
                        # Remove checkbox markers like [ ] or [x]
                        cleaned_item = item
                        if cleaned_item.startswith('[ ] '):
                            cleaned_item = cleaned_item[4:]
                        elif cleaned_item.startswith('[x] ') or cleaned_item.startswith('[X] '):
                            cleaned_item = cleaned_item[4:]
                        
                        # Check if this is a wikilink
                        link_target, is_wikilink = extract_wikilink(cleaned_item)
                        
                        if is_wikilink:
                            # Try to find and read the linked file
                            linked_file = find_markdown_file(root_folder, link_target)
                            if linked_file:
                                content = read_file_contents(linked_file)
                                
                                if final_mode:
                                    # Final mode: just content, no separators or links
                                    output_buffer.write(content + "\n")
                                else:
                                    # Normal mode: with horizontal rule separator and link
                                    output_buffer.write("---\n\n")
                                    output_buffer.write(f"[[{link_target}]]\n\n")
                                    output_buffer.write(content + "\n\n")
                                
                                # Also write to word count buffer (only wikilink content counts)
                                word_count_buffer.write(content + "\n")
                            else:
                                output_buffer.write(f"[Link not found: {link_target}]\n")
                        else:
                            # Write the raw text to output only (don't count it)
                            output_buffer.write(cleaned_item + "\n")
                            if not final_mode:
                                output_buffer.write("\n")
    
    # Get the complete output
    complete_output = output_buffer.getvalue()
    
    # Count words only from wikilink content
    word_count = count_words_in_markdown(word_count_buffer.getvalue())
    
    # Print word count first, then the output
    print(f"Word Count: {word_count}")
    print(complete_output, end='')


if __name__ == "__main__":
    main()
