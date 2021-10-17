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
			type: 'object',
			properties: {
				foo: { required: true, node: { type: 'string' } },
				bar: {
					required: true,
					node: {
						type: 'object',
						properties: {
							baz: { node: { type: 'number' }, required: true }
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
			type: 'object',
			properties: {
				foo: {
					required: true,
					node: {
						type: 'or',
						or: [
							{ type: 'string' },
							{ type: 'boolean' },
						],
					},
				},
			},
			additionalProperties: { type: 'number' },
		}
	] );
} );

it( "basic interface with additional properties", ( ) =>
{
	const coreTypes = convertTypeScriptToCoreTypes( `
	export type Foo = {
		bar: (string | boolean | {baz: 'bak'})[];
	}
	` ).data.types;

	equal( simplify( coreTypes ), [
		{
			name: 'Foo',
			type: 'object',
			properties: {
				bar: {
					required: true,
					node: {
						type: 'array',
						elementType: {
							type: 'or',
							or: [
								{ type: 'string' },
								{ type: 'boolean' },
								{
									type: 'object',
									properties: {
										'baz': {
											node: {
												type: 'string',
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
			type: 'object',
			properties: {
				foo: {
					required: true,
					node: {
						type: 'string',
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
			type: 'object',
			properties: {
				and: {
					required: true,
					node: {
						type: 'and',
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
						or: [
							{ type: 'boolean' },
							{ type: 'string', const: 'foobar' },
						],
					},
				},
				ref: {
					required: true,
					node: {
						type: 'ref',
						ref: 'User',
					},
				},
				any: {
					required: true,
					node: {
						type: 'any',
					},
				},
				unknown: {
					required: true,
					node: {
						type: 'any',
					},
				},
				null: {
					required: true,
					node: {
						type: 'null',
					},
				},
				string: {
					required: true,
					node: {
						type: 'string',
					},
				},
				number: {
					required: true,
					node: {
						type: 'number',
					},
				},
				boolean: {
					required: true,
					node: {
						type: 'boolean',
					},
				},
				object: {
					required: true,
					node: {
						type: 'object',
						properties: { },
						additionalProperties: true,
					},
				},
				arrayAlone: {
					required: true,
					node: {
						type: 'array',
						elementType: { type: 'any' },
					},
				},
				arrayOfAny: {
					required: true,
					node: {
						type: 'array',
						elementType: { type: 'any' }
					}
				},
				arrayOfNumber: {
					required: true,
					node: {
						type: 'array',
						elementType: { type: 'number' }
					}
				},
				tuple: {
					required: true,
					node: {
						type: 'tuple',
						elementTypes: [
							{ type: 'string' },
							{ type: 'number' },
						],
						additionalItems: { type: 'boolean' },
						minItems: 2
					},
				},
			},
			additionalProperties: { type: 'number' },
		},
		{
			name: 'stringOrFiveOrFalseOrNull',
			type: 'or',
			or: [
				{ type: 'string' },
				{ type: 'number', const: 5 },
				{ type: 'boolean', const: false },
				{ type: 'null' },
			],
		},
		{
			name: "User",
			title: "This is a good type",
			examples: "{ foo: 'bar' }",
			default: "string",
			type: "object",
			properties: {
				name: { node: { type: "string", }, required: true, },
				signupAt: { node: { type: "number", }, required: true, },
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
				type: 'tuple',
				elementTypes: [
					{ type: 'string' },
					{ type: 'number' },
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
				type: 'tuple',
				elementTypes: [
					{ type: 'string' },
					{ type: 'number' },
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
				type: 'tuple',
				elementTypes: [
					{ type: 'string' },
					{ type: 'number' },
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
				type: 'object',
				properties: {
					prop: { node: { type: 'ref', ref: 'T' }, required: true },
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
				type: 'or',
				or: [ { type: 'string' }, { type: 'number' } ],
			},
			{
				name: 'T2',
				type: 'object',
				properties: {
					prop: { node: { type: 'boolean' }, required: true },
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
				type: 'object',
				properties: {
					prop: {
						node: {
							name: 'T',
							type: 'or',
							or: [ { type: 'string' }, { type: 'number' } ],
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

		expect( convert ).toThrowError( /Cycling type found/ );
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
				type: 'object',
				properties: {
					prop: { node: { type: 'ref', ref: 'T' }, required: true },
				},
				additionalProperties: false,
			},
			{
				name: 'T',
				type: 'or',
				or: [ { type: 'string' }, { type: 'number' } ],
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
		}
		` ).data.types;

		equal( coreTypes, [
			{
				name: 'Id',
				type: 'or',
				or: [ { type: 'string' }, { type: 'number' } ],
				title: 'Any kind of ID',
				description: 'This can be either a number or a string',
				examples: [ '4711', '"some-uuid-goes-here"' ],
				see: 'other Id implementations',
				default: '0',
			},
			{
				name: 'Foo',
				title: 'This is a good Foo type',
				type: 'object',
				properties: {
					foo: { required: true, node: { type: 'string' } },
					bar: {
						required: true,
						node: {
							type: 'object',
							title: 'bar can be any baz',
							properties: {
								baz: { node: { type: 'number' }, required: true }
							},
							additionalProperties: false,
						},
					},
				},
				additionalProperties: false,
			}
		] );
	} );
} );


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
				type: 'object',
				properties: {
					foo: { required: true, node: { type: 'string' } },
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
				type: 'object',
				properties: {
					foo: { required: true, node: { type: 'string' } },
				},
				additionalProperties: false,
			},
			{
				name: 'Bar',
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
