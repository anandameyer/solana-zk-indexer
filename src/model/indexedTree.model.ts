// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub tree: Vec<u8>,
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub leaf_index: i64,
//     pub value: Vec<u8>,
//     pub next_index: i64,
//     pub next_value: Vec<u8>,
//     pub seq: i64,
// }

import { BigIntColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class IndexedTrees {
    constructor(props?: Partial<IndexedTrees>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    tree!: string

    @Index()
    @IntColumn()
    leafIndex!: number

    @StringColumn()
    value!: string

    @IntColumn()
    nextIndex!: number

    @StringColumn()
    nextValue!: string

    @IntColumn()
    seq!: number
}