// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub signature: Vec<u8>,
//     pub slot: i64,
//     pub uses_compression: bool,
//     #[sea_orm(column_type = "Text", nullable)]
//     pub error: Option<String>,
// }

import { BigIntColumn, BooleanColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class Transactions {
    constructor(props?: Partial<Transactions>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    signature!: string

    @IntColumn()
    slot!: number

    @BooleanColumn()
    usesCompression!: boolean
}