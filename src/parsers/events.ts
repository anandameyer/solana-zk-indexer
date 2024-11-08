import { seq, struct, u32, u8 } from "@solana/buffer-layout";
import { publicKey, u256, u64 } from "@solana/buffer-layout-utils";
// import { PathNode } from "@solana/spl-account-compression";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { IndexedMerkleTreeUpdate, IndexedMerkleTreeUpdateStruct, PathNode, PathNodeStruct } from "../states/states";

export interface IndexedMerkleTreeEvent {
    discriminator: number[],
    id: PublicKey;
    updates: IndexedMerkleTreeUpdate[];
    seq: bigint;
}

export const IndexedMerkleTreeEventStruct = struct<IndexedMerkleTreeEvent>([
    seq(u8(), 8, 'discriminator'),
    publicKey('id'),
    seq(IndexedMerkleTreeUpdateStruct, 1, 'updates'),
    u256('newHighElementHash'),
]);

export const ChangelogEventStruct = struct<ChangelogEvent>([
    publicKey('id'),
    seq(PathNodeStruct, 1, 'paths'),
    u32('seq'),
    u32('index')
]);


// export const PathNodesStruct = seq(PathNodeStruct)

export interface ChangelogEvent {
    id: PublicKey;
    paths: PathNode[];
    seq: BN;
    index: number;
}

export interface NullifierEvent {
    discriminator: number[],
    id: PublicKey;
    nullifiedLeavesIndices: bigint[];
    seq: bigint;
}

export const NullifierEventStruct = struct<NullifierEvent>([
    seq(u8(), 8, 'discriminator'),
    publicKey('id'),
    seq(u64(), 1, 'nullifiedLeavesIndices'),
    u64('seq'),
]);