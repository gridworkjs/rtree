import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { point, rect, circle, bounds, SPATIAL_INDEX, isSpatialIndex } from '@gridworkjs/core'
import { createRTree } from '../src/index.js'

const accessor = item => item.geo

function pts(coords) {
  return coords.map(([x, y], i) => ({ id: i, geo: point(x, y) }))
}

function rects(specs) {
  return specs.map(([minX, minY, maxX, maxY], i) => ({ id: i, geo: rect(minX, minY, maxX, maxY) }))
}

describe('protocol compliance', () => {
  it('has the SPATIAL_INDEX symbol', () => {
    const tree = createRTree(accessor)
    assert.equal(tree[SPATIAL_INDEX], true)
  })

  it('passes isSpatialIndex', () => {
    const tree = createRTree(accessor)
    assert.equal(isSpatialIndex(tree), true)
  })

  it('has all required methods', () => {
    const tree = createRTree(accessor)
    assert.equal(typeof tree.insert, 'function')
    assert.equal(typeof tree.remove, 'function')
    assert.equal(typeof tree.search, 'function')
    assert.equal(typeof tree.nearest, 'function')
    assert.equal(typeof tree.clear, 'function')
  })
})

describe('insert and size', () => {
  it('starts empty', () => {
    const tree = createRTree(accessor)
    assert.equal(tree.size, 0)
  })

  it('tracks size on insert', () => {
    const tree = createRTree(accessor)
    const items = pts([[1, 2], [3, 4], [5, 6]])
    for (const item of items) tree.insert(item)
    assert.equal(tree.size, 3)
  })

  it('treats duplicates as separate entries', () => {
    const tree = createRTree(accessor)
    const item = { id: 0, geo: point(1, 1) }
    tree.insert(item)
    tree.insert(item)
    assert.equal(tree.size, 2)
  })
})

describe('search', () => {
  it('returns empty array for empty tree', () => {
    const tree = createRTree(accessor)
    assert.deepEqual(tree.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 }), [])
  })

  it('finds items within bounds', () => {
    const tree = createRTree(accessor)
    const items = pts([[5, 5], [15, 15], [25, 25]])
    for (const item of items) tree.insert(item)
    const results = tree.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 0)
  })

  it('finds items on boundary edges', () => {
    const tree = createRTree(accessor)
    const items = pts([[10, 10]])
    for (const item of items) tree.insert(item)
    const results = tree.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    assert.equal(results.length, 1)
  })

  it('accepts geometry objects as queries', () => {
    const tree = createRTree(accessor)
    const items = pts([[5, 5], [50, 50]])
    for (const item of items) tree.insert(item)

    assert.equal(tree.search(rect(0, 0, 10, 10)).length, 1)
    assert.equal(tree.search(point(5, 5)).length, 1)
    assert.equal(tree.search(circle(5, 5, 1)).length, 1)
  })

  it('handles large datasets', () => {
    const tree = createRTree(accessor)
    const items = []
    for (let i = 0; i < 1000; i++) {
      items.push({ id: i, geo: point(Math.random() * 100, Math.random() * 100) })
    }
    for (const item of items) tree.insert(item)

    const results = tree.search({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    assert.equal(results.length, 1000)
  })
})

describe('region items', () => {
  it('indexes rectangles', () => {
    const tree = createRTree(accessor)
    const items = rects([[0, 0, 5, 5], [10, 10, 15, 15], [20, 20, 25, 25]])
    for (const item of items) tree.insert(item)
    const results = tree.search({ minX: 3, minY: 3, maxX: 12, maxY: 12 })
    assert.equal(results.length, 2)
  })

  it('finds overlapping regions', () => {
    const tree = createRTree(accessor)
    const items = rects([[0, 0, 10, 10], [5, 5, 15, 15]])
    for (const item of items) tree.insert(item)
    const results = tree.search({ minX: 7, minY: 7, maxX: 8, maxY: 8 })
    assert.equal(results.length, 2)
  })

  it('finds regions spanning query boundary', () => {
    const tree = createRTree(accessor)
    const items = rects([[0, 0, 100, 100]])
    for (const item of items) tree.insert(item)
    const results = tree.search({ minX: 40, minY: 40, maxX: 60, maxY: 60 })
    assert.equal(results.length, 1)
  })
})

describe('remove', () => {
  it('returns false for empty tree', () => {
    const tree = createRTree(accessor)
    assert.equal(tree.remove({ id: 0, geo: point(0, 0) }), false)
  })

  it('removes by identity', () => {
    const tree = createRTree(accessor)
    const a = { id: 0, geo: point(5, 5) }
    const b = { id: 1, geo: point(15, 15) }
    tree.insert(a)
    tree.insert(b)
    assert.equal(tree.remove(a), true)
    assert.equal(tree.size, 1)
    assert.equal(tree.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 }).length, 0)
  })

  it('does not remove by value equality', () => {
    const tree = createRTree(accessor)
    const a = { id: 0, geo: point(5, 5) }
    tree.insert(a)
    const b = { id: 0, geo: point(5, 5) }
    assert.equal(tree.remove(b), false)
    assert.equal(tree.size, 1)
  })

  it('removes from deep nodes', () => {
    const tree = createRTree(accessor, { maxEntries: 4 })
    const items = pts([
      [1, 1], [2, 2], [3, 3], [4, 4], [5, 5],
      [6, 6], [7, 7], [8, 8], [9, 9], [10, 10]
    ])
    for (const item of items) tree.insert(item)
    assert.equal(tree.remove(items[5]), true)
    assert.equal(tree.size, 9)
    const results = tree.search({ minX: 5.5, minY: 5.5, maxX: 6.5, maxY: 6.5 })
    assert.equal(results.length, 0)
  })

  it('returns false for item not in tree', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: point(5, 5) })
    assert.equal(tree.remove({ id: 99, geo: point(99, 99) }), false)
  })
})

describe('nearest', () => {
  it('returns empty for empty tree', () => {
    const tree = createRTree(accessor)
    assert.deepEqual(tree.nearest(point(0, 0)), [])
  })

  it('finds single nearest', () => {
    const tree = createRTree(accessor)
    const items = pts([[1, 1], [10, 10], [20, 20]])
    for (const item of items) tree.insert(item)
    const results = tree.nearest(point(0, 0), 1)
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 0)
  })

  it('finds k nearest', () => {
    const tree = createRTree(accessor)
    const items = pts([[1, 1], [2, 2], [10, 10], [20, 20]])
    for (const item of items) tree.insert(item)
    const results = tree.nearest(point(0, 0), 2)
    assert.equal(results.length, 2)
    assert.equal(results[0].id, 0)
    assert.equal(results[1].id, 1)
  })

  it('returns all when k exceeds size', () => {
    const tree = createRTree(accessor)
    const items = pts([[1, 1], [2, 2]])
    for (const item of items) tree.insert(item)
    const results = tree.nearest(point(0, 0), 10)
    assert.equal(results.length, 2)
  })

  it('returns empty when k is 0', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: point(1, 1) })
    assert.deepEqual(tree.nearest(point(0, 0), 0), [])
  })

  it('accepts geometry input', () => {
    const tree = createRTree(accessor)
    const items = pts([[5, 5], [10, 10]])
    for (const item of items) tree.insert(item)
    const results = tree.nearest(point(4, 4), 1)
    assert.equal(results[0].id, 0)
  })

  it('returns results in distance order', () => {
    const tree = createRTree(accessor)
    const items = pts([[10, 0], [5, 0], [20, 0], [1, 0]])
    for (const item of items) tree.insert(item)
    const results = tree.nearest(point(0, 0), 4)
    assert.deepEqual(results.map(r => r.id), [3, 1, 0, 2])
  })
})

describe('clear', () => {
  it('resets tree to empty', () => {
    const tree = createRTree(accessor)
    const items = pts([[1, 1], [2, 2], [3, 3]])
    for (const item of items) tree.insert(item)
    tree.clear()
    assert.equal(tree.size, 0)
    assert.deepEqual(tree.search({ minX: 0, minY: 0, maxX: 100, maxY: 100 }), [])
  })

  it('allows re-insert after clear', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: point(5, 5) })
    tree.clear()
    tree.insert({ id: 1, geo: point(10, 10) })
    assert.equal(tree.size, 1)
    const results = tree.search({ minX: 0, minY: 0, maxX: 20, maxY: 20 })
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 1)
  })
})

describe('bounds property', () => {
  it('is null when empty', () => {
    const tree = createRTree(accessor)
    assert.equal(tree.bounds, null)
  })

  it('reflects inserted items', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: point(5, 10) })
    tree.insert({ id: 1, geo: point(20, 30) })
    const b = tree.bounds
    assert.equal(b.minX, 5)
    assert.equal(b.minY, 10)
    assert.equal(b.maxX, 20)
    assert.equal(b.maxY, 30)
  })

  it('includes region bounds', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: rect(0, 0, 50, 50) })
    tree.insert({ id: 1, geo: rect(30, 30, 100, 100) })
    const b = tree.bounds
    assert.equal(b.minX, 0)
    assert.equal(b.minY, 0)
    assert.equal(b.maxX, 100)
    assert.equal(b.maxY, 100)
  })
})

describe('bulk load', () => {
  it('loads empty array', () => {
    const tree = createRTree(accessor)
    tree.load([])
    assert.equal(tree.size, 0)
    assert.equal(tree.bounds, null)
  })

  it('loads and searches correctly', () => {
    const tree = createRTree(accessor)
    const items = pts([[5, 5], [15, 15], [25, 25], [35, 35]])
    tree.load(items)
    assert.equal(tree.size, 4)
    const results = tree.search({ minX: 0, minY: 0, maxX: 20, maxY: 20 })
    assert.equal(results.length, 2)
  })

  it('replaces existing data', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 99, geo: point(99, 99) })
    const items = pts([[1, 1], [2, 2]])
    tree.load(items)
    assert.equal(tree.size, 2)
    assert.equal(tree.search({ minX: 90, minY: 90, maxX: 100, maxY: 100 }).length, 0)
  })

  it('handles large bulk loads', () => {
    const tree = createRTree(accessor)
    const items = []
    for (let i = 0; i < 10000; i++) {
      items.push({ id: i, geo: point(Math.random() * 1000, Math.random() * 1000) })
    }
    tree.load(items)
    assert.equal(tree.size, 10000)
    const results = tree.search({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 })
    assert.equal(results.length, 10000)
  })

  it('produces a balanced tree with good search performance', () => {
    const tree = createRTree(accessor)
    const items = []
    for (let i = 0; i < 1000; i++) {
      items.push({ id: i, geo: point(Math.random() * 100, Math.random() * 100) })
    }
    tree.load(items)

    const small = tree.search({ minX: 45, minY: 45, maxX: 55, maxY: 55 })
    for (const item of small) {
      const b = bounds(item.geo)
      assert.ok(b.minX >= 45 && b.maxX <= 55 && b.minY >= 45 && b.maxY <= 55)
    }
  })

  it('nearest works after bulk load', () => {
    const tree = createRTree(accessor)
    const items = pts([[0, 0], [10, 10], [20, 20], [30, 30]])
    tree.load(items)
    const results = tree.nearest(point(1, 1), 1)
    assert.equal(results.length, 1)
    assert.equal(results[0].id, 0)
  })

  it('remove works after bulk load', () => {
    const tree = createRTree(accessor)
    const items = pts([[5, 5], [15, 15], [25, 25]])
    tree.load(items)
    assert.equal(tree.remove(items[1]), true)
    assert.equal(tree.size, 2)
    assert.equal(tree.search({ minX: 10, minY: 10, maxX: 20, maxY: 20 }).length, 0)
  })

  it('bulk loads rectangles', () => {
    const tree = createRTree(accessor)
    const items = rects([[0, 0, 10, 10], [20, 20, 30, 30], [40, 40, 50, 50]])
    tree.load(items)
    assert.equal(tree.size, 3)
    const results = tree.search({ minX: 5, minY: 5, maxX: 25, maxY: 25 })
    assert.equal(results.length, 2)
  })
})

describe('splitting behavior', () => {
  it('splits nodes that exceed maxEntries', () => {
    const tree = createRTree(accessor, { maxEntries: 4 })
    const items = pts([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])
    for (const item of items) tree.insert(item)
    assert.equal(tree.size, 5)
    const results = tree.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
    assert.equal(results.length, 5)
  })

  it('handles many splits correctly', () => {
    const tree = createRTree(accessor, { maxEntries: 4 })
    const items = pts([
      [1, 1], [2, 2], [3, 3], [4, 4], [5, 5],
      [6, 6], [7, 7], [8, 8], [9, 9], [10, 10],
      [11, 11], [12, 12], [13, 13], [14, 14], [15, 15],
      [16, 16], [17, 17], [18, 18], [19, 19], [20, 20]
    ])
    for (const item of items) tree.insert(item)
    assert.equal(tree.size, 20)
    const results = tree.search({ minX: 0, minY: 0, maxX: 25, maxY: 25 })
    assert.equal(results.length, 20)
  })
})

describe('stress', () => {
  it('insert + search 1000 random points', () => {
    const tree = createRTree(accessor, { maxEntries: 9 })
    const items = []
    for (let i = 0; i < 1000; i++) {
      items.push({ id: i, geo: point(Math.random() * 200, Math.random() * 200) })
    }
    for (const item of items) tree.insert(item)

    const results = tree.search({ minX: 50, minY: 50, maxX: 150, maxY: 150 })
    for (const item of results) {
      const b = bounds(item.geo)
      assert.ok(b.minX >= 50 && b.maxX <= 150 && b.minY >= 50 && b.maxY <= 150)
    }
  })

  it('nearest ordering correctness at scale', () => {
    const tree = createRTree(accessor)
    const items = []
    for (let i = 0; i < 500; i++) {
      items.push({ id: i, geo: point(Math.random() * 100, Math.random() * 100) })
    }
    for (const item of items) tree.insert(item)

    const results = tree.nearest(point(50, 50), 20)
    for (let i = 1; i < results.length; i++) {
      const prevDist = Math.hypot(results[i - 1].geo.x - 50, results[i - 1].geo.y - 50)
      const currDist = Math.hypot(results[i].geo.x - 50, results[i].geo.y - 50)
      assert.ok(prevDist <= currDist + 1e-10, `results not in distance order at index ${i}`)
    }
  })

  it('interleaved insert and remove', () => {
    const tree = createRTree(accessor, { maxEntries: 4 })
    const items = pts([
      [1, 1], [2, 2], [3, 3], [4, 4], [5, 5],
      [6, 6], [7, 7], [8, 8], [9, 9], [10, 10]
    ])
    for (const item of items) tree.insert(item)

    tree.remove(items[0])
    tree.remove(items[2])
    tree.remove(items[4])
    assert.equal(tree.size, 7)

    tree.insert({ id: 100, geo: point(50, 50) })
    assert.equal(tree.size, 8)

    const all = tree.search({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    assert.equal(all.length, 8)
  })
})

describe('remove to empty', () => {
  it('removes the last item without crashing', () => {
    const tree = createRTree(accessor)
    const item = { id: 0, geo: point(5, 5) }
    tree.insert(item)
    assert.equal(tree.remove(item), true)
    assert.equal(tree.size, 0)
    assert.equal(tree.bounds, null)
  })

  it('removes all items sequentially', () => {
    const tree = createRTree(accessor, { maxEntries: 4 })
    const items = pts([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]])
    for (const item of items) tree.insert(item)
    for (const item of items) {
      assert.equal(tree.remove(item), true)
    }
    assert.equal(tree.size, 0)
    assert.equal(tree.bounds, null)
  })

  it('allows insert after removing all items', () => {
    const tree = createRTree(accessor)
    const item = { id: 0, geo: point(5, 5) }
    tree.insert(item)
    tree.remove(item)
    tree.insert({ id: 1, geo: point(10, 10) })
    assert.equal(tree.size, 1)
  })

  it('removes all items after bulk load', () => {
    const tree = createRTree(accessor)
    const items = pts([[1, 1], [2, 2], [3, 3]])
    tree.load(items)
    for (const item of items) {
      assert.equal(tree.remove(item), true)
    }
    assert.equal(tree.size, 0)
    assert.equal(tree.bounds, null)
  })
})

describe('accessor property', () => {
  it('exposes the accessor function', () => {
    const tree = createRTree(accessor)
    assert.equal(tree.accessor, accessor)
  })
})

describe('maxEntries validation', () => {
  it('throws when maxEntries is 1', () => {
    assert.throws(() => createRTree(accessor, { maxEntries: 1 }), { message: 'maxEntries must be at least 2' })
  })

  it('throws when maxEntries is 0', () => {
    assert.throws(() => createRTree(accessor, { maxEntries: 0 }), { message: 'maxEntries must be at least 2' })
  })
})

describe('query input validation', () => {
  it('nearest throws with NaN point', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: point(1, 1) })
    assert.throws(() => tree.nearest({ x: NaN, y: 0 }), { message: 'nearest requires a point with finite x and y' })
  })

  it('nearest with rect uses center point', () => {
    const tree = createRTree(accessor)
    const items = pts([[10, 0], [0, 10], [10, 10]])
    for (const item of items) tree.insert(item)
    const results = tree.nearest({ minX: 8, minY: 8, maxX: 12, maxY: 12 }, 3)
    assert.equal(results[0].id, 2)
  })

  it('search throws with NaN bounds', () => {
    const tree = createRTree(accessor)
    tree.insert({ id: 0, geo: point(1, 1) })
    assert.throws(() => tree.search({ minX: NaN, minY: 0, maxX: 10, maxY: 10 }), { message: 'search requires bounds with finite values' })
  })
})

describe('accessor validation', () => {
  it('throws on NaN bounds from accessor on insert', () => {
    const tree = createRTree(() => ({ minX: NaN, minY: 0, maxX: 1, maxY: 1 }))
    assert.throws(() => tree.insert({}), { message: 'accessor returned non-finite bounds' })
  })

  it('throws on Infinity bounds from accessor on insert', () => {
    const tree = createRTree(() => ({ minX: 0, minY: 0, maxX: Infinity, maxY: 1 }))
    assert.throws(() => tree.insert({}), { message: 'accessor returned non-finite bounds' })
  })

  it('throws on inverted bounds from accessor on insert', () => {
    const tree = createRTree(() => ({ minX: 10, minY: 0, maxX: 0, maxY: 1 }))
    assert.throws(() => tree.insert({}), { message: 'accessor returned inverted bounds (minX > maxX or minY > maxY)' })
  })

  it('throws on NaN bounds from accessor on load', () => {
    const tree = createRTree(() => ({ minX: 0, minY: NaN, maxX: 1, maxY: 1 }))
    assert.throws(() => tree.load([{}]), { message: 'accessor returned non-finite bounds' })
  })
})
