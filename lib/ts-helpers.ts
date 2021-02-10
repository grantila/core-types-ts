import * as ts from "typescript"
import {
	CoreTypeAnnotations,
	stringifyAnnotations,
	Location,
} from "core-types"


const { factory } = ts;

export function tsUnknownTypeAnnotation( )
{
	return factory.createToken( ts.SyntaxKind.UnknownKeyword );
}

export function safeName( name: string ): ts.StringLiteral | ts.Identifier
{
	if ( name.match( /^[a-zA-Z$][a-zA-Z0-9_$]*$/ ) )
		return factory.createIdentifier( name );
	return factory.createStringLiteral( name );
}

export function wrapAnnotations<T extends ts.Node>(
	tsNode: T,
	node: CoreTypeAnnotations
): T
{
	const comment = stringifyAnnotations( node, { formatWhitespace: true } );
	if ( !comment )
		return tsNode;

	return ts.addSyntheticLeadingComment(
		tsNode,
		comment.includes( "\n" )
			? ts.SyntaxKind.MultiLineCommentTrivia
			: ts.SyntaxKind.SingleLineCommentTrivia,
		comment,
		true
	);
}

export function makeGenericComment(
	text: string | Array< string >,
	bodyOnly = false
): string | undefined
{
	const lines = Array.isArray( text ) ? text : text.trim( ).split( "\n" );

	const enwrap = ( comment: string ) =>
		bodyOnly ? comment : `/*${comment}*/`;

	return lines.length === 1 && lines[ 0 ] === ''
		? undefined
		: enwrap( `*\n${starBefore( lines )}\n ` );
}

function starBefore( lines: Array< string > ): string
{
	return lines.map( line => ` * ${line}` ).join( "\n" );
}

export function generateCode( node: ts.Node ): string
{
	const printer = ts.createPrinter( { newLine: ts.NewLineKind.LineFeed } );
	const resultFile = ts.createSourceFile(
		"output.ts",
		"",
		ts.ScriptTarget.ES2017,
		false, // setParentNodes
		ts.ScriptKind.TS
	);
	const s = printer.printNode( ts.EmitHint.Unspecified, node, resultFile );
	return s;
}

export function tsStripOptionalType( node: ts.TypeNode ): ts.TypeNode
{
	return ts.isOptionalTypeNode( node ) ? node.type : node;
}

export function toLocation( node: ts.Node ): Location
{
	return {
		start: node.pos,
		...( node == null ? { } : { end: node.end } ),
	};
}

export function isExportedDeclaration( node: ts.Statement )
{
	return !!node.modifiers?.some( modifier =>
		modifier.kind === ts.SyntaxKind.ExportKeyword
	);
}
