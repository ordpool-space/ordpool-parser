// Mondrian bin-packing layout for the Bitmap protocol's block visualisation.
//
// Direct port of bitlodo's MIT-licensed JavaScript implementation:
//   https://github.com/bitlodo/bitmap-utils/blob/main/utils/MondrianLayout.js
// which itself was adapted (per the original header) from:
//   https://github.com/bitfeed-project/bitfeed/blob/master/client/src/models/TxMondrianPoolScene.js
//
// Behaviour preserved 1:1. Variable names kept close to the source so a
// diff against the original stays small. The pixel-perfect community
// expectation is "match the bitlodo output", so changes here would
// surprise holders of bitmap inscriptions.

export interface MondrianSlot {
  position: { x: number; y: number };
  size: number;
}

export class MondrianLayout {

  width = 0;
  height = 0;
  rowOffset = 0;
  rows: { y: number; slots: MondrianSlot[]; map: Map<number, MondrianSlot>; max: number }[] = [];
  slots: MondrianSlot[] = [];
  readonly length: number;

  constructor(txSizes: number[] = []) {
    let blockWeight = 0;
    for (const size of txSizes) {
      blockWeight += size * size;
    }
    this.length = Math.ceil(Math.sqrt(blockWeight));

    for (const size of txSizes) {
      this.place(size);
    }
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  private getRow(position: { x: number; y: number }) {
    if (position.y - this.rowOffset < this.rows.length) {
      return this.rows[position.y - this.rowOffset];
    }
    return null;
  }

  private getSlot(position: { x: number; y: number }): MondrianSlot | null {
    const row = this.getRow(position);
    if (row !== null && row.map.has(position.x)) {
      return row.map.get(position.x)!;
    }
    return null;
  }

  private addRow() {
    const newRow = {
      y: this.rows.length + this.rowOffset,
      slots: [] as MondrianSlot[],
      map: new Map<number, MondrianSlot>(),
      max: 0,
    };
    this.rows.push(newRow);
    return newRow;
  }

  private addSlot(slot: MondrianSlot): MondrianSlot | null {
    if (slot.size <= 0) return null;

    const existingSlot = this.getSlot(slot.position);
    if (existingSlot !== null) {
      existingSlot.size = Math.max(existingSlot.size, slot.size);
      return existingSlot;
    }

    const row = this.getRow(slot.position);
    if (row === null) return null;

    const insertAt = row.slots.findIndex(s => s.position.x > slot.position.x);
    if (insertAt === -1) {
      row.slots.push(slot);
    } else {
      row.slots.splice(insertAt, 0, slot);
    }
    row.map.set(slot.position.x, slot);
    return slot;
  }

  private removeSlot(slot: MondrianSlot) {
    const row = this.getRow(slot.position);
    if (row !== null) {
      row.map.delete(slot.position.x);
      const index = row.slots.findIndex(s => s.position.x === slot.position.x);
      if (index !== -1) row.slots.splice(index, 1);
    }
  }

  private fillSlot(slot: MondrianSlot, squareWidth: number): MondrianSlot {
    const square = {
      left: slot.position.x,
      right: slot.position.x + squareWidth,
      bottom: slot.position.y,
      top: slot.position.y + squareWidth,
    };

    this.removeSlot(slot);

    // Walk rows the new square covers; split colliding slots, append the
    // residue on the square's right edge.
    for (let rowIndex = slot.position.y; rowIndex < square.top; rowIndex++) {
      const row = this.getRow({ x: slot.position.x, y: rowIndex });
      if (row !== null) {
        const collisions: MondrianSlot[] = [];
        let maxExcess = 0;
        for (const testSlot of row.slots) {
          if (!(testSlot.position.x + testSlot.size < square.left ||
                testSlot.position.x >= square.right)) {
            collisions.push(testSlot);
            const excess = Math.max(0,
              testSlot.position.x + testSlot.size - (slot.position.x + slot.size));
            maxExcess = Math.max(maxExcess, excess);
          }
        }

        if (square.right < this.length && !row.map.has(square.right)) {
          this.addSlot({
            position: { x: square.right, y: rowIndex },
            size: slot.size - squareWidth + maxExcess,
          });
        }

        for (let i = 0; i < collisions.length; i++) {
          collisions[i].size = slot.position.x - collisions[i].position.x;
          if (collisions[i].size === 0) this.removeSlot(collisions[i]);
        }
      } else {
        this.addRow();
        if (slot.position.x > 0) {
          this.addSlot({ position: { x: 0, y: rowIndex }, size: slot.position.x });
        }
        if (square.right < this.length) {
          this.addSlot({
            position: { x: square.right, y: rowIndex },
            size: this.length - square.right,
          });
        }
      }
    }

    // Walk rows ABOVE the square; clip any slot that pokes down into the
    // square, then break the leftover L-shape into squares (the
    // while-loop's strictly-square-emission rule is what gives Mondrian
    // its blocky look).
    for (
      let rowIndex = Math.max(0, slot.position.y - squareWidth);
      rowIndex < slot.position.y;
      rowIndex++
    ) {
      const row = this.getRow({ x: slot.position.x, y: rowIndex });
      if (row === null || row === undefined) continue;

      for (let i = 0; i < row.slots.length; i++) {
        const testSlot = row.slots[i];

        if (testSlot.position.x < slot.position.x + squareWidth &&
            testSlot.position.x + testSlot.size > slot.position.x &&
            testSlot.position.y + testSlot.size >= slot.position.y) {
          const oldSlotWidth = testSlot.size;
          testSlot.size = slot.position.y - testSlot.position.y;

          const remaining = {
            x: testSlot.position.x + testSlot.size,
            y: testSlot.position.y,
            width: oldSlotWidth - testSlot.size,
            height: testSlot.size,
          };

          while (remaining.width > 0 && remaining.height > 0) {
            if (remaining.width <= remaining.height) {
              this.addSlot({ position: { x: remaining.x, y: remaining.y }, size: remaining.width });
              remaining.y += remaining.width;
              remaining.height -= remaining.width;
            } else {
              this.addSlot({ position: { x: remaining.x, y: remaining.y }, size: remaining.height });
              remaining.x += remaining.height;
              remaining.width -= remaining.height;
            }
          }
        }
      }
    }

    return { position: slot.position, size: squareWidth };
  }

  private place(size: number): MondrianSlot {
    let found = false;
    let squareSlot: MondrianSlot | null = null;

    for (const row of this.rows) {
      for (const slot of row.slots) {
        if (slot.size >= size) {
          found = true;
          squareSlot = this.fillSlot(slot, size);
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      const row = this.addRow();
      const slot = this.addSlot({ position: { x: 0, y: row.y }, size: this.length });
      squareSlot = this.fillSlot(slot!, size);
    }

    if (squareSlot!.position.x + squareSlot!.size > this.width) {
      this.width = squareSlot!.position.x + squareSlot!.size;
    }
    if (squareSlot!.position.y + squareSlot!.size > this.height) {
      this.height = squareSlot!.position.y + squareSlot!.size;
    }

    this.slots.push(squareSlot!);
    return squareSlot!;
  }
}
