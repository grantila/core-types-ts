import * as ts from 'typescript'
import type * as tst from 'typescript'

const _ts: ((typeof ts) & typeof tst) = ( ts as any ).default ?? ts;

export { _ts as ts }
export type { tst }
