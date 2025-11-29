#!/bin/bash

# Build the plugin
echo "Building plugin..."
cd .obsidian/plugins/bookbinder
npm run build

# Copy files to PublishedVersions
echo "Copying files to PublishedVersions..."
cd ../../..
cp .obsidian/plugins/bookbinder/main.js PublishedVersions/
cp .obsidian/plugins/bookbinder/manifest.json PublishedVersions/
cp .obsidian/plugins/bookbinder/styles.css PublishedVersions/

echo "✅ Plugin published to PublishedVersions/"
