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
} );
