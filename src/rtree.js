import {
  SPATIAL_INDEX, bounds as toBounds, intersects, contains,
  area, enlargedArea, merge, distanceToPoint
} from '@gridworkjs/core'

function createLeaf(entries) {
  let b = entries[0].bounds
  for (let i = 1; i < entries.length; i++) b = merge(b, entries[i].bounds)
  return { bounds: b, children: entries, leaf: true, height: 1 }
}

function createInternalNode(children) {
  let b = children[0].bounds
  for (let i = 1; i < children.length; i++) b = merge(b, children[i].bounds)
  const height = children[0].height + 1
  return { bounds: b, children, leaf: false, height }
}

function recalcBounds(node) {
  let b = node.children[0].bounds
  for (let i = 1; i < node.children.length; i++) b = merge(b, node.children[i].bounds)
  node.bounds = b
}

function chooseSubtree(node, entryBounds) {
  let best = null
  let bestEnlargement = Infinity
  let bestArea = Infinity

  for (const child of node.children) {
    const ea = enlargedArea(child.bounds, entryBounds) - area(child.bounds)
    const a = area(child.bounds)
    if (ea < bestEnlargement || (ea === bestEnlargement && a < bestArea)) {
      best = child
      bestEnlargement = ea
      bestArea = a
    }
  }

  return best
}

function splitNode(node, maxEntries) {
  const minEntries = Math.ceil(maxEntries * 0.4)
  const items = node.children
  const axis = pickSplitAxis(items, minEntries, node.leaf)
  return splitAlongAxis(items, axis, minEntries, node.leaf, node.height)
}

function pickSplitAxis(items, minEntries, isLeaf) {
  let bestMarginSum = Infinity
  let bestAxis = 0

  for (let axis = 0; axis < 2; axis++) {
    const sorted = items.slice().sort(axis === 0
      ? (a, b) => bOf(a, isLeaf).minX - bOf(b, isLeaf).minX || bOf(a, isLeaf).maxX - bOf(b, isLeaf).maxX
      : (a, b) => bOf(a, isLeaf).minY - bOf(b, isLeaf).minY || bOf(a, isLeaf).maxY - bOf(b, isLeaf).maxY)

    let marginSum = 0
    for (let i = minEntries; i <= sorted.length - minEntries; i++) {
      const left = combinedBounds(sorted, 0, i, isLeaf)
      const right = combinedBounds(sorted, i, sorted.length, isLeaf)
      marginSum += margin(left) + margin(right)
    }

    if (marginSum < bestMarginSum) {
      bestMarginSum = marginSum
      bestAxis = axis
    }
  }

  return bestAxis
}

function splitAlongAxis(items, axis, minEntries, isLeaf, height) {
  const sorted = items.slice().sort(axis === 0
    ? (a, b) => bOf(a, isLeaf).minX - bOf(b, isLeaf).minX || bOf(a, isLeaf).maxX - bOf(b, isLeaf).maxX
    : (a, b) => bOf(a, isLeaf).minY - bOf(b, isLeaf).minY || bOf(a, isLeaf).maxY - bOf(b, isLeaf).maxY)

  let bestOverlap = Infinity
  let bestArea = Infinity
  let bestIndex = minEntries

  for (let i = minEntries; i <= sorted.length - minEntries; i++) {
    const leftBounds = combinedBounds(sorted, 0, i, isLeaf)
    const rightBounds = combinedBounds(sorted, i, sorted.length, isLeaf)
    const overlap = overlapArea(leftBounds, rightBounds)
    const totalArea = area(leftBounds) + area(rightBounds)

    if (overlap < bestOverlap || (overlap === bestOverlap && totalArea < bestArea)) {
      bestOverlap = overlap
      bestArea = totalArea
      bestIndex = i
    }
  }

  const leftChildren = sorted.slice(0, bestIndex)
  const rightChildren = sorted.slice(bestIndex)

  if (isLeaf) {
    return [createLeaf(leftChildren), createLeaf(rightChildren)]
  }
  return [createInternalNode(leftChildren), createInternalNode(rightChildren)]
}

function bOf(entry, isLeaf) {
  return isLeaf ? entry.bounds : entry.bounds
}

function combinedBounds(items, start, end, isLeaf) {
  let b = bOf(items[start], isLeaf)
  for (let i = start + 1; i < end; i++) b = merge(b, bOf(items[i], isLeaf))
  return b
}

function margin(b) {
  return (b.maxX - b.minX) + (b.maxY - b.minY)
}

function overlapArea(a, b) {
  const minX = Math.max(a.minX, b.minX)
  const minY = Math.max(a.minY, b.minY)
  const maxX = Math.min(a.maxX, b.maxX)
  const maxY = Math.min(a.maxY, b.maxY)
  if (minX > maxX || minY > maxY) return 0
  return (maxX - minX) * (maxY - minY)
}

function normalizeBounds(input) {
  if (input != null && typeof input === 'object' && 'minX' in input && 'minY' in input && 'maxX' in input && 'maxY' in input) {
    return input
  }
  return toBounds(input)
}

function validateAccessorBounds(b) {
  if (b === null || typeof b !== 'object') {
    throw new Error('accessor must return a bounds object')
  }
  if (!Number.isFinite(b.minX) || !Number.isFinite(b.minY) ||
      !Number.isFinite(b.maxX) || !Number.isFinite(b.maxY)) {
    throw new Error('accessor returned non-finite bounds')
  }
  if (b.minX > b.maxX || b.minY > b.maxY) {
    throw new Error('accessor returned inverted bounds (minX > maxX or minY > maxY)')
  }
}

function heapPush(heap, entry) {
  heap.push(entry)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent].dist <= heap[i].dist) break
    const tmp = heap[parent]
    heap[parent] = heap[i]
    heap[i] = tmp
    i = parent
  }
}

function heapPop(heap) {
  const top = heap[0]
  const last = heap.pop()
  if (heap.length > 0) {
    heap[0] = last
    let i = 0
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < heap.length && heap[left].dist < heap[smallest].dist) smallest = left
      if (right < heap.length && heap[right].dist < heap[smallest].dist) smallest = right
      if (smallest === i) break
      const tmp = heap[smallest]
      heap[smallest] = heap[i]
      heap[i] = tmp
      i = smallest
    }
  }
  return top
}

/**
 * @typedef {Object} RTreeOptions
 * @property {number} [maxEntries=9] - Maximum entries per node before splitting
 */

/**
 * Creates an R-tree spatial index.
 * @param {function} accessor - Function that returns a geometry or bounds for an item
 * @param {RTreeOptions} [options]
 * @returns {import('@gridworkjs/core').SpatialIndex}
 */
export function createRTree(accessor, options = {}) {
  const maxEntries = options.maxEntries ?? 9

  let root = null
  let size = 0

  function insert(item) {
    const itemBounds = normalizeBounds(accessor(item))
    validateAccessorBounds(itemBounds)
    const entry = { item, bounds: itemBounds }

    if (root === null) {
      root = createLeaf([entry])
      size = 1
      return
    }

    insertEntry(entry)
    size++
  }

  function insertEntry(entry) {
    const path = findInsertPath(root, entry.bounds)
    let node = path[path.length - 1]
    node.children.push(entry)

    // split upward if needed
    let splitResult = null
    for (let i = path.length - 1; i >= 0; i--) {
      node = path[i]
      recalcBounds(node)
      if (node.children.length > maxEntries) {
        const [left, right] = splitNode(node, maxEntries)
        if (i === 0) {
          splitResult = [left, right]
        } else {
          const parent = path[i - 1]
          const idx = parent.children.indexOf(node)
          parent.children.splice(idx, 1, left, right)
        }
      }
    }

    if (splitResult) {
      root = createInternalNode(splitResult)
    }
  }

  function findInsertPath(node, entryBounds) {
    const path = [node]
    while (!node.leaf) {
      node = chooseSubtree(node, entryBounds)
      path.push(node)
    }
    return path
  }

  function remove(item) {
    if (root === null) return false

    const itemBounds = normalizeBounds(accessor(item))
    validateAccessorBounds(itemBounds)
    const path = []
    const indexPath = []

    if (!findItem(root, item, itemBounds, path, indexPath)) return false

    const leaf = path[path.length - 1]
    leaf.children.splice(indexPath[indexPath.length - 1], 1)

    condense(path, indexPath)
    size--

    if (root.children.length === 0) {
      root = null
    } else if (!root.leaf && root.children.length === 1) {
      root = root.children[0]
    }

    return true
  }

  function findItem(node, item, itemBounds, path, indexPath) {
    if (node.leaf) {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].item === item) {
          path.push(node)
          indexPath.push(i)
          return true
        }
      }
      return false
    }

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      if (intersects(child.bounds, itemBounds)) {
        path.push(node)
        indexPath.push(i)
        if (findItem(child, item, itemBounds, path, indexPath)) return true
        path.pop()
        indexPath.pop()
      }
    }

    return false
  }

  function condense(path, indexPath) {
    const orphans = []

    for (let i = path.length - 1; i > 0; i--) {
      const node = path[i]
      const minEntries = Math.ceil(maxEntries * 0.4)

      if (node.children.length < minEntries) {
        const parent = path[i - 1]
        const idx = indexPath[i - 1]
        parent.children.splice(idx, 1)
        collectEntries(node, orphans)
      } else {
        recalcBounds(node)
      }
    }

    if (path.length > 0) recalcBounds(path[0])

    for (const entry of orphans) {
      if (root === null) {
        root = createLeaf([entry])
      } else {
        insertEntry(entry)
      }
    }
  }

  function collectEntries(node, result) {
    if (node.leaf) {
      for (const entry of node.children) result.push(entry)
    } else {
      for (const child of node.children) collectEntries(child, result)
    }
  }

  function search(query) {
    if (root === null) return []
    const queryBounds = normalizeBounds(query)
    const results = []
    searchNode(root, queryBounds, results)
    return results
  }

  function searchNode(node, queryBounds, results) {
    if (!intersects(node.bounds, queryBounds)) return

    if (node.leaf) {
      for (const entry of node.children) {
        if (intersects(entry.bounds, queryBounds)) {
          results.push(entry.item)
        }
      }
    } else {
      for (const child of node.children) {
        searchNode(child, queryBounds, results)
      }
    }
  }

  function nearest(queryPoint, k = 1) {
    if (root === null || k <= 0) return []
    const { x: px, y: py } = typeof queryPoint === 'object' && 'x' in queryPoint
      ? queryPoint
      : { x: queryPoint.minX, y: queryPoint.minY }

    const heap = []
    heapPush(heap, { dist: distanceToPoint(root.bounds, px, py), node: root, isItem: false })

    const results = []

    while (heap.length > 0 && results.length < k) {
      const { dist, node, isItem, item } = heapPop(heap)

      if (isItem) {
        results.push(item)
        continue
      }

      if (node.leaf) {
        for (const entry of node.children) {
          heapPush(heap, {
            dist: distanceToPoint(entry.bounds, px, py),
            node: null,
            isItem: true,
            item: entry.item
          })
        }
      } else {
        for (const child of node.children) {
          heapPush(heap, {
            dist: distanceToPoint(child.bounds, px, py),
            node: child,
            isItem: false
          })
        }
      }
    }

    return results
  }

  function clear() {
    root = null
    size = 0
  }

  /**
   * Bulk loads items into the tree using the Sort-Tile-Recursive (STR) algorithm.
   * Replaces any existing data.
   * @param {Array} items - Items to load
   */
  function load(items) {
    if (items.length === 0) {
      clear()
      return
    }

    const entries = items.map(item => {
      const itemBounds = normalizeBounds(accessor(item))
      validateAccessorBounds(itemBounds)
      return { item, bounds: itemBounds }
    })

    root = buildSTR(entries, maxEntries)
    size = items.length
  }

  return {
    [SPATIAL_INDEX]: true,
    accessor,
    insert,
    remove,
    search,
    nearest,
    clear,
    load,
    get size() { return size },
    get bounds() { return root ? root.bounds : null }
  }
}

function buildSTR(entries, maxEntries) {
  if (entries.length <= maxEntries) {
    return createLeaf(entries)
  }

  const sliceCount = Math.ceil(Math.sqrt(Math.ceil(entries.length / maxEntries)))
  const sliceSize = sliceCount * maxEntries

  entries.sort((a, b) => a.bounds.minX - b.bounds.minX)

  const nodes = []
  for (let i = 0; i < entries.length; i += sliceSize) {
    const slice = entries.slice(i, i + sliceSize)
    slice.sort((a, b) => a.bounds.minY - b.bounds.minY)

    for (let j = 0; j < slice.length; j += maxEntries) {
      const chunk = slice.slice(j, j + maxEntries)
      nodes.push(createLeaf(chunk))
    }
  }

  return buildSTRInternal(nodes, maxEntries)
}

function buildSTRInternal(nodes, maxEntries) {
  if (nodes.length === 1) return nodes[0]
  if (nodes.length <= maxEntries) return createInternalNode(nodes)

  const sliceCount = Math.ceil(Math.sqrt(Math.ceil(nodes.length / maxEntries)))
  const sliceSize = sliceCount * maxEntries

  nodes.sort((a, b) => (a.bounds.minX + a.bounds.maxX) - (b.bounds.minX + b.bounds.maxX))

  const parents = []
  for (let i = 0; i < nodes.length; i += sliceSize) {
    const slice = nodes.slice(i, i + sliceSize)
    slice.sort((a, b) => (a.bounds.minY + a.bounds.maxY) - (b.bounds.minY + b.bounds.maxY))

    for (let j = 0; j < slice.length; j += maxEntries) {
      const chunk = slice.slice(j, j + maxEntries)
      parents.push(createInternalNode(chunk))
    }
  }

  return buildSTRInternal(parents, maxEntries)
}
