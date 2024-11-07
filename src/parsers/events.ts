import { seq, struct, u32 } from "@solana/buffer-layout";
import { publicKey, u256 } from "@solana/buffer-layout-utils";
// import { PathNode } from "@solana/spl-account-compression";
import { PublicKey } from "@solana/web3.js";
import { IndexedMerkleTreeUpdate, IndexedMerkleTreeUpdateStruct, PathNode, PathNodeStruct } from "../states/states";
import BN from "bn.js";

export interface IndexedMerkleTreeEvent {
    id: PublicKey;
    updates: IndexedMerkleTreeUpdate[];
    seq: bigint;
}

export const IndexedMerkleTreeEventStruct = struct<IndexedMerkleTreeEvent>([
    publicKey('id'),
    seq(IndexedMerkleTreeUpdateStruct, IndexedMerkleTreeUpdateStruct.span, 'updates'),
    u256('newHighElementHash'),
]);

export const ChangelogEventStruct = struct<ChangelogEvent>([
    publicKey('id'),
    seq(PathNodeStruct, PathNodeStruct.span, 'paths'),
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
    id: PublicKey;
    nullifiedLeavesIndices: BN[];
    seq: BN;
}