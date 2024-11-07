import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { PublicKey } from "@solana/web3.js";
import { Store } from "@subsquid/typeorm-store";
import { BN } from "bn.js";
import { poseidon2, poseidon3 } from "poseidon-bls12381";
import { Accounts, AccountTransactions, IndexedTrees, OwnerBalances, StateTreeHistories, StateTrees, TokenAccounts, TokenOwnerBalances, Transactions } from "../model";
import { Account, AccountTransaction, IndexedTreeLeafUpdate, LeafNullification, StateUpdate, TokenDataStruct, TransactionSnapshot } from "../states/states";

const COMPRESSED_TOKEN_PROGRAM = "cTokenmWW8bLPjZEBAUgYy3zKxQZW6VKi7bqNFEVv3m";
const TREE_HEIGHT = 27;
const ADDRESS_TREE_HEIGHT = 27;
const MAX_ADDRESSES = 50;
const PAGE_LIMIT = 1000;
const HIGHEST_ADDRESS_PLUS_ONE = new BN("452312848583266388373324160190187140051835877600158453279131187530910662655");


export async function spendInputAccounts(store: Store, accounts: Set<string>) {
    const storedAccounts = await store.find(Accounts, { where: { id: `IN (${[...accounts].join(",")})` } });
    const balanceModifications: Map<string, bigint> = new Map();
    const multiplier = new BN(-1);
    for (let sa of storedAccounts) {
        sa.prevSpent = sa.spent;
        sa.spent = true;

        if (!sa.prevSpent) {
            // TODO: need to convert between bigint and BN
            const ammountOfInterest = BigInt(sa.lamports.mul(multiplier).toString());

            if (balanceModifications.has(sa.owner)) {
                const bal = balanceModifications.get(sa.owner);


                balanceModifications.set(sa.owner, bal! + ammountOfInterest);
            } else {
                balanceModifications.set(sa.owner, ammountOfInterest);
            }
        }
    }

    const ownerBalances: OwnerBalances[] = [];

    for (let k in balanceModifications.keys()) {
        const bal = balanceModifications.get(k);
        if (bal && bal != BigInt(0)) {
            ownerBalances.push(new OwnerBalances({ id: k, owner: k, lamports: bal }));
        }
    }

    if (storedAccounts.length > 0) await store.upsert(storedAccounts);
    if (ownerBalances.length > 0) await store.upsert(ownerBalances);
}

export async function appendOutputAccounts(store: Store, accounts: Account[]) {
    const storedTokenAccounts: TokenAccounts[] = [];
    const storedAccounts: Accounts[] = [];

    for (let e of accounts) {
        storedAccounts.push(new Accounts({
            id: e.hash,
            hash: e.hash,
            address: e.address,
            discriminator: e.data?.discriminator,
            data: e.data.data,
            dataHash: e.data.dataHash,
            tree: e.tree,
            leafIndex: e.leafIndex,
            owner: e.owner,
            lamports: e.lamports,
            slotCreated: e.slotCreated,
            seq: e.seq,
            spent: false,
            prevSpent: false,
        }));

        if (e.owner == COMPRESSED_TOKEN_PROGRAM && e.data.data) {
            const tokenData = TokenDataStruct.decode(bs58.decode(e.data.data));
            storedTokenAccounts.push(new TokenAccounts({
                id: e.hash,
                hash: e.hash,
                mint: tokenData.mint.toBase58(),
                owner: tokenData.owner.toBase58(),
                amount: BigInt(tokenData.amount),
                delegate: tokenData.delegate.toBase58(),
                state: tokenData.state || 0,
                spent: false,
                tlv: tokenData.tlv
            }))
        }
    }


    if (storedTokenAccounts.length > 0) {
        await store.upsert(storedTokenAccounts);
        const balanceModifications: Map<string, bigint> = new Map();
        const multiplier: bigint = BigInt(1);

        for (let sta of storedTokenAccounts) {
            if (!sta.prevSpent) {
                const ammountOfInterest = sta.amount * multiplier;

                if (balanceModifications.has(sta.owner)) {
                    balanceModifications.set(sta.owner, balanceModifications.get(sta.owner)! + ammountOfInterest);
                } else {
                    balanceModifications.set(sta.owner, ammountOfInterest);
                }
            }
        }

        const tokenOwnerBalances: TokenOwnerBalances[] = [];

        for (let k in balanceModifications.keys()) {
            const bal = balanceModifications.get(k);
            if (bal && bal != BigInt(0)) {
                tokenOwnerBalances.push(new TokenOwnerBalances({ id: k, owner: k, amount: bal }));
            }
        }

        await store.upsert(tokenOwnerBalances);
    }

    if (storedAccounts.length > 0) {
        await store.upsert(storedAccounts);
        const balanceModifications: Map<string, bigint> = new Map();
        const multiplier = new BN(1);

        for (let sa of storedAccounts) {
            if (!sa.prevSpent) {
                const ammountOfInterest = BigInt(sa.lamports.mul(multiplier).toString());

                if (balanceModifications.has(sa.owner)) {
                    balanceModifications.set(sa.owner, balanceModifications.get(sa.owner)! + ammountOfInterest);
                } else {
                    balanceModifications.set(sa.owner, ammountOfInterest);
                }
            }
        }

        const ownerBalances: OwnerBalances[] = [];

        for (let k in balanceModifications.keys()) {
            const bal = balanceModifications.get(k);
            if (bal && bal != BigInt(0)) {
                ownerBalances.push(new OwnerBalances({ id: k, owner: k, lamports: bal }));
            }
        }

        await store.upsert(ownerBalances);
    }
}

interface LeafNode {
    tree: string
    leafIndex: number
    hash: string
    seq: number
}

function accountToLeafNode(account: Account): LeafNode {
    return {
        tree: account.tree,
        leafIndex: account.leafIndex,
        hash: account.hash,
        seq: account.seq
    }
}

function leafNullificationToLeafNode(leaf: LeafNullification): LeafNode {
    return {
        tree: leaf.tree.toBase58(),
        leafIndex: leaf.leafIndex.toNumber(),
        hash: bs58.encode(Uint8Array.from(ZERO_BYTES[0])),
        seq: leaf.seq.toNumber()
    }
}

interface LeafNodeWithSignature {
    node: LeafNode
    signature: string
}



export async function persistStateUpdate(store: Store, stateUpdate: StateUpdate) {
    const { inAccounts, outAccounts, accountTransactions, transactions, leafNullifications, indexedMerkleTreeUpdate } = stateUpdate;
    await appendOutputAccounts(store, outAccounts);
    await spendInputAccounts(store, inAccounts);
    const accountToTransaction = [...accountTransactions].reduce((e, init) => (e.set(init.hash, init.signature)), new Map<string, string>());
    const leafNodesWithSignatures: LeafNodeWithSignature[] = [
        ...outAccounts.map(account => {
            const signature = accountToTransaction.get(account.hash)?.slice() || bs58.encode(Uint8Array.from([0, ...Array(63).fill(0)]));
            return {
                node: accountToLeafNode(account),
                signature,
            } as LeafNodeWithSignature;
        }),
        ...[...leafNullifications].map(leafNullification => {
            return {
                node: leafNullificationToLeafNode(leafNullification),
                signature: leafNullification.signature,
            };
        }),
    ];

    leafNodesWithSignatures.sort((a, b) => a.node.seq - b.node.seq);
    await persistStateTreeHistory(store, leafNodesWithSignatures);
    await persistLeafNodes(store, leafNodesWithSignatures.map(e => e.node), TREE_HEIGHT);

    const transactionsVec = [...transactions].map(([_, tx]) => tx);

    // debug!("Persisting transaction metadatas...");
    const [compressionTransactions, nonCompressionTransactions] = transactionsVec.reduce(
        ([compression, nonCompression], tx) => {
            if (tx.usesCompression) {
                compression.push(tx);
            } else {
                nonCompression.push(tx);
            }
            return [compression, nonCompression];
        },
        [[] as TransactionSnapshot[], [] as TransactionSnapshot[]]
    );

    const nonCompressionTransactionsToKeep = Math.max(0, PAGE_LIMIT - compressionTransactions.length);
    const transactionsToPersist = [
        ...compressionTransactions,
        ...nonCompressionTransactions.slice(0, nonCompressionTransactionsToKeep),
    ];

    await persistTransactions(store, transactionsToPersist, nonCompressionTransactionsToKeep);

    const accountTransactionVec = [...accountTransactions].map(e => e);
    await persistAccountTransaction(store, accountTransactionVec);

    updateIndexedTree(store, indexedMerkleTreeUpdate, ADDRESS_TREE_HEIGHT);
}

export async function persistStateTreeHistory(store: Store, nodes: LeafNodeWithSignature[]) {
    const stateTreeHistories = nodes.map(({ node, signature }) => {
        return new StateTreeHistories({
            id: node.tree,
            tree: node.tree,
            seq: node.seq,
            leafIndex: node.leafIndex,
            transactionSignature: signature
        })
    });

    if (stateTreeHistories.length > 0) await store.upsert(stateTreeHistories);
}

export async function persistLeafNodes(store: Store, nodes: LeafNode[], treeHeight: number) {
    nodes.sort((a, b) => a.seq - b.seq);
    const leafLocations = nodes.map(node => ([node.tree, leafIndexToNodeIndex(node.leafIndex, treeHeight)] as [string, number]));
    const nodeLocationsToModels = await getProofNodes(store, leafLocations, true);
    const nodeLocationsToHashesAndSeq = new Map(
        Object.entries(nodeLocationsToModels).map(([key, value]) => [key, [value.hash, value.seq] as [string, number]])
    );

    const modelsToUpdates = new Map();

    for (const leafNode of nodes) {
        const nodeIdx = leafIndexToNodeIndex(leafNode.leafIndex, treeHeight);
        const tree = leafNode.tree;
        const key = `${tree},${nodeIdx}`;

        const model = new StateTrees({
            id: tree,
            tree: tree,
            level: 0,
            nodeIndex: nodeIdx,
            hash: leafNode.hash,
            leafIndex: leafNode.leafIndex,
            seq: leafNode.seq,
        });

        const existingSeq = nodeLocationsToHashesAndSeq.get(key)?.[1] || 0;

        if (leafNode.seq >= existingSeq) {
            modelsToUpdates.set(key, model);
            nodeLocationsToHashesAndSeq.set(key, [leafNode.hash, leafNode.seq]);
        }

    }

    const allAncestors = nodes
        .flatMap((leafNode) =>
            getNodeDirectAncestors(leafIndexToNodeIndex(leafNode.leafIndex, treeHeight))
                .map((idx, i) => [leafNode.tree, idx, i] as [string, number, number])
        )

        .sort(([at, ai], [bt, bi]) => at.localeCompare(bt))
        .sort(([at, ai], [bt, bi]) => ai - bi)
        .filter((v, i, a) =>
            i === 0 || !a[i - 1].every((x, j) => x === v[j])
        )
        .map(([tree, idx, i]) => [tree, idx, i] as [string, number, number]);

    for (const [tree, nodeIndex, childLevel] of allAncestors.reverse()) {
        const [leftChildHash, leftChildSeq] = nodeLocationsToHashesAndSeq.get(`${tree},${nodeIndex * 2}`) || [bs58.encode(Uint8Array.from(ZERO_BYTES[childLevel])), 0];
        const [rightChildHash, rightChildSeq] = nodeLocationsToHashesAndSeq.get(`${tree},${nodeIndex * 2 + 1}`) || [bs58.encode(Uint8Array.from(ZERO_BYTES[childLevel])), 0];
        const level = childLevel + 1;
        const hash = computeParentHash(leftChildHash, rightChildHash);
        const seq = Math.max(leftChildSeq, rightChildSeq) as number;
        const model = new StateTrees(
            {
                id: tree,
                tree: tree,
                level: level,
                nodeIndex: nodeIndex,
                hash: hash,
                leafIndex: undefined,
                seq: seq
            }
        );
        modelsToUpdates.set(`${tree},${nodeIndex}`, model);
        nodeLocationsToHashesAndSeq.set(`${tree},${nodeIndex}`, [hash, seq]);
    }

    if (modelsToUpdates.size > 0) {
        const updates = Object.entries(modelsToUpdates).map(([_, value]) => value);
        await store.upsert(updates);
    }
}

function computeParentHash(leftHash: string, rightHash: string) {
    const lb = bs58.decode(leftHash)
    const rb = bs58.decode(rightHash);
    const lbn = BigInt(new BN(lb).toString());
    const rbn = BigInt(new BN(rb).toString());

    const bn = new BN(poseidon2([lbn, rbn]).toString());
    return bs58.encode(bn.toBuffer());
}

function getNodeDirectAncestors(leafIndex: number): number[] {
    const path: number[] = [];
    let currentIndex = leafIndex;
    while (currentIndex > 1) {
        currentIndex >>= 1;
        path.push(currentIndex);
    }
    return path;
}

function leafIndexToNodeIndex(leafIndex: number, treeHeight: number): number {
    return Math.pow(2, treeHeight - 1) + leafIndex;
}


function getProofPath(index: number, includeLeaf: boolean): number[] {
    const indexes: number[] = [];
    let idx = index;
    if (includeLeaf) {
        indexes.push(index);
    }
    while (idx > 1) {
        if (idx % 2 === 0) {
            indexes.push(idx + 1);
        } else {
            indexes.push(idx - 1);
        }
        idx = Math.floor(idx / 2);
    }
    indexes.push(1);
    return indexes;
}

async function getProofNodes(store: Store, leafNodesLocations: Array<[string, number]>, includeLeafs: boolean) {
    const allRequiredNodeIndices = leafNodesLocations
        .flatMap(
            ([tree, index]) => getProofPath(index, includeLeafs).map((idx) => ([tree, idx] as [string, number]))
        )
        .sort(([at, ai], [bt, bi]) => at.localeCompare(bt))
        .sort(([at, ai], [bt, bi]) => ai - bi)
        .filter((v, i, a) =>
            i === 0 || !a[i - 1].every((x, j) => x === v[j])
        );

    const stateTrees: StateTrees[] = [];

    for (let [index, [tree, nodeIdx]] of allRequiredNodeIndices.entries()) {
        const paramIndex = index * 2;

        stateTrees.push(...(await store.find(StateTrees, { where: { tree: tree, nodeIndex: nodeIdx } })));
    }

    return new Map(
        stateTrees.map((node) => [`${node.tree},${node.nodeIndex}`, node])
    );
}

export async function persistTransactions(store: Store, transactions: TransactionSnapshot[], nonCompressionLength: number) {

    const oldNonCompressions = await store.find(Transactions, { where: { usesCompression: false }, order: { slot: "asc" }, take: nonCompressionLength });
    if (oldNonCompressions.length > 0) await store.remove(Transactions, oldNonCompressions.map(e => e.id).filter(e => e.length > 0));

    const transactionModels = transactions.map(e => new Transactions({
        id: e.signature,
        signature: e.signature,
        slot: e.slot,
        usesCompression: e.usesCompression,
    }));

    if (transactionModels.length > 0) {
        await store.upsert(transactionModels);
    }
}

export async function persistAccountTransaction(store: Store, accountTransactions: AccountTransaction[]) {
    const accountTransactionModels = accountTransactions.map(e => new AccountTransactions({
        id: e.hash,
        hash: e.hash,
        signature: e.signature
    }))

    if (accountTransactionModels.length > 0) {
        await store.upsert(accountTransactionModels);
    }
}

function getTopElements(tree: string) {
    return new IndexedTrees({
        id: tree,
        tree: tree,
        leafIndex: 1,
        value: bs58.encode(HIGHEST_ADDRESS_PLUS_ONE.toBuffer()),
        nextIndex: 0,
        seq: 0

    })
}

function computeRangeNodeHash(node: IndexedTrees) {
    const nextIndex = BigInt((new BN(node.nextIndex)).toString());
    const value = BigInt((new BN(bs58.decode(node.value))).toString());
    const nextValue = BigInt((new BN(bs58.decode(node.nextValue))).toString());

    const bn = new BN(poseidon3([value, nextIndex, nextValue]).toString());
    return bs58.encode(bn.toBuffer());
}

export async function updateIndexedTree(store: Store, indexedLeafUpdates: Map<string, IndexedTreeLeafUpdate>, treeHeight: number) {
    const trees = new Set([...indexedLeafUpdates].map(([k, v]) => k.split(",")[0]));
    for (let tree of trees) {
        const leaf = getTopElements(tree);
        const leafUpdate = indexedLeafUpdates.get(`${tree},${leaf.leafIndex}`);
        if (!leafUpdate) {
            indexedLeafUpdates.set(
                `${tree},${leaf.leafIndex}`,
                {
                    tree: new PublicKey(tree),
                    hash: computeRangeNodeHash(leaf),
                    leaf: {
                        value: new PublicKey(leaf.value),
                        nextIndex: leaf.nextIndex,
                        index: leaf.leafIndex,
                    },
                    seq: new BN(0),
                })
        }
    }

    const indexedTreeModels = [...indexedLeafUpdates].map(([e, v]) => new IndexedTrees({
        id: v.tree.toBase58(),
        tree: v.tree.toBase58(),
        leafIndex: v.leaf.index,
        nextIndex: v.leaf.nextIndex,
        nextValue: v.leaf.nextValue?.toBase58(),
        seq: v.seq.toNumber(),
    }))

    await store.upsert(indexedTreeModels);

    const leafNodes = [...indexedLeafUpdates].map(([e, v]) => ({
        tree: v.tree.toBase58(),
        leafIndex: v.leaf.index,
        hash: v.hash,
        seq: v.seq.toNumber(),
    } as LeafNode))

    await persistLeafNodes(store, leafNodes, treeHeight);
}


const MAX_HEIGHT: number = 32;
type ZeroBytes = Array<Array<number>>; // 2D array of numbers

const ZERO_BYTES: ZeroBytes = [
    new Array(32).fill(0),
    [
        32, 152, 245, 251, 158, 35, 158, 171, 60, 234, 195, 242, 123, 129, 228, 129, 220, 49, 36, 213,
        95, 254, 213, 35, 168, 57, 238, 132, 70, 182, 72, 100,
    ],
    [
        16, 105, 103, 61, 205, 177, 34, 99, 223, 48, 26, 111, 245, 132, 167, 236, 38, 26, 68, 203,
        157, 198, 141, 240, 103, 164, 119, 68, 96, 177, 241, 225,
    ],
    [
        24, 244, 51, 49, 83, 126, 226, 175, 46, 61, 117, 141, 80, 247, 33, 6, 70, 124, 110, 234,
        80, 55, 29, 213, 40, 213, 126, 178, 184, 86, 210, 56,
    ],
    [
        7, 249, 216, 55, 203, 23, 176, 211, 99, 32, 255, 233, 59, 165, 35, 69, 241, 183, 40, 87,
        26, 86, 130, 101, 202, 172, 151, 85, 157, 188, 149, 42,
    ],
    [
        43, 148, 207, 94, 135, 70, 179, 245, 201, 99, 31, 76, 93, 243, 41, 7, 166, 153, 197, 140,
        148, 178, 173, 77, 123, 92, 236, 22, 57, 24, 63, 85,
    ],
    [
        45, 238, 147, 197, 166, 102, 69, 150, 70, 234, 125, 34, 204, 169, 225, 188, 254, 215, 30, 105,
        81, 185, 83, 97, 29, 17, 221, 163, 46, 160, 157, 120,
    ],
    [
        7, 130, 149, 229, 162, 43, 132, 233, 130, 207, 96, 30, 182, 57, 89, 123, 139, 5, 21, 168,
        140, 181, 172, 127, 168, 164, 170, 190, 60, 135, 52, 157,
    ],
    [
        47, 165, 229, 241, 143, 96, 39, 166, 80, 27, 236, 134, 69, 100, 71, 42, 97, 107, 46, 39,
        74, 65, 33, 26, 68, 76, 190, 58, 153, 243, 204, 97,
    ],
    [
        14, 136, 67, 118, 208, 216, 253, 33, 236, 183, 128, 56, 158, 148, 31, 102, 228, 94, 122, 204,
        227, 226, 40, 171, 62, 33, 86, 166, 20, 252, 215, 71,
    ],
    [
        14, 136, 67, 118, 208, 216, 253, 33, 236, 183, 128, 56, 158,
        148, 31, 102, 228, 94, 122, 204, 227, 226, 40, 171, 62, 33, 86,
        166, 20, 252, 215, 71,
    ],
    [
        27, 114, 1, 218, 114, 73, 79, 30, 40, 113, 122, 209, 165, 46,
        180, 105, 249, 88, 146, 249, 87, 113, 53, 51, 222, 97, 117,
        229, 218, 25, 10, 242,
    ],
    [
        31, 141, 136, 34, 114, 94, 54, 56, 82, 0, 192, 178, 1, 36,
        152, 25, 166, 230, 225, 228, 101, 8, 8, 181, 190, 188, 107,
        250, 206, 125, 118, 54,
    ],
    [
        44, 93, 130, 246, 108, 145, 75, 175, 185, 112, 21, 137, 186,
        140, 252, 251, 97, 98, 176, 161, 42, 207, 136, 168, 208, 135,
        154, 4, 113, 181, 248, 90,
    ],
    [
        20, 197, 65, 72, 160, 148, 11, 184, 32, 149, 127, 90, 223, 63,
        161, 19, 78, 245, 196, 170, 161, 19, 244, 100, 100, 88, 242,
        112, 224, 191, 191, 208,
    ],
    [
        25, 13, 51, 177, 47, 152, 111, 150, 30, 16, 192, 238, 68, 216,
        185, 175, 17, 190, 37, 88, 140, 173, 137, 212, 22, 17, 142, 75,
        244, 235, 232, 12,
    ],
    [
        34, 249, 138, 169, 206, 112, 65, 82, 172, 23, 53, 73, 20, 173,
        115, 237, 17, 103, 174, 101, 150, 175, 81, 10, 165, 179, 100,
        147, 37, 224, 108, 146,
    ],
    [
        42, 124, 124, 155, 108, 229, 136, 11, 159, 111, 34, 141, 114,
        191, 106, 87, 90, 82, 111, 41, 198, 110, 204, 238, 248, 183,
        83, 211, 139, 186, 115, 35,
    ],
    [
        46, 129, 134, 229, 88, 105, 142, 193, 198, 122, 249, 193, 77,
        70, 63, 252, 71, 0, 67, 201, 194, 152, 139, 149, 77, 117, 221,
        100, 63, 54, 185, 146,
    ],
    [
        15, 87, 197, 87, 30, 154, 78, 171, 73, 226, 200, 207, 5, 13,
        174, 148, 138, 239, 110, 173, 100, 115, 146, 39, 53, 70, 36,
        157, 28, 31, 241, 15,
    ],
    [
        24, 48, 238, 103, 181, 251, 85, 74, 213, 246, 61, 67, 136, 128,
        14, 28, 254, 120, 227, 16, 105, 125, 70, 228, 60, 156, 227, 97,
        52, 247, 44, 202,
    ],
    [
        33, 52, 231, 106, 197, 210, 26, 171, 24, 108, 43, 225, 221,
        143, 132, 238, 136, 10, 30, 70, 234, 247, 18, 249, 211, 113,
        182, 223, 34, 25, 31, 62,
    ],
    [
        25, 223, 144, 236, 132, 78, 188, 79, 254, 235, 216, 102, 243,
        56, 89, 176, 192, 81, 216, 201, 88, 238, 58, 168, 143, 143,
        141, 243, 219, 145, 165, 177,
    ],
    [
        24, 204, 162, 166, 107, 92, 7, 135, 152, 30, 105, 174, 253,
        132, 133, 45, 116, 175, 14, 147, 239, 73, 18, 180, 100, 140, 5,
        247, 34, 239, 229, 43,
    ],
    [
        35, 136, 144, 148, 21, 35, 13, 27, 77, 19, 4, 210, 213, 79,
        71, 58, 98, 131, 56, 242, 239, 173, 131, 250, 223, 5, 100, 69,
        73, 210, 83, 141,
    ],
    [
        39, 23, 31, 180, 169, 123, 108, 192, 233, 232, 245, 67, 181,
        41, 77, 232, 102, 162, 175, 44, 156, 141, 11, 29, 150, 230,
        115, 228, 82, 158, 213, 64,
    ],
    [
        47, 246, 101, 5, 64, 246, 41, 253, 87, 17, 160, 188, 116, 252,
        13, 40, 220, 178, 48, 185, 57, 37, 131, 229, 248, 213, 150,
        150, 221, 230, 174, 33,
    ],
    [
        18, 12, 88, 241, 67, 212, 145, 233, 89, 2, 247, 245, 39, 119,
        120, 162, 224, 173, 81, 104, 246, 173, 215, 86, 105, 147, 38,
        48, 206, 97, 21, 24,
    ],
    [
        31, 33, 254, 183, 13, 63, 33, 176, 123, 248, 83, 213, 229, 219,
        3, 7, 30, 196, 149, 160, 165, 101, 162, 29, 162, 214, 101, 210,
        121, 72, 55, 149,
    ],
    [
        36, 190, 144, 95, 167, 19, 53, 225, 76, 99, 140, 192, 246, 106,
        134, 35, 168, 38, 231, 104, 6, 138, 158, 150, 139, 177, 161,
        221, 225, 138, 114, 210,
    ],
    [
        15, 134, 102, 182, 46, 209, 116, 145, 197, 12, 234, 222, 173,
        87, 212, 205, 89, 126, 243, 130, 29, 101, 195, 40, 116, 76,
        116, 229, 83, 218, 194, 109,
    ],
    [
        9, 24, 212, 107, 245, 45, 152, 176, 52, 65, 63, 74, 26, 28,
        65, 89, 78, 122, 122, 63, 106, 224, 140, 180, 61, 26, 42, 35,
        14, 25, 89, 239,
    ],
    [
        27, 190, 176, 27, 76, 71, 158, 205, 231, 105, 23, 100, 94, 64,
        77, 250, 46, 38, 249, 13, 10, 252, 90, 101, 18, 133, 19, 173,
        55, 92, 95, 242,
    ],
    [
        47, 104, 161, 197, 142, 37, 126, 66, 161, 122, 108, 97, 223,
        245, 85, 30, 213, 96, 185, 146, 42, 177, 25, 213, 172, 142, 24,
        76, 151, 52, 234, 217,
    ],
];