<p align="center">
  <img src="logo.svg" width="120" height="120" alt="@gridworkjs/rtree">
</p>

<h1 align="center">@gridworkjs/rtree</h1>

<p align="center">R-tree spatial index with bulk loading for rectangles and polygons</p>

## Install

```
npm install @gridworkjs/rtree
```

## Usage

```js
import { createRTree } from '@gridworkjs/rtree'
import { point, rect, bounds } from '@gridworkjs/core'

// create an index - accessor extracts geometry from your items
const tree = createRTree(item => item.position)

// insert items one at a time
tree.insert({ id: 1, position: point(10, 20) })
tree.insert({ id: 2, position: rect(30, 30, 50, 50) })

// or bulk load for better tree quality
tree.load([
  { id: 1, position: point(10, 20) },
  { id: 2, position: rect(30, 30, 50, 50) },
  { id: 3, position: point(80, 90) }
])

// search by bounding box
tree.search({ minX: 0, minY: 0, maxX: 40, maxY: 40 })
// => [{ id: 1, ... }, { id: 2, ... }]

// search with geometry objects
tree.search(rect(0, 0, 40, 40))

// find nearest neighbors
tree.nearest(point(0, 0), 2)
// => [{ id: 1, ... }, { id: 2, ... }]

// remove by identity
tree.remove(item)

// clear all items
tree.clear()

// properties
tree.size    // number of items
tree.bounds  // bounding box of all items, or null if empty
```

## Bulk Loading

For static or mostly-static datasets, `load()` produces a much better tree than repeated `insert()` calls. It uses the Sort-Tile-Recursive (STR) algorithm to pack items into nodes with minimal overlap.

```js
const tree = createRTree(item => item.geo)
tree.load(items)  // replaces any existing data
```

After bulk loading, you can still `insert()` and `remove()` items dynamically.

## Options

```js
const tree = createRTree(accessor, {
  maxEntries: 9  // max entries per node (default: 9)
})
```

Higher `maxEntries` values create shallower trees with wider nodes. Lower values create deeper trees with tighter bounding boxes. The default of 9 works well for most use cases.

## API

### `createRTree(accessor, options?)`

Creates a new R-tree. The accessor function receives an item and returns its geometry (a `point`, `rect`, `circle`, or raw `{ minX, minY, maxX, maxY }` bounds).

### `tree.insert(item)`

Adds an item to the index. The tree automatically splits nodes and rebalances as needed.

### `tree.remove(item)`

Removes an item by reference identity (`===`). Returns `true` if the item was found and removed, `false` otherwise. Underflowing nodes are dissolved and their entries reinserted.

### `tree.search(query)`

Returns all items whose bounding boxes intersect the query. The query can be a raw bounds object or any geometry supported by `@gridworkjs/core`.

### `tree.nearest(point, k?)`

Returns the `k` nearest items to the given point, ordered by distance. Defaults to `k = 1`. Uses a priority-queue traversal for efficient pruning.

### `tree.clear()`

Removes all items from the index.

### `tree.load(items)`

Bulk loads an array of items using the STR algorithm. Replaces any existing data in the tree. Produces better tree quality than sequential inserts.

### `tree.size`

The number of items in the index.

### `tree.bounds`

The bounding box of all items, or `null` if the tree is empty.

## License

MIT
