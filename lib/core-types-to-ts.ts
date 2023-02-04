import {
	NodeDocument,
	NodeType,
	AndType,
	OrType,
	PrimitiveType,
	isPrimitiveType,
	RefType,
	ObjectType,
	ArrayType,
	TupleType,
	CoreTypesErrorMeta,
	ConversionResult,
	UnsupportedError,
	NamedType,
} from "core-types"
import * as ts from 'typescript'

import {
	safeName,
	tsUnknownTypeAnnotation,
	wrapAnnotations,
	generateCode,
	createCodeHeader,
} from "./ts-helpers"
import { ToTsOptions } from "./types"


const { factory } = ts;

const createdByPackage = 'core-types-ts';
const createdByUrl = 'https://github.com/grantila/core-types-ts';

interface Context
{
	useUnknown: boolean;
}

function throwUnsupported(
	msg: string,
	node: NodeType,
	meta?: CoreTypesErrorMeta
)
: never
{
	throw new UnsupportedError( msg, { loc: node.loc, ...meta } );
}

export function convertCoreTypesToTypeScript(
	doc: NodeDocument,
	opts: ToTsOptions = { }
)
: ConversionResult
{
	const { version, types } = doc;

	if ( version !== 1 )
		throw new UnsupportedError(
			`core-types version ${version} not supported`
		);

	const convertedTypes: Array< string > = [ ];

	const wrapInNamespaces = ( code: string, namespaceList: string[ ] ) =>
		namespaceList.length === 0
			? code
			: namespaceList.map( ns => `namespace ${ns} {` ).join( ' ' ) +
				`\n${code}\n` +
				namespaceList.map( ( ) => '}' ).join( ' ' );

	const sourceCode =
		types
		.map( node =>
		{
			const { name } = node;

			const tsNode = convertSingleCoreTypeToTypeScriptAst( node, opts );

			convertedTypes.push( name );

			return tsNode;
		} )
		.map( ( { declaration: tsNode, namespaceList } ) =>
			wrapInNamespaces( generateCode( tsNode ), namespaceList )
		)
		.join( "\n\n" );

	const header = createCodeHeader( {
		...opts,
		createdByPackage,
		createdByUrl,
	} );

	return {
		data:
			header +
			sourceCode +
			( sourceCode.endsWith( "\n" ) ? "" : "\n" ),
		convertedTypes,
		notConvertedTypes: [ ],
	};
}

export function convertSingleCoreTypeToTypeScriptAst(
	node: NamedType,
	opts: Pick< ToTsOptions, 'useUnknown' | 'declaration' | 'namespaces' > =
		{ }
)
: { declaration: ts.Declaration; namespaceList: string[ ]; }
{
	const {
		useUnknown = false,
		declaration = false,
		namespaces = 'ignore',
	} = opts;

	const ctx: Context = {
		useUnknown,
	};

	const { name, namespaces: namespaceList } =
		makeNameAndNamespace( node.name, namespaces );

	const ret = tsType( ctx, node );

	const doExport = ( tsNode: ts.Declaration ) =>
		wrapAnnotations( tsNode, node );

	const typeDeclaration =
		ret.type === 'flow-type'
		? declareType( declaration, name, ret.node )
		: declareInterface( declaration, name, ret.properties );

	return {
		declaration: doExport( typeDeclaration ),
		namespaceList,
	};
}

function makeNameAndNamespace(
	name: string,
	namespaces: ToTsOptions[ 'namespaces' ]
)
: { name: string; namespaces: string[ ]; }
{
	if ( !namespaces || namespaces === 'ignore' )
		return { name, namespaces: [ ] };

	const parts = name
		.split(
			namespaces === 'dot' ? '.' :
			namespaces === 'underscore' ? '_' :
			/[._]/
		);

	const lastPart = parts.pop( )!;
	return { name: lastPart, namespaces: parts };
}

function createExportModifier( declaration: boolean )
{
	return factory.createModifiersFromModifierFlags(
		declaration
		? ts.ModifierFlags.Export | ts.ModifierFlags.Ambient
		: ts.ModifierFlags.Export
	);
}

function declareType( declaration: boolean, name: string, node: ts.TypeNode )
{
	return factory.createTypeAliasDeclaration(
		createExportModifier( declaration ), // modifiers
		factory.createIdentifier( name ),
		undefined, // type parameters
		node
	);
}

function declareInterface(
	declaration: boolean,
	name: string,
	nodes: Array< ts.TypeElement >
)
{
	return factory.createInterfaceDeclaration(
			createExportModifier( declaration ), // modifiers
			factory.createIdentifier( name ),
			undefined, // type parameters
			undefined, // heritage
			nodes
		);
}

interface TsTypeReturnAsObject {
	type: 'object';
	node: ts.TypeLiteralNode;
	properties: Array< ts.TypeElement >;
}
interface TsTypeReturnAsFlowType {
	type: 'flow-type';
	node: ts.TypeNode;
}
type TsTypeReturn = TsTypeReturnAsObject | TsTypeReturnAsFlowType;

function tsTypeUnion( ctx: Context, node: OrType ): ts.TypeNode
{
	return factory.createUnionTypeNode(
		node.or.map( elem =>
			wrapAnnotations( tsTypeAndOrSchema( ctx, elem ), elem )
		)
	)
}

function tsTypeIntersection( ctx: Context, node: AndType ): ts.TypeNode
{
	return factory.createIntersectionTypeNode(
		node.and.map( elem =>
			wrapAnnotations( tsTypeAndOrSchema( ctx, elem ), elem )
		)
	)
}

function tsTypeAndOrSchema( ctx: Context, node: NodeType ): ts.TypeNode
{
	if ( node.type === 'and' || node.type === 'or' )
		return tsTypeAndOr( ctx, node );
	else
		return tsType( ctx, node ).node;
}

function tsTypeAndOr( ctx: Context, andOr: AndType | OrType ): ts.TypeNode
{
	if ( andOr.type === 'and' )
		return tsTypeIntersection( ctx, andOr );
	else
		return tsTypeUnion( ctx, andOr );
}

function tsAny( ctx: Context ): ts.TypeNode
{
	return ctx.useUnknown
		? tsUnknownTypeAnnotation( )
		: factory.createKeywordTypeNode( ts.SyntaxKind.AnyKeyword );
}

function tsType( ctx: Context, node: NodeType ): TsTypeReturn
{
	if ( node.type === 'and' || node.type === 'or' )
		return { type: 'flow-type', node: tsTypeAndOr( ctx, node ) };

	if ( node.type === 'null' )
		return { type: 'flow-type', node: tsPrimitiveType( node ) };

	const { const: _const, enum: _enum } = node as
		( typeof node & { const: unknown; enum: unknown; } );

	if ( _const )
		return {
			type: 'flow-type',
			node: tsConstType( ctx, node, _const ),
		};
	else if ( _enum )
		return {
			type: 'flow-type',
			node: factory.createUnionTypeNode(
				( _enum as Array< unknown > )
					.map( elem => tsConstType( ctx, node, elem ) )
			)
		};

	if ( isPrimitiveType( node ) )
		return { type: 'flow-type', node: tsPrimitiveType( node ) };

	if ( node.type === 'any' )
		return {
			type: 'flow-type',
			node: tsAny( ctx ),
		};

	if ( node.type === 'ref' )
		return { type: 'flow-type', node: tsRefType( node ) };

	if ( node.type === 'object' )
		return { type: 'object', ...tsObjectType( ctx, node ) };

	if ( node.type === 'array' || node.type === 'tuple' )
		return { type: 'flow-type', node: tsArrayType( ctx, node ) };

	throwUnsupported( `Type ${(node as any).type} not supported`, node );
}

function tsNullType( ): ts.TypeNode
{
	return factory.createLiteralTypeNode(
		factory.createToken( ts.SyntaxKind.NullKeyword )
	);
}

const primitiveTypeMap = {
	string: ts.SyntaxKind.StringKeyword,
	number: ts.SyntaxKind.NumberKeyword,
	integer: ts.SyntaxKind.NumberKeyword,
	boolean: ts.SyntaxKind.BooleanKeyword,
} as const;

function tsPrimitiveType( node: PrimitiveType ): ts.TypeNode
{
	const { type } = node;
	if ( type === "null" )
		return tsNullType( );
	else if ( primitiveTypeMap[ type as keyof typeof primitiveTypeMap ] )
		return factory.createKeywordTypeNode(
			primitiveTypeMap[ type as keyof typeof primitiveTypeMap ]
		);

	throwUnsupported( `Invalid primitive type: ${type}`, node );
}

function tsConstType( ctx: Context, node: NodeType, value: any ): ts.TypeNode
{
	return value === "null"
		? tsNullType( )
		: typeof value === "string"
		? factory.createStringLiteral( value )
		: typeof value === "number"
		? factory.createNumericLiteral( value )
		: typeof value === "boolean"
		?  value ? factory.createTrue( ) : factory.createFalse( )
		: typeof value === "object"
		? Array.isArray( value )
			? tsArrayConstExpression( ctx, node, value ) as any
			: tsObjectType( ctx, value ).node
		: ( ( ) =>
			{
				throwUnsupported(
					`Invalid const value: "${value}"`,
					node,
					{ blob: value }
				);
			} )( );
}

function tsArrayConstExpression< T >(
	ctx: Context,
	node: NodeType,
	value: Array< T >
)
: ts.TypeNode
{
	return factory.createTupleTypeNode(
		value.map( elem => tsConstType( ctx, node, elem ) )
	)
}

function createAdditionalMembers( ctx: Context, type: true | NodeType )
: ts.IndexSignatureDeclaration
{
	if ( type === true )
		return createAdditionalMembers( ctx, { type: 'any' } );

	return factory.createIndexSignature(
		undefined, // modifiers
		[
			factory.createParameterDeclaration(
				undefined, // modifiers
				undefined, // dotdotdot token
				'key',
				undefined, // question token
				tsType( ctx, { type: 'string' } ).node
			)
		],
		tsType( ctx, type ).node
	);
}

function tsObjectType( ctx: Context, node: ObjectType )
: Omit< TsTypeReturnAsObject, 'type' >
{
	const {
		properties,
		additionalProperties = false,
	} = node;

	const additionalEntry =
		additionalProperties === false ? [ ]
		: [ createAdditionalMembers( ctx, additionalProperties ) ];

	const createQuestionmark = ( required: boolean ) =>
		required
		? undefined
		: factory.createToken( ts.SyntaxKind.QuestionToken );

	const propertyNodes: Array< ts.TypeElement > = [
		...Object
			.keys( properties )
			.map( name => ( { name, ...properties[ name ] } ) )
			.map( ( { name, node, required } ) =>
				wrapAnnotations(
					factory.createPropertySignature(
						undefined, // modifiers
						safeName( name ),
						createQuestionmark( required ),
						tsType( ctx, node ).node
					),
					properties[ name ].node
				)
			),
		...additionalEntry,
	];

	const objectAsNode = factory.createTypeLiteralNode( propertyNodes );

	return { properties: propertyNodes, node: objectAsNode };
}

function tsSpreadType( ctx: Context, node: NodeType ): ts.TypeNode
{
	return factory.createArrayTypeNode(
		factory.createRestTypeNode( tsType( ctx, node ).node )
	);
}

function tsArrayType( ctx: Context, node: ArrayType | TupleType ): ts.TypeNode
{
	// TODO: Add support for minItems (making rest arguments optional)
	// TODO: Maybe add support for maxItems (turning an array into a tuple of
	//       some "good" max size)
	// Both are tricky for merged (anyOf, allOf, if-then-else) conditionals
	// if the types come from json schema...

	if ( node.type === 'tuple' )
		return factory.createTupleTypeNode( [
			...node.elementTypes.map( elem => tsType( ctx, elem ).node ),
			...( !node.additionalItems
				? [ ]
				: node.additionalItems === true
				? [ tsSpreadType( ctx, { type: 'any' } ) ]
				: [ tsSpreadType( ctx, node.additionalItems ) ]
			)
		] );
	else
		return factory.createArrayTypeNode(
			tsType( ctx, node.elementType ).node
		);
}

function tsRefType( node: RefType ): ts.TypeNode
{
	return factory.createTypeReferenceNode( node.ref );
}
