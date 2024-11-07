// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub hash: Vec<u8>,
//     pub data: Option<Vec<u8>>,
//     pub data_hash: Option<Vec<u8>>,
//     pub address: Option<Vec<u8>>,
//     pub owner: Vec<u8>,
//     pub tree: Vec<u8>,
//     pub leaf_index: i64,
//     pub seq: i64,
//     pub slot_created: i64,
//     pub spent: bool,
//     pub prev_spent: Option<bool>,
//     #[sea_orm(column_type = "Decimal(Some((20, 0)))")]
//     pub lamports: Decimal,
//     #[sea_orm(column_type = "Decimal(Some((20, 0)))", nullable)]
//     pub discriminator: Option<Decimal>,
// }

import { BigIntColumn, BooleanColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'
import BN from 'bn.js'

@Entity()
export class Accounts {
    constructor(props?: Partial<Accounts>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    hash!: string

    @StringColumn({ nullable: true })
    data?: string

    @StringColumn({ nullable: true })
    dataHash?: string

    @StringColumn({ nullable: true })
    address?: string

    @StringColumn()
    owner!: string

    @StringColumn()
    tree!: string

    @IntColumn()
    leafIndex!: number

    @IntColumn()
    seq!: number

    @IntColumn()
    slotCreated!: number

    @BooleanColumn()
    spent!: boolean

    @BooleanColumn({ nullable: true })
    prevSpent?: boolean

    @BigIntColumn()
    lamports!: BN

    @StringColumn({ nullable: true })
    discriminator?: string
}