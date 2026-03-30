import { describe, it, expect } from 'vitest'
import MerkleTree from '../../../src/services/merkle'

describe('MerkleTree', () => {
  const leaves = ['a', 'b', 'c', 'd', 'e']

  it('produces a deterministic root', () => {
    const t1 = new MerkleTree(leaves)
    const t2 = new MerkleTree(leaves)
    expect(t1.getRoot()).toBe(t2.getRoot())
  })

  it('verifies a valid proof', () => {
    const tree = new MerkleTree(leaves)
    const index = 2
    const proof = tree.getProof(index)
    const root = tree.getRoot()
    const ok = MerkleTree.verifyProof(leaves[index], proof, root, index)
    expect(ok).toBe(true)
  })

  it('rejects a tampered proof', () => {
    const tree = new MerkleTree(leaves)
    const index = 2
    const proof = tree.getProof(index)
    const root = tree.getRoot()
    const badProof = [...proof]
    if (badProof.length > 0) {
      badProof[0] = badProof[0].replace(/^[0-9a-f]/, (c) => (c === '0' ? '1' : '0'))
    }
    const bad = MerkleTree.verifyProof(leaves[index], badProof, root, index)
    expect(bad).toBe(false)
  })
})
