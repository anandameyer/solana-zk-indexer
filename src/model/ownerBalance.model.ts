// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub owner: Vec<u8>,
//     #[sea_orm(column_type = "Decimal(Some((20, 0)))")]
//     pub lamports: Decimal,
// }

import { BigIntColumn, Entity, Index, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class OwnerBalances {
    constructor(props?: Partial<OwnerBalances>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    owner!: string

    @BigIntColumn()
    lamports!: bigint
}