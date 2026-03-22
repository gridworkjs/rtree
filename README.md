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

A map application indexing building footprints and park boundaries. Bulk-load the dataset for optimal tree quality, then query by viewport:

```js
import { createRTree } from '@gridworkjs/rtree'
import { rect, bounds } from '@gridworkjs/core'

const map = createRTree(feature => bounds(feature.geometry))

// load all features at once - STR bulk loading produces a much
// tighter tree than inserting one by one
map.load([
  { name: 'City Hall', geometry: rect(200, 300, 260, 370) },
  { name: 'Central Park', geometry: rect(100, 400, 500, 600) },
  { name: 'Library', geometry: rect(210, 310, 240, 340) },
  { name: 'Warehouse', geometry: rect(800, 100, 900, 200) }
])

// user pans the map - what's visible in this viewport?
map.search(rect(150, 250, 550, 650))
// => [City Hall, Central Park, Library]

// user taps a spot - what's closest?
map.nearest({ x: 220, y: 320 }, 1)
// => [Library]

// new construction - add it dynamically
map.insert({ name: 'Cafe', geometry: rect(215, 350, 230, 365) })
```

R-trees are the best general-purpose spatial index for rectangles and regions. Use `load()` when you have the full dataset upfront, then mix in `insert()` and `remove()` as things change.

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
