import { seq, struct, u32, u8 } from "@solana/buffer-layout";
import { publicKey, u256, u64 } from "@solana/buffer-layout-utils";
import { PublicKey } from "@solana/web3.js";
import { IndexedMerkleTreeUpdate, IndexedMerkleTreeUpdateStruct } from "../states/states";

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

export interface NullifierEvent {
    discriminator: number[],
    id: PublicKey;
    nullifiedLeavesIndices: number[];
    seq: bigint;
}

export const NullifierEventStruct = struct<NullifierEvent>([
    seq(u8(), 8, 'discriminator'),
    publicKey('id'),
    seq(u32(), 1, 'nullifiedLeavesIndices'),
    u64('seq'),
]);