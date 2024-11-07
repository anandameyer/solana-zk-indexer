// pub struct Model {
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub hash: Vec<u8>,
//     #[sea_orm(primary_key, auto_increment = false)]
//     pub signature: Vec<u8>,
// }

import { Entity, Index, PrimaryColumn, StringColumn } from '@subsquid/typeorm-store'

@Entity()
export class AccountTransactions {
    constructor(props?: Partial<AccountTransactions>) {
        Object.assign(this, props)
    }

    @PrimaryColumn()
    id!: string

    @Index()
    @StringColumn()
    hash!: string

    @Index()
    @StringColumn()
    signature!: string
}