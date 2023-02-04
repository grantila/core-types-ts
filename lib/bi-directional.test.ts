import { NamedType, NodeDocument } from 'core-types';
import { convertCoreTypesToTypeScript } from './core-types-to-ts'
import { convertTypeScriptToCoreTypes } from './ts-to-core-types'


const wrapDocument = ( types: Array< NamedType > ): NodeDocument =>
	( {
		version: 1,
		types
	} );

describe( "bi-directional conversion", ( ) =>
{
	it( "should be bidirectional", ( ) =>
	{
		const ts = convertCoreTypesToTypeScript(
			wrapDocument( [
				{
					name: "User",
					title: "User type",
					description: "This type holds the user information",
					type: "object",
					properties: {
						name: {
							node: { type: "string", title: "The real name" },
							required: true,
						},
					},
					additionalProperties: false,
				},
			] ),
			{ noDescriptiveHeader: true }
		);

		const epi = convertCoreTypesToTypeScript(
			convertTypeScriptToCoreTypes( ts.data ).data,
			{ noDescriptiveHeader: true }
		);

		expect( epi ).toEqual( ts );
	} );

	it( "should forward -1 back and forth", ( ) =>
	{
		const ct = convertTypeScriptToCoreTypes(
			`export type Num = 1000 | -1;`
		);

		const ts = convertCoreTypesToTypeScript(
			ct.data,
			{ noDescriptiveHeader: true, noDisableLintHeader: true }
		);

		expect( ts.data ).toMatchSnapshot( );
	} );

	it( "should handle namespaces with underscore", ( ) =>
	{
		const ct = convertTypeScriptToCoreTypes(
			`
			namespace Foo {
				namespace Bar {
					export type Baz = 42;
				}
			}
			`,
			{ namespaces: 'join-underscore' }
		);

		const ts = convertCoreTypesToTypeScript(
			ct.data,
			{
				namespaces: 'underscore',
				noDescriptiveHeader: true,
				noDisableLintHeader: true,
			}
		);

		expect( ts.data ).toBe(
`namespace Foo { namespace Bar {
export type Baz = 42;
} }
`
		);
	} );

	it( "should handle namespaces with dot", ( ) =>
	{
		const ct = convertTypeScriptToCoreTypes(
			`
			namespace Foo {
				namespace Bar {
					export type Baz = 42;
				}
			}
			`,
			{ namespaces: 'join-dot' }
		);

		const ts = convertCoreTypesToTypeScript(
			ct.data,
			{
				namespaces: 'dot',
				noDescriptiveHeader: true,
				noDisableLintHeader: true,
			}
		);

		expect( ts.data ).toBe(
`namespace Foo { namespace Bar {
export type Baz = 42;
} }
`
		);
	} );

	it( "should handle namespaces with underscore, as all", ( ) =>
	{
		const ct = convertTypeScriptToCoreTypes(
			`
			namespace Foo {
				namespace Bar {
					export type Baz = 42;
				}
			}
			export type Bak = 17;
			`,
			{ namespaces: 'join-underscore' }
		);

		const ts = convertCoreTypesToTypeScript(
			ct.data,
			{
				namespaces: 'all',
				noDescriptiveHeader: true,
				noDisableLintHeader: true,
			}
		);

		expect( ts.data ).toBe(
`namespace Foo { namespace Bar {
export type Baz = 42;
} }

export type Bak = 17;
`
		);
	} );

	it( "should handle ignore namespaces", ( ) =>
	{
		const ct = convertTypeScriptToCoreTypes(
			`
			namespace Foo {
				namespace Bar {
					export type Baz = 42;
				}
			}
			export type Bak = 17;
			`,
			{ namespaces: 'join-underscore' }
		);

		const ts = convertCoreTypesToTypeScript(
			ct.data,
			{
				namespaces: 'ignore',
				noDescriptiveHeader: true,
				noDisableLintHeader: true,
			}
		);

		expect( ts.data ).toBe(
`export type Foo_Bar_Baz = 42;

export type Bak = 17;
`
		);
	} );
} );
