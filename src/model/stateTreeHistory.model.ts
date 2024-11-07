// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub tree: Vec<u8>,
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub seq: i64,
//     pub leaf_idx: i64,
//     pub transaction_signature: Vec<u8>,
// }

import { Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class StateTreeHistories {
    constructor(props?: Partial<StateTreeHistories>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    tree!: string

    @Index()
    @IntColumn()
    seq!: number

    @IntColumn()
    leafIndex!: number

    @StringColumn()
    transactionSignature!: string
}