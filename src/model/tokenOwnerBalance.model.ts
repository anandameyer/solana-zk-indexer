// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub owner: Vec<u8>,
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub mint: Vec<u8>,
//     #[sea_orm(column_type = "Decimal(Some((20, 0)))")]
//     pub amount: Decimal,
// }


import { BigIntColumn, Entity, Index, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class TokenOwnerBalances {
    constructor(props?: Partial<TokenOwnerBalances>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    owner!: string

    @Index()
    @StringColumn()
    mint!: string

    @BigIntColumn()
    amount!: bigint
}