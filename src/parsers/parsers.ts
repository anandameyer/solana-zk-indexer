import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { parsePublicTransactionEventWithIdl } from "@lightprotocol/stateless.js";
import { PublicKey } from "@solana/web3.js";
import { Balance, Block, BlockHeader, Instruction, TokenBalance } from "@subsquid/solana-objects";
import BN from "bn.js";
import { Account, AccountData, AccountTransaction, IndexedTreeLeafUpdate, LeafNullification, RawIndexedElement, StateUpdate } from "../states/states";
import { IndexedMerkleTreeEvent, IndexedMerkleTreeEventStruct, NullifierEvent, NullifierEventStruct } from "./events";

export const ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey("compr6CUsB5m2jS4Y3831ztGSTnDpnKJTKS95d64XVq");
export const VOTE_PROGRAM_ID = new PublicKey("Vote111111111111111111111111111111111111111");
export const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
export const NOOP_PROGRAM_ID = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");


function parseIndexedMerkleTreeUpdate(indexedMerkleTreeEvent: IndexedMerkleTreeEvent): StateUpdate {
    const { id, updates, seq } = indexedMerkleTreeEvent;
    const stateUpdate = new StateUpdate();

    for (const update of updates) {
        for (const [leaf, hash] of [
            [update.newLowElement, update.newLowElementHash],
            [update.newHighElement, update.newHighElementHash],
        ]) {
            const indexedTreeLeafUpdate: IndexedTreeLeafUpdate = {
                tree: id,
                hash: (hash as PublicKey).toBase58(),
                leaf: leaf as RawIndexedElement,
                seq: new BN(seq.toString()),
            };
            stateUpdate.indexedMerkleTreeUpdate.set(`${indexedTreeLeafUpdate.tree.toBase58()},${(leaf as RawIndexedElement).index}`, indexedTreeLeafUpdate);
        }
    }

    return stateUpdate;
}

function parseNullifierEvent(signature: string, nullifierEvent: NullifierEvent): StateUpdate {
    const { id, nullifiedLeavesIndices, seq } = nullifierEvent;
    const stateUpdate = new StateUpdate();

    for (let i = 0; i < nullifiedLeavesIndices.length; i++) {
        const leafIndex = nullifiedLeavesIndices[i];
        const leafNullification = new LeafNullification(
            new PublicKey(id),
            new BN(leafIndex.toString()),
            new BN((seq + BigInt(1)).toString()),
            signature
        );
        stateUpdate.leafNullifications.add(leafNullification);
    }

    return stateUpdate;
}

export function isVotingTransaction(trx: Trx): boolean {
    return trx.instructions.some(ins => ins.programId == VOTE_PROGRAM_ID.toBase58());
}

export function parseTrx(trx: Trx): StateUpdate {
    const stateUpdates: StateUpdate[] = [];
    let isCompressionTransaction = false;

    const orderedInstructions = trx.instructions;

    for (let index = 0; index < orderedInstructions.length; index++) {
        const instruction = orderedInstructions[index];
        if (orderedInstructions.length - index > 2) {
            const nextInstruction = orderedInstructions[index + 1];
            const nextNextInstruction = orderedInstructions[index + 2];

            if (instruction.programId == ACCOUNT_COMPRESSION_PROGRAM_ID.toBase58()
                && nextInstruction.programId == SYSTEM_PROGRAM.toBase58()
                && nextNextInstruction.programId == NOOP_PROGRAM_ID.toBase58()) {

                isCompressionTransaction = true;

                const publicTransaction = parsePublicTransactionEventWithIdl(Buffer.from(bs58.decode(nextNextInstruction.data)));
                const stateUpdate = new StateUpdate();

                const { inputCompressedAccountHashes, outputCompressedAccountHashes, outputCompressedAccounts, pubkeyArray } = publicTransaction!;
                const seqNums = (publicTransaction as Record<string, any>)["sequenceNumbers"] as { pubkey: PublicKey, seq: BN }[];


                const treeToSeqNumber = new Map(
                    seqNums.map(seq => [seq.pubkey.toBase58(), seq.seq.toNumber()])
                );

                for (const hash of inputCompressedAccountHashes) {
                    stateUpdate.inAccounts.add(bs58.encode(hash));
                }

                for (let i = 0; i < outputCompressedAccounts.length; i++) {
                    const outAccount = outputCompressedAccounts[i];
                    const hash = outputCompressedAccountHashes[i];
                    const leafIndex = publicTransaction?.outputLeafIndices[i];

                    const tree = pubkeyArray[outAccount.merkleTreeIndex];
                    const seq = treeToSeqNumber.get(tree.toBase58());
                    if (seq === undefined) {
                        throw new Error("Missing sequence number");
                    }

                    const { owner, lamports, address, data } = outAccount.compressedAccount;

                    const accountData: AccountData = {};
                    if (data) {
                        accountData.discriminator = data?.discriminator ? bs58.encode(data.discriminator) : undefined
                        accountData.data = data?.data ? bs58.encode(data.data) : undefined
                        accountData.dataHash = data?.dataHash ? bs58.encode(data?.dataHash) : undefined
                    }


                    const enrichedAccount: Account = {
                        owner: owner.toString(),
                        lamports: lamports,
                        address: address ? bs58.encode(address) : undefined,
                        data: accountData,
                        hash: bs58.encode(hash),
                        slotCreated: trx.block.slot,
                        leafIndex: leafIndex || 0,
                        tree: tree.toBase58(),
                        seq: seq,
                    }

                    stateUpdate.outAccounts.push(enrichedAccount);

                    for (const hash of stateUpdate.inAccounts) {
                        stateUpdate.accountTransactions.add(new AccountTransaction(hash, trx.signatures[0]));
                    }

                    for (const account of stateUpdate.outAccounts) {
                        stateUpdate.accountTransactions.add(new AccountTransaction(account.hash, trx.signatures[0]));
                    }

                    stateUpdates.push(stateUpdate);
                }
            }
        }

        if (orderedInstructions.length - index > 1) {
            const nextInstruction = orderedInstructions[index + 1];
            if (instruction.programId == ACCOUNT_COMPRESSION_PROGRAM_ID.toBase58()
                && nextInstruction.programId == NOOP_PROGRAM_ID.toBase58()) {
                isCompressionTransaction = true;
                console.log(NOOP_PROGRAM_ID, " ==>", nextInstruction.data);

                const buf = bs58.decode(nextInstruction.data);

                try {
                    const nullifierEvent = NullifierEventStruct.decode(buf);
                    // console.log(nullifierEvent, { depth: null });
                    const stateUpdate = parseNullifierEvent(trx.signatures[0], nullifierEvent);
                    stateUpdates.push(stateUpdate);
                    continue
                } catch (__) { }

                try {
                    const indexedMerkleTreeEvent = IndexedMerkleTreeEventStruct.decode(buf);
                    console.log(indexedMerkleTreeEvent, { depth: null });
                    const stateUpdate = parseIndexedMerkleTreeUpdate(indexedMerkleTreeEvent);
                    stateUpdates.push(stateUpdate);
                    continue
                } catch (__) { }

                console.log(`missed: ${trx.signatures[0]}`)
            }
        }
    }

    const stateUpdate = StateUpdate.mergeUpdates(stateUpdates);

    if (!isVotingTransaction(trx) || isCompressionTransaction) {
        stateUpdate.transactions.set(trx.signatures[0], {
            signature: trx.signatures[0],
            slot: trx.block.slot,
            usesCompression: isCompressionTransaction,
        });
    }

    return stateUpdate
}

export interface Trx {
    id: string
    block: BlockHeader
    signatures: string[]
    instructions: Instruction[]
    balances: Balance[]
    tokenBalances: TokenBalance[]
}


export function mergedTrx(block: Block): Trx[] {
    const result: Trx[] = [];

    for (let trx of block.transactions) {
        const ins = block.instructions.filter(e => e.transactionIndex == trx.transactionIndex);
        const bal = block.balances.filter(e => e.transactionIndex == trx.transactionIndex);
        const tb = block.tokenBalances.filter(e => e.transactionIndex == trx.transactionIndex);

        result.push({
            id: trx.id,
            block: trx.block,
            signatures: trx.signatures,
            instructions: ins,
            balances: bal,
            tokenBalances: tb
        });
    }

    return result;
}