// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub slot: i64,
//     pub parent_slot: i64,
//     pub parent_blockhash: Vec<u8>,
//     pub blockhash: Vec<u8>,
//     pub block_height: i64,
//     pub block_time: i64,
// }

import { BigIntColumn, Entity, Index, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class Blocks {
    constructor(props?: Partial<Blocks>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @BigIntColumn()
    slot!: bigint

    @BigIntColumn()
    parentSlot!: bigint

    @StringColumn()
    parentBlockhash!: string

    @StringColumn()
    blockHash!: string

    @BigIntColumn()
    blockHeight!: bigint

    @BigIntColumn()
    blockTime!: bigint
}