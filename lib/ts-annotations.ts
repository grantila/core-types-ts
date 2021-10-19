import * as ts from 'typescript'
import { CoreTypeAnnotations, mergeAnnotations } from 'core-types'

interface JSDocContainer {
	jsDoc: Array< ts.JSDoc >;
}

function extractDescription( text: string | undefined ): CoreTypeAnnotations
{
	if ( !text )
		return { };

	return { description: text };
}

function extractTitle( node: ts.Node ): CoreTypeAnnotations
{
	const hasParentWhileUnnamed = ( node: ts.Node ) =>
		node.parent &&
		(
			ts.isArrayTypeNode( node.parent )
			||
			ts.isTupleTypeNode( node.parent )
			||
			ts.isOptionalTypeNode( node.parent )
			||
			ts.isRestTypeNode( node.parent )
			||
			ts.isUnionTypeNode( node.parent )
		);

	const recurseTypeChain = ( node: ts.Node, child: ts.Node | undefined )
	: Array< string > =>
	{
		if ( !node )
			return [ ];

		else if (
			ts.isArrayTypeNode( node )
			&&
			node.parent
			&&
			ts.isRestTypeNode( node.parent )
		)
			return recurseTypeChain( node.parent, node );

		else if ( ts.isRestTypeNode( node ) )
			return recurseTypeChain( node.parent, node );

		else if ( ts.isOptionalTypeNode( node ) )
			return recurseTypeChain( node.parent, node );

		else if ( ts.isUnionTypeNode( node ) )
			return recurseTypeChain( node.parent, node );

		else if ( ts.isParenthesizedTypeNode( node ) )
			return recurseTypeChain( node.parent, node );

		else if ( ts.isTypeLiteralNode( node ) )
			return recurseTypeChain( node.parent, node );

		else if ( ts.isArrayTypeNode( node ) )
			return [ '[]', ...recurseTypeChain( node.parent, node ) ];

		else if ( ts.isTupleTypeNode( node ) )
		{
			const pos = node.elements.indexOf( child as any );
			return [
				...( pos === -1 ? [ ] : [ `${pos}` ] ),
				...recurseTypeChain( node.parent, node )
			];
		}

		const isTypeDeclaration =
			ts.isTypeAliasDeclaration( node ) ||
			ts.isInterfaceDeclaration( node ) ||
			ts.isPropertySignature( node );

		const name = isTypeDeclaration ? node.name.getText( ) : '';

		return name
			? [ name, ...recurseTypeChain( node.parent, node ) ]
			: hasParentWhileUnnamed( node )
			? recurseTypeChain( node.parent, node )
			: [ ];
	};

	const typeNames = recurseTypeChain( node, undefined );

	if ( !typeNames.length )
		return { };

	return { title: typeNames.reverse( ).join( '.' ) };
}

function stringifyDoc(
	text: undefined | string | ts.NodeArray< ts.JSDocComment >
)
: string | undefined
{
	if ( typeof text === 'undefined' || typeof text === 'string' )
		return text;

	return text.map( ( { text } ) => text ).join( ' ' );
}

function extractTags( tags: ReadonlyArray< ts.JSDocTag > ): CoreTypeAnnotations
{
	const descriptions: Array< string > = [ ];
	const examples: Array< string > = [ ];
	const _default: Array< string > = [ ];
	const see: Array< string > = [ ];

	const extractSee = ( tag: ts.JSDocSeeTag ) =>
		( tag.name ? ( tag.name?.getText( ) + ' ' ) : '' ) +
		stringifyDoc( tag.comment )?.trim( ) ?? '';

	tags.forEach( tag =>
	{
		if ( !tag.comment )
			return;

		if ( tag.tagName.text === 'example' )
			examples.push( stringifyDoc( tag.comment )?.trim( ) ?? '' );
		else if ( tag.tagName.text === 'default' )
			_default.push( stringifyDoc( tag.comment )?.trim( ) ?? '' );
		else if ( tag.tagName.text === 'see' )
			see.push( extractSee( tag as ts.JSDocSeeTag ) );
		else
		{
			const text = stringifyDoc( tag.comment )?.trim( ) ?? '';
			descriptions.push( `@${tag.tagName.text} ${text}` );
		}
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

	const titleAnnotation = extractTitle( node );

	if ( jsDoc && jsDoc.length )
	{
		// TODO: Analyze when this can be larger than 1 and why
		const first = jsDoc[ 0 ];

		return mergeAnnotations( [
			extractDescription( stringifyDoc( first.comment ) ),
			titleAnnotation,
			extractTags( first.tags ?? [ ] ),
		] );
	}
	return titleAnnotation;
}
