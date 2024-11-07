// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub hash: Vec<u8>,
//     pub owner: Vec<u8>,
//     pub mint: Vec<u8>,
//     pub delegate: Option<Vec<u8>>,
//     pub state: i32,
//     pub spent: bool,
//     pub prev_spent: Option<bool>,
//     #[sea_orm(column_type = "Decimal(Some((20, 0)))")]
//     pub amount: Decimal,
//     pub tlv: Option<Vec<u8>>,
// }

import { BigIntColumn, BooleanColumn, Entity, Index, IntColumn, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class TokenAccounts {
    constructor(props?: Partial<TokenAccounts>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    hash!: string

    @StringColumn()
    owner!: string

    @StringColumn()
    mint!: string

    @StringColumn({ nullable: true })
    delegate?: string

    @IntColumn()
    state!: number

    @BooleanColumn()
    spent!: boolean

    @BooleanColumn({ nullable: true })
    prevSpent?: boolean

    @BigIntColumn()
    amount!: bigint

    @StringColumn({ nullable: true })
    tlv?: string
}