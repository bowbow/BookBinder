#!/usr/bin/env python3
"""
Parse markdown files to extract level 2 headings.
"""

import os
import sys
import re
from pathlib import Path


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
            if stripped_line.startswith('## '):
                # Save previous heading and its items if they exist
                if current_heading is not None:
                    headings_with_items.append((current_heading, current_items))
                
                # Start new heading
                current_heading = stripped_line[3:].strip()
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


def main():
    """Main function to parse command line arguments and extract headings."""
    if len(sys.argv) < 2:
        print("Usage: python parse_headings.py <filename> [root_folder]")
        print("Example: python parse_headings.py 'kanban 1'")
        sys.exit(1)
    
    filename = sys.argv[1]
    
    # Use provided root folder or default to current directory
    root_folder = sys.argv[2] if len(sys.argv) > 2 else '.'
    
    # Find the markdown file
    file_path = find_markdown_file(root_folder, filename)
    
    if file_path is None:
        print(f"Error: File '{filename}.md' not found in '{root_folder}'")
        sys.exit(1)
    
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
                            print(content)
                        else:
                            print(f"[Link not found: {link_target}]")
                    else:
                        # Print the raw text
                        print(cleaned_item)
    else:
        print("No list items found in the file.")


if __name__ == "__main__":
    main()
