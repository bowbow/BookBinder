#!/bin/bash

# Build the plugin
echo "Building plugin..."
cd .obsidian/plugins/bookbinder
npm run build

# Copy files to PublishedVersions
echo "Copying files to PublishedVersions/bookbinder/..."
cd ../../..
cp .obsidian/plugins/bookbinder/main.js PublishedVersions/bookbinder/
cp .obsidian/plugins/bookbinder/manifest.json PublishedVersions/bookbinder/
cp .obsidian/plugins/bookbinder/styles.css PublishedVersions/bookbinder/

echo "✅ Plugin published to PublishedVersions/bookbinder/"
