import ts from 'typescript'
import {
	type CoreTypeAnnotations,
	type Location,
	stringifyAnnotations,
} from 'core-types'

import type { ToTsOptions } from './types.js'


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
	node: CoreTypeAnnotations,
	blockComment = true
): T
{
	const comment =
		stringifyAnnotations( node, { formatWhitespace: blockComment } )
		.trim( );

	if ( !comment )
		return tsNode;

	if ( blockComment )
		return ts.addSyntheticLeadingComment(
			tsNode,
			ts.SyntaxKind.MultiLineCommentTrivia,
			comment.includes( "\n" )
				// A multi-line comment need a last extra line
				? `${comment}\n `
				// A single-line comment need an initial star to make to two
				// stars, and therefore a JSDoc comment.
				: `* ${comment} `,
			true
		);

	return comment.split( "\n" )
		.reduce(
			( node, line ) =>
				ts.addSyntheticLeadingComment(
					node,
					ts.SyntaxKind.SingleLineCommentTrivia,
					` ${line}`,
					true
				),
			tsNode
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

export function isExportedDeclaration(
	node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration
)
{
	return !!node.modifiers?.some( modifier =>
		modifier.kind === ts.SyntaxKind.ExportKeyword
	);
}

export type HeaderOptions =
	Pick<
		ToTsOptions,
		| 'filename'
		| 'sourceFilename'
		| 'userPackage'
		| 'userPackageUrl'
		| 'noDisableLintHeader'
		| 'noDescriptiveHeader'
	> & {
		createdByPackage: string;
		createdByUrl: string;
	};

export function createCodeHeader( {
	filename,
	sourceFilename,
	userPackage,
	userPackageUrl,
	noDisableLintHeader = false,
	noDescriptiveHeader = false,
	createdByPackage,
	createdByUrl,
}: HeaderOptions )
{
	if ( noDisableLintHeader && noDescriptiveHeader )
		return '';

	const lintHeader = "/* tslint:disable */\n/* eslint-disable */";
	const descriptiveHeader = ( ) =>
	{
		const theFile = !filename ? 'This file' : `The file ${filename}`;
		const source = !sourceFilename ? '' : ` from ${sourceFilename}`;
		const onbehalf = userPackage ? ` on behalf of ${userPackage}` : '';
		const link = userPackageUrl ? ` - {@link ${userPackageUrl}}` : '';
		return makeGenericComment( ( [
			`${theFile} is generated${source} by ` +
				`${createdByPackage}${onbehalf}, ` +
				'DO NOT EDIT.',
			"For more information, see:",
			` - {@link ${createdByUrl}}`,
			...( link ? [ link ] : [ ] ),
		] ) );
	}

	return [
		noDisableLintHeader ? '' : lintHeader,
		noDescriptiveHeader ? '' : descriptiveHeader( ),
	].join( "\n" ) + "\n\n";
}
