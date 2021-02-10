import * as ts from 'typescript'
import { CoreTypeAnnotations, mergeAnnotations } from 'core-types'

interface JSDocContainer {
	jsDoc: Array< ts.JSDoc >;
}

function extractTitleDescription( text: string | undefined )
: CoreTypeAnnotations
{
	if ( !text )
		return { };
	const lines = text.split( "\n" );

	if ( lines.length === 1 )
		return { title: text };

	const firstEmpty = lines.findIndex( line => line.trim( ) === '' );

	if (
		firstEmpty !== -1
		&&
		!lines.slice( 1, firstEmpty ).some( line => line.match( /[A-Z]+.*/ ) )
	)
		return {
			title: lines.slice( 0, firstEmpty ).join( "\n" ),
			description: lines.slice( firstEmpty + 1 ).join( "\n" ),
		};

	return { description: text };
}

function extractTags( tags: ReadonlyArray< ts.JSDocTag > ): CoreTypeAnnotations
{
	const descriptions: Array< string > = [ ];
	const examples: Array< string > = [ ];
	const _default: Array< string > = [ ];
	const see: Array< string > = [ ];

	const extractSee = ( tag: ts.JSDocSeeTag ) =>
		( tag.name ? ( tag.name?.getText( ) + ' ' ) : '' ) +
		tag.comment?.trim( ) ?? '';

	tags.forEach( tag =>
	{
		if ( !tag.comment )
			return;

		if ( tag.tagName.text === 'example' )
			examples.push( tag.comment.trim( ) );
		else if ( tag.tagName.text === 'default' )
			_default.push( tag.comment.trim( ) );
		else if ( tag.tagName.text === 'see' )
			see.push( extractSee( tag as ts.JSDocSeeTag ) );
		else
			descriptions.push( `@${tag.tagName.text} ${tag.comment.trim( )}` );
	} )

	return {
		...(
			descriptions.length === 0 ? { } :
			{ description: descriptions.join( "\n" ) }
		),
		...( examples.length === 0 ? { } : { examples } ),
		...(
			_default.length === 0 ? { } :
			{ default: _default.join( "\n" ) }
		),
		...( see.length === 0 ? { } : { see } ),
	};
}

export function decorateNode( node: ts.Node ): CoreTypeAnnotations
{
	const { jsDoc } = ( node as unknown as JSDocContainer );

	if ( jsDoc && jsDoc.length )
	{
		// TODO: Analyze when this can be larger than 1 and why
		const first = jsDoc[ 0 ];

		return mergeAnnotations( [
			extractTitleDescription( first.comment ),
			extractTags( first.tags ?? [ ] ),
		] );
	}
	return { };
}
