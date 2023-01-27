import { NamedType, simplify } from 'core-types';
import { convertTypeScriptToCoreTypes } from './ts-to-core-types'


const equal = ( a: Array< NamedType >, b: Array< NamedType > ) =>
	expect( a ).toStrictEqual( b );


it( "object literal type", ( ) =>
{
	const coreTypes = convertTypeScriptToCoreTypes( `
	export interface Foo {
		foo: string;
		bar: { baz: number; };
	}
	` ).data.types;

	equal( coreTypes, [
		{
			name: 'Foo',
			title: 'Foo',
			type: 'object',
			properties: {
				foo: {
					required: true,
					node: { type: 'string', title: 'Foo.foo' },
				},
				bar: {
					required: true,
					node: {
						type: 'object',
						title: 'Foo.bar',
						properties: {
							baz: {
								node: { type: 'number', title: 'Foo.bar.baz' },
								required: true,
							}
						},
						additionalProperties: false,
					},
				},
			},
			additionalProperties: false,
		}
	] );
} );

it( "basic interface with additional properties", ( ) =>
{
	const coreTypes = convertTypeScriptToCoreTypes( `
	export interface Foo {
		foo: string | boolean;
		[ key: string ]: number;
	}
	` ).data.types;

	equal( coreTypes, [
		{
			name: 'Foo',
			title: 'Foo',
			type: 'object',
			properties: {
				foo: {
					required: true,
					node: {
						type: 'or',
						title: 'Foo.foo',
						or: [
							{ type: 'string', title: 'Foo.foo' },
							{ type: 'boolean', title: 'Foo.foo' },
						],
					},
				},
			},
			additionalProperties: { type: 'number' },
		}
	] );
} );

it( "basic interface with parenthesized properties", ( ) =>
{
	const coreTypes = convertTypeScriptToCoreTypes( `
	export type Foo = {
		bar: (string | boolean | {baz: 'bak'})[];
	}
	` ).data.types;

	equal( simplify( coreTypes ), [
		{
			name: 'Foo',
			title: 'Foo',
			type: 'object',
			properties: {
				bar: {
					required: true,
					node: {
						type: 'array',
						title: 'Foo.bar',
						elementType: {
							type: 'or',
							title: 'Foo.bar.[]',
							or: [
								{ type: 'string', title: 'Foo.bar.[]' },
								{ type: 'boolean', title: 'Foo.bar.[]' },
								{
									type: 'object',
									title: 'Foo.bar.[]',
									properties: {
										'baz': {
											node: {
												type: 'string',
												title: 'Foo.bar.[].baz',
												const: 'bak'
											},
											required: true,
										},
									},
									additionalProperties: false,
								},
							],
						},
					},
				},
			},
			additionalProperties: false,
		}
	] );
} );

it( "string unions", ( ) =>
{
	const coreTypes = convertTypeScriptToCoreTypes( `
	export interface Foo {
		foo: "bar" | "baz" | "bak";
	}
	` ).data.types;

	equal( simplify( coreTypes ), [
		{
			name: 'Foo',
			title: 'Foo',
			type: 'object',
			properties: {
				foo: {
					required: true,
					node: {
						type: 'string',
						title: 'Foo.foo',
						enum: [ 'bar', 'baz', 'bak' ],
					},
				},
			},
			additionalProperties: false,
		}
	] );
} );

it( "implicit non-exported interface with all types", ( ) =>
{
	const coreTypes = convertTypeScriptToCoreTypes( `
	/**
	 * This is a good type
	 *
	 * @example
	 *   { foo: 'bar' }
	 * @default string
	 */
	interface User {
		name: string;
		signupAt: number;
	}
	export interface Foo {
		and: string & number;
		or: boolean | "foobar":
		ref: User;
		any: any;
		unknown: unknown;
		null: null;
		string: string;
		number: number;
		boolean: boolean;
		object: object;
		arrayAlone: Array;
		arrayOfAny: Array<any>;
		arrayOfNumber: number[];
		tuple: [ string, number, ...boolean[ ] ];

		[ key: string ]: number;
	}
	export type stringOrFiveOrFalseOrNull = string | 5 | false | null;
	` ).data.types;

	equal( coreTypes, [
		{
			name: 'Foo',
			title: 'Foo',
			type: 'object',
			properties: {
				and: {
					required: true,
					node: {
						type: 'and',
						title: 'Foo.and',
						and: [
							{ type: 'string' },
							{ type: 'number' },
						],
					},
				},
				or: {
					required: true,
					node: {
						type: 'or',
						title: 'Foo.or',
						or: [
							{ type: 'boolean', title: 'Foo.or' },
							{ type: 'string', title: 'Foo.or', const: 'foobar' },
						],
					},
				},
				ref: {
					required: true,
					node: {
						type: 'ref',
						title: 'Foo.ref',
						ref: 'User',
					},
				},
				any: {
					required: true,
					node: {
						type: 'any',
						title: 'Foo.any',
					},
				},
				unknown: {
					required: true,
					node: {
						type: 'any',
						title: 'Foo.unknown',
					},
				},
				null: {
					required: true,
					node: {
						type: 'null',
						title: 'Foo.null',
					},
				},
				string: {
					required: true,
					node: {
						type: 'string',
						title: 'Foo.string',
					},
				},
				number: {
					required: true,
					node: {
						type: 'number',
						title: 'Foo.number',
					},
				},
				boolean: {
					required: true,
					node: {
						type: 'boolean',
						title: 'Foo.boolean',
					},
				},
				object: {
					required: true,
					node: {
						type: 'object',
						title: 'Foo.object',
						properties: { },
						additionalProperties: true,
					},
				},
				arrayAlone: {
					required: true,
					node: {
						type: 'array',
						title: 'Foo.arrayAlone',
						elementType: { type: 'any' },
					},
				},
				arrayOfAny: {
					required: true,
					node: {
						type: 'array',
						title: 'Foo.arrayOfAny',
						elementType: { type: 'any' }
					},
				},
				arrayOfNumber: {
					required: true,
					node: {
						type: 'array',
						title: 'Foo.arrayOfNumber',
						elementType: {
							type: 'number',
							title: 'Foo.arrayOfNumber.[]',
						},
					},
				},
				tuple: {
					required: true,
					node: {
						type: 'tuple',
						title: 'Foo.tuple',
						elementTypes: [
							{ type: 'string', title: 'Foo.tuple.0' },
							{ type: 'number', title: 'Foo.tuple.1' },
						],
						additionalItems: {
							type: 'boolean',
							title: 'Foo.tuple.2',
						},
						minItems: 2,
					},
				},
			},
			additionalProperties: { type: 'number' },
		},
		{
			name: 'stringOrFiveOrFalseOrNull',
			title: 'stringOrFiveOrFalseOrNull',
			type: 'or',
			or: [
				{ type: 'string', title: 'stringOrFiveOrFalseOrNull' },
				{
					type: 'number',
					title: 'stringOrFiveOrFalseOrNull',
					const: 5
				},
				{
					type: 'boolean',
					title: 'stringOrFiveOrFalseOrNull',
					const: false,
				},
				{ type: 'null', title: 'stringOrFiveOrFalseOrNull' },
			],
		},
		{
			name: "User",
			title: "User",
			description: "This is a good type",
			examples: "{ foo: 'bar' }",
			default: "string",
			type: "object",
			properties: {
				name: {
					node: { type: "string", title: 'User.name' },
					required: true,
				},
				signupAt: {
					node: { type: "number", title: 'User.signupAt' },
					required: true,
				},
			},
			additionalProperties: false,
		},
	] );
} );

describe( "optional tuple arguments", ( ) =>
{
	it( "first optional", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes( `
			export type T = [ string?, number? ];
		` ).data.types;

		equal( coreTypes, [
			{
				name: 'T',
				title: 'T',
				type: 'tuple',
				elementTypes: [
					{ type: 'string', title: 'T.0' },
					{ type: 'number', title: 'T.1' },
				],
				minItems: 0,
				additionalItems: false,
			}
		] );
	} );

	it( "second optional", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes( `
			export type T = [ string, number? ];
		` ).data.types;

		equal( coreTypes, [
			{
				name: 'T',
				title: 'T',
				type: 'tuple',
				elementTypes: [
					{ type: 'string', title: 'T.0' },
					{ type: 'number', title: 'T.1' },
				],
				minItems: 1,
				additionalItems: false,
			}
		] );
	} );

	it( "no optional", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes( `
			export type T = [ string, number ];
		` ).data.types;

		equal( coreTypes, [
			{
				name: 'T',
				title: 'T',
				type: 'tuple',
				elementTypes: [
					{ type: 'string', title: 'T.0' },
					{ type: 'number', title: 'T.1' },
				],
				minItems: 2,
				additionalItems: false,
			}
		] );
	} );
} );

describe( "non-exported types", ( ) =>
{
	it( "ignore", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				type T = string | number;
				export interface T2 {
					prop: T;
				}
			`,
			{
				nonExported: 'ignore'
			}
		).data.types;

		equal( coreTypes, [
			{
				name: 'T2',
				title: 'T2',
				type: 'object',
				properties: {
					prop: {
						node: { type: 'ref', ref: 'T', title: 'T2.prop' },
						required: true,
					},
				},
				additionalProperties: false,
			}
		] );
	} );

	it( "include", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				type T = string | number;
				export interface T2 {
					prop: boolean;
				}
			`,
			{
				nonExported: 'include'
			}
		).data.types;

		equal( coreTypes, [
			{
				name: 'T',
				title: 'T',
				type: 'or',
				or: [
					{ type: 'string', title: 'T' },
					{ type: 'number', title: 'T' },
				],
			},
			{
				name: 'T2',
				title: 'T2',
				type: 'object',
				properties: {
					prop: {
						node: { type: 'boolean', title: 'T2.prop' },
						required: true,
					},
				},
				additionalProperties: false,
			}
		] );
	} );

	it( "inline w/o cyclic", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				type T = string | number;
				export interface T2 {
					prop: T;
				}
			`,
			{
				nonExported: 'inline'
			}
		).data.types;

		equal( coreTypes, [
			{
				name: 'T2',
				title: 'T2',
				type: 'object',
				properties: {
					prop: {
						node: {
							name: 'T',
							title: 'T2.prop',
							type: 'or',
							or: [
								{ type: 'string', title: 'T' },
								{ type: 'number', title: 'T' },
							],
						},
						required: true,
					},
				},
				additionalProperties: false,
			}
		] );
	} );

	it( "inline w/ cyclic should fail", ( ) =>
	{
		const convert = ( ) => convertTypeScriptToCoreTypes(
			`
				type U = T;
				type T = string | U;
				export interface T2 {
					prop: T;
				}
			`,
			{
				nonExported: 'inline'
			}
		).data.types;

		expect( convert ).toThrowError( /Cyclic type found/ );
	} );

	it( "include-if-referenced", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				type T = string | number;
				type U = boolean;
				export interface T2 {
					prop: T;
				}
			`,
			{
				nonExported: 'include-if-referenced'
			}
		).data.types;

		equal( coreTypes, [
			{
				name: 'T2',
				title: 'T2',
				type: 'object',
				properties: {
					prop: {
						node: { type: 'ref', ref: 'T', title: 'T2.prop' },
						required: true,
					},
				},
				additionalProperties: false,
			},
			{
				name: 'T',
				title: 'T',
				type: 'or',
				or: [
					{ type: 'string', title: 'T' },
					{ type: 'number', title: 'T' },
				],
			},
		] );
	} );
} );

describe( "comments", ( ) =>
{
	it( "should convert JSDoc comments properly", ( ) =>
	{
		const coreTypes = convertTypeScriptToCoreTypes( `
		/**
		 * Any kind of ID
		 *
		 * This can be either a number or a string
		 *
		 * @example
		 *   4711
		 * @example
		 *   "some-uuid-goes-here"
		 * @default
		 * 	 0
		 * @see other Id implementations
		 */
		export type Id = string | number;

		/**
		 * This is a good Foo type
		 */
		export interface Foo {
			foo: string;
			/**
			 * bar can be any baz
			 */
			bar: { baz: number; };
			arr: {
				/** Array item object prop */
				arrItem: number;
			}[];
			tup: [
				string,
				number,
				{
					/** Tuple item object prop */
					tupItem: number;
				}
			];
		}
		` ).data.types;

		equal( coreTypes, [
			{
				name: 'Id',
				type: 'or',
				or: [
					{ type: 'string', title: 'Id' },
					{ type: 'number', title: 'Id' },
				],
				title: 'Id',
				description: 'Any kind of ID\n\n' +
					'This can be either a number or a string',
				examples: [ '4711', '"some-uuid-goes-here"' ],
				see: 'other Id implementations',
				default: '0',
			},
			{
				name: 'Foo',
				title: 'Foo',
				description: 'This is a good Foo type',
				type: 'object',
				properties: {
					foo: {
						required: true,
						node: { type: 'string', title: 'Foo.foo' },
					},
					bar: {
						required: true,
						node: {
							type: 'object',
							title: 'Foo.bar',
							description: 'bar can be any baz',
							properties: {
								baz: {
									node: {
										type: 'number',
										title: 'Foo.bar.baz',
									},
									required: true,
								},
							},
							additionalProperties: false,
						},
					},
					arr: {
						required: true,
						node: {
							type: 'array',
							title: 'Foo.arr',
							elementType: {
								type: 'object',
								title: 'Foo.arr.[]',
								properties: {
									arrItem: {
										required: true,
										node: {
											type: 'number',
											title: 'Foo.arr.[].arrItem',
											description:
												'Array item object prop',
										},
									},
								},
								additionalProperties: false,
							},
						},
					},
					tup: {
						required: true,
						node: {
							type: 'tuple',
							title: 'Foo.tup',
							elementTypes: [
								{ type: 'string', title: 'Foo.tup.0' },
								{ type: 'number', title: 'Foo.tup.1' },
								{
									type: 'object',
									title: 'Foo.tup.2',
									properties: {
										tupItem: {
											required: true,
											node: {
												type: 'number',
												title: 'Foo.tup.2.tupItem',
												description:
													'Tuple item object prop',
											},
										},
									},
									additionalProperties: false,
								},
							],
							minItems: 3,
							additionalItems: false,
						},
					},
				},
				additionalProperties: false,
			}
		] );
	} );
} );

it("interface within namespace", () => {

	const coreTypes = convertTypeScriptToCoreTypes(`
	export namespace Zap {
		export interface Foo {
			foo: string;
			bar: { baz: number; };
		}
	}
	`).data.types;

	equal(coreTypes, [
		{
			name: 'Zap.Foo',
			title: 'Zap.Foo',
			type: 'object',
			properties: {
				foo: {
					required: true,
					node: { type: 'string', title: 'Zap.Foo.foo' },
				},
				bar: {
					required: true,
					node: {
						type: 'object',
						title: 'Zap.Foo.bar',
						properties: {
							baz: {
								node: { type: 'number', title: 'Zap.Foo.bar.baz' },
								required: true,
							}
						},
						additionalProperties: false,
					},
				},
			},
			additionalProperties: false,
		}
	]);
})


describe( "unsupported", ( ) =>
{
	it( "should warn on non-string index", ( ) =>
	{
		const warn = jest.fn( );
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				export interface Foo {
					foo: string;
					[ bar: any ]: number;
				}
			`,
			{ warn }
		).data.types;

		equal( coreTypes, [
			{
				name: 'Foo',
				title: 'Foo',
				type: 'object',
				properties: {
					foo: {
						required: true,
						node: { type: 'string', title: 'Foo.foo' },
					},
				},
				additionalProperties: false,
			}
		] );
		expect( warn.mock.calls.length ).toBe( 1 );
		expect( warn.mock.calls[ 0 ][ 0 ] ).toMatch( /Will not convert/ );
	} );
} );

describe( "generics", ( ) =>
{
	it( "generic refs are not supported yet", ( ) =>
	{
		const warn = jest.fn( );
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				export interface Foo {
					foo: string;
					[ bar: any ]: number;
				}
				export type Bar = Partial< Foo >;
			`,
			{ warn }
		).data.types;

		equal( coreTypes, [
			{
				name: 'Foo',
				title: 'Foo',
				type: 'object',
				properties: {
					foo: {
						required: true,
						node: { type: 'string', title: 'Foo.foo' },
					},
				},
				additionalProperties: false,
			},
			{
				name: 'Bar',
				title: 'Bar',
				type: 'any',
			}
		] );
		expect( warn.mock.calls.length ).toBe( 1 );
		expect( warn.mock.calls[ 0 ][ 0 ] ).toMatch( /Will not convert/ );
	} );

	it( "generic interfaces are not supported yet", ( ) =>
	{
		const warn = jest.fn( );
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				export interface Foo< T > {
					foo: T;
				}
			`,
			{ warn, unsupported: 'warn' }
		).data.types;

		equal( coreTypes, [ ] );
		expect( warn.mock.calls.length ).toBe( 1 );
		expect( warn.mock.calls[ 0 ][ 0 ] )
			.toMatch( 'Generic types are not supported' );
	} );

	it( "generic types are not supported yet", ( ) =>
	{
		const warn = jest.fn( );
		const coreTypes = convertTypeScriptToCoreTypes(
			`
				export type Foo< T > = number | T;
			`,
			{ warn, unsupported: 'warn' }
		).data.types;

		equal( coreTypes, [ ] );
		expect( warn.mock.calls.length ).toBe( 1 );
		expect( warn.mock.calls[ 0 ][ 0 ] )
			.toMatch( 'Generic types are not supported' );
	} );
} );
