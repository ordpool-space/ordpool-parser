#!/bin/bash

# Script to create a gzip decompression bomb for testing
# Warning: The uncompressed file is 1 GB large!

# Configurable parameters
OUTPUT_FILE="gzip-decompression-bomb.txt"
COMPRESSED_FILE="${OUTPUT_FILE}.gz"
REPEAT_STRING="HAHAHAHAHA"
REPEAT_COUNT=100000000 # Number of times the string is repeated

# Delete the OUTPUT_FILE and COMPRESSED_FILE if they exist
[ -f "$OUTPUT_FILE" ] && rm "$OUTPUT_FILE"
[ -f "$COMPRESSED_FILE" ] && rm "$COMPRESSED_FILE"

# Create a single long line of repetitive data
printf "%0.s$REPEAT_STRING" $(seq 1 $REPEAT_COUNT) > "$OUTPUT_FILE"

# Compress the file using gzip
# (gzip removes the uncompressed source by default; brotli doesn't, hence the
# explicit `rm` in the brotli equivalent.)
gzip --best "$OUTPUT_FILE"

echo "Created and compressed bomb file: $COMPRESSED_FILE"
