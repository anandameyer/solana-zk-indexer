// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub tree: Vec<u8>,
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub node_idx: i64,
//     pub leaf_idx: Option<i64>,
//     pub level: i64,
//     pub hash: Vec<u8>,
//     pub seq: i64,
// }


import { Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class StateTrees {
    constructor(props?: Partial<StateTrees>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    tree!: string

    @Index()
    @IntColumn()
    nodeIndex!: number

    @IntColumn({ nullable: true })
    leafIndex?: number

    @IntColumn()
    level!: number

    @StringColumn()
    hash!: string

    @IntColumn()
    seq!: number
}