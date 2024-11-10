import { cstr, seq, struct, u32, u8 } from "@solana/buffer-layout";
import { publicKey } from "@solana/buffer-layout-utils";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

interface TokenData {
    mint: PublicKey,
    owner: PublicKey,
    amount: number,
    delegate: PublicKey,
    state: number,
    tlv: string
}

export const TokenDataStruct = struct<TokenData>([
    publicKey('mint'),
    publicKey('owner'),
    u32('amount'),
    publicKey('delegate'),
    // u8('state'),
    // cstr('tlv')
])

export class AccountTransaction {
    hash: string;
    signature: string;

    constructor(hash: string, signature: string) {
        this.hash = hash;
        this.signature = signature;
    }
}

export class LeafNullification {
    tree: PublicKey;
    leafIndex: BN;
    seq: BN;
    signature: string;

    constructor(tree: PublicKey, leafIndex: BN, seq: BN, signature: string) {
        this.tree = tree;
        this.leafIndex = leafIndex;
        this.seq = seq;
        this.signature = signature;
    }
}

export interface IndexedTreeLeafUpdate {
    tree: PublicKey;
    leaf: RawIndexedElement;
    hash: string;
    seq: BN;
}

export interface TransactionSnapshot {
    signature: string;
    slot: number;
    usesCompression: boolean;
    // error: Error;
}

export class StateUpdate {
    inAccounts: Set<string>;
    outAccounts: Account[];
    accountTransactions: Set<AccountTransaction>;
    transactions: Map<string, TransactionSnapshot>;
    leafNullifications: Set<LeafNullification>;
    indexedMerkleTreeUpdate: Map<string, IndexedTreeLeafUpdate>;

    constructor() {
        this.inAccounts = new Set();
        this.outAccounts = [];
        this.accountTransactions = new Set();
        this.transactions = new Map();
        this.leafNullifications = new Set();
        this.indexedMerkleTreeUpdate = new Map();
    }

    static mergeUpdates(updates: StateUpdate[]): StateUpdate {
        const merged = new StateUpdate();
        for (const update of updates) {
            update.inAccounts.forEach(account => merged.inAccounts.add(account));
            merged.outAccounts.push(...update.outAccounts);
            update.accountTransactions.forEach(tx => merged.accountTransactions.add(tx));
            update.transactions = { ...update.transactions, ...merged.transactions };
            update.leafNullifications.forEach(nullification => merged.leafNullifications.add(nullification));

            for (const [key, value] of update.indexedMerkleTreeUpdate) {
                const existing = merged.indexedMerkleTreeUpdate.get(key);
                if (existing && value.seq > existing.seq) {
                    merged.indexedMerkleTreeUpdate.set(key, value);
                } else if (!existing) {
                    merged.indexedMerkleTreeUpdate.set(key, value);
                }
            }
        }
        return merged;
    }
}

export interface RawIndexedElement {
    value: PublicKey;
    nextIndex: number;
    nextValue?: PublicKey;
    index: number;
}

export const RawIndexedElementStruct = struct<RawIndexedElement>([
    publicKey('value'),
    u32('nextIndex'),
    publicKey('nextValue'),
    u32('index')
]);

export interface IndexedMerkleTreeUpdate {
    newLowElement: RawIndexedElement;
    newLowElementHash: PublicKey;
    newHighElement: RawIndexedElement;
    newHighElementHash: PublicKey;
}

export const IndexedMerkleTreeUpdateStruct = struct<IndexedMerkleTreeUpdate>([
    RawIndexedElementStruct.replicate("newLowElement"),
    publicKey('newLowElementHash'),
    RawIndexedElementStruct.replicate("newHighElement"),
    publicKey('newHighElementHash'),
]);

export type AccountData = {
    discriminator?: string
    data?: string
    dataHash?: string
}

export type Account = {
    hash: string,
    address?: string
    data: AccountData,
    owner: string,
    lamports: BN,
    tree: string,
    leafIndex: number,
    seq: number,
    slotCreated: number,
}