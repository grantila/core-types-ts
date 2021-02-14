import * as ts from 'typescript'
import {
	NodeDocument,
	NodeObjectCoreType,
	NodeType,
	NamedType,
	AnyType,
	TupleType,
	locationToLineColumn,
	MalformedTypeError,
	WarnFunction,
	getPositionOffset,
	UnsupportedError,
	isNonNullable,
	ConversionResult,
} from 'core-types'

import { FromTsOptions } from './types'
import {
	toLocation,
	tsStripOptionalType,
	isExportedDeclaration,
} from './ts-helpers'
import { decorateNode } from './ts-annotations'


const anyType: AnyType = { type: 'any' };

type TopLevelDeclaration = ts.TypeAliasDeclaration | ts.InterfaceDeclaration;

interface TopLevelEntry
{
	declaration: TopLevelDeclaration;
	exported: boolean;
}

interface Context
{
	options: Required< FromTsOptions >;
	typeMap: Map< string, TopLevelEntry >;
	includeExtra: Set< string >;
	cyclicState: Set< string >;
	getUnsupportedError( message: string, node: ts.Node ): UnsupportedError;
	handleError( err: UnsupportedError ): undefined | never;
}

const defaultWarn = ( sourceCode: string ): WarnFunction =>
	( msg, meta ) =>
	{
		const extra = meta?.loc?.start
			? [
				meta.loc,
				sourceCode.slice(
					getPositionOffset( meta.loc?.start ),
					getPositionOffset( meta.loc?.end )
				)
			]
			: [ ];
		console.warn( msg, ...extra );
	};

export function convertTypeScriptToCoreTypes(
	sourceCode: string,
	options?: FromTsOptions
)
: ConversionResult< NodeDocument >
{
	const {
		warn = defaultWarn( sourceCode ),
		nonExported = 'include-if-referenced',
		unsupported = 'ignore',
	} = options ?? { };

	const sourceFile = ts.createSourceFile(
		"filename.ts",
		sourceCode,
		ts.ScriptTarget.Latest,
		/*setParentNodes */ true
	);

	const declarations = sourceFile.statements
		.filter(
			( statement ) : statement is TopLevelDeclaration =>
			ts.isTypeAliasDeclaration( statement )
			||
			ts.isInterfaceDeclaration( statement )
		);

	const ctx: Context = {
		options: {
			warn,
			nonExported,
			unsupported,
		},
		typeMap: new Map(
			declarations.map( declaration =>
				[
					declaration.name.getText( ),
					{
						declaration,
						exported: isExportedDeclaration( declaration ),
					},
				]
			)
		),
		includeExtra: new Set( ),
		cyclicState: new Set( ),
		getUnsupportedError( message, node )
		{
			const loc = locationToLineColumn(
				sourceCode, toLocation( node )
			);

			return new UnsupportedError(
				message,
				{
					blob: node,
					loc,
					source: sourceCode,
				}
			);
		},
		handleError( err: UnsupportedError )
		{
			if ( ctx.options.unsupported === 'warn' )
				ctx.options.warn( err.message, err );

			else if ( ctx.options.unsupported === 'error' )
				throw err;

			return undefined;
		}
	};

	if ( ctx.options.nonExported === 'fail' )
		declarations
		.filter( declaration => !isExportedDeclaration( declaration ) )
		.forEach( declaration =>
		{
			throw new MalformedTypeError(
				`Found non-exported type when 'nonExported' is 'fail'`,
				{
					blob: declaration,
					path: [ declaration.name.getText( ) ],
					loc: toLocation( declaration ),
				}
			);
		} );

	const notConvertedTypes = new Set< string >( );

	const convertTopLevel = ( statement: TopLevelDeclaration ) =>
	{
		ctx.cyclicState = new Set( );
		const type = fromTsTopLevelNode( statement, ctx );
		if ( !type )
			notConvertedTypes.add( statement.name.getText( ) );
		return type;
	};

	const types = declarations
		.filter( declaration =>
			ctx.options.nonExported === 'include'
			||
			isExportedDeclaration( declaration )
		)
		.map( statement => convertTopLevel( statement ) as NamedType )
		.filter( < T >( v: T ): v is NonNullable< T > => !!v );

	types.push(
		...[ ...ctx.includeExtra.values( ) ]
			.map( name =>
			{
				const statement = ctx.typeMap.get( name );
				if ( !statement )
					throw new Error(
						"Internal error on exporting non-exported type"
					);
				return convertTopLevel( statement.declaration );
			} )
			.filter( < T >( v: T ): v is NonNullable< T > => !!v )
	);

	return {
		data: { version: 1, types },
		convertedTypes: types.map( ( { name } ) => name ),
		notConvertedTypes: [ ...notConvertedTypes ],
	};
}

function isGenericType( node: ts.Node )
{
	return !!(
		( node as ts.NodeWithTypeArguments ).typeArguments?.length
		||
		( node as ts.TypeAliasDeclaration ).typeParameters?.length
	);
}

function handleGeneric( node: ts.Node, ctx: Context )
{
	return ctx.handleError( ctx.getUnsupportedError(
		`Generic types are not supported`,
		node
	) );
}

function fromTsTopLevelNode( node: TopLevelDeclaration, ctx: Context )
: NamedType | undefined
{
	if ( isGenericType( node ) )
		return handleGeneric( node, ctx );

	if ( ts.isTypeAliasDeclaration( node ) )
	{
		return {
			name: node.name.getText( ),
			...decorateNode( node ),
			...( fromTsTypeNode( node.type, ctx ) ?? anyType ),
		};
	}
	else if ( ts.isInterfaceDeclaration( node ) )
	{
		return {
			name: node.name.getText( ),
			type: 'object',
			...fromTsObjectMembers( node, ctx ),
			...decorateNode( node ),
		};
	}
	else
		throw new Error( "Internal error" );
}

function isOptionalProperty( node: ts.PropertySignature )
{
	return node.questionToken?.kind === ts.SyntaxKind.QuestionToken;
}

function fromTsObjectMembers(
	node: ts.InterfaceDeclaration | ts.TypeLiteralNode,
	ctx: Context
)
: Pick< NodeObjectCoreType, 'properties' | 'additionalProperties' >
{
	const ret:
		Pick< NodeObjectCoreType, 'properties' | 'additionalProperties' > =
		{
			properties: { },
			additionalProperties: false,
		};

	node.members.forEach( member =>
	{
		if ( ts.isPropertySignature( member ) && member.type )
		{
			const name = member.name.getText( );
			ret.properties[ name ] = {
				required: !isOptionalProperty( member ),
				node: {
					...( fromTsTypeNode( member.type, ctx ) ?? anyType ),
					...decorateNode( member ),
				},
			};
		}
		else if ( ts.isIndexSignatureDeclaration( member ) )
		{
			const param = member.parameters[ 0 ];
			if ( param.type?.kind !== ts.SyntaxKind.StringKeyword )
			{
				ctx.options.warn(
					`Will not convert non-string index signature`,
					{
						blob: param,
						loc: toLocation( param ),
					}
				);
				return;
			}
			ret.additionalProperties =
				fromTsTypeNode( member.type, ctx )
				// If type conversion silently failed, it means *some* kind of
				// additional properties are allowed
				?? anyType;
		}
	} );

	return ret;
}

function fromTsTypeNode( node: ts.TypeNode, ctx: Context )
: NodeType | undefined
{
	if ( ts.isUnionTypeNode( node ) )
		return {
			type: 'or',
			or: node.types
				.map( child => fromTsTypeNode( child, ctx ) )
				.filter( isNonNullable ),
			...decorateNode( node ),
		};

	else if ( ts.isIntersectionTypeNode( node ) )
		return {
			type: 'and',
			and: node.types
				.map( child => fromTsTypeNode( child, ctx ) )
				.filter( isNonNullable ),
			...decorateNode( node ),
		};

	else if ( node.kind === ts.SyntaxKind.AnyKeyword )
		return { type: 'any', ...decorateNode( node ) };

	else if ( node.kind === ts.SyntaxKind.UnknownKeyword )
		return { type: 'any', ...decorateNode( node ) };

	else if ( node.kind === ts.SyntaxKind.StringKeyword )
		return { type: 'string', ...decorateNode( node ) };

	else if ( node.kind === ts.SyntaxKind.NumberKeyword )
		return { type: 'number', ...decorateNode( node ) };

	else if ( node.kind === ts.SyntaxKind.BooleanKeyword )
		return { type: 'boolean', ...decorateNode( node ) };

	else if ( node.kind === ts.SyntaxKind.ObjectKeyword )
		return {
			type: 'object',
			properties: { },
			additionalProperties: true,
			...decorateNode( node )
		};

	else if ( ts.isArrayTypeNode( node ) )
		return {
			type: 'array',
			elementType: fromTsTypeNode( node.elementType, ctx ) ?? anyType,
			...decorateNode( node ),
		};

	else if ( ts.isTypeReferenceNode( node ) )
	{
		if ( node.typeName.kind === ts.SyntaxKind.QualifiedName )
			// TODO: Add option to allow (not fail) this by renaming
			return ctx.handleError( ctx.getUnsupportedError(
				`Qualified reference names not supported`,
				node
			) );

		if ( node.typeName.text === 'Array' )
		{
			const typeArgs = node.typeArguments as ts.NodeArray< ts.TypeNode >;
			return {
				type: 'array',
				elementType:
					typeArgs
					? fromTsTypeNode( typeArgs[ 0 ], ctx ) ?? anyType
					: anyType,
				...decorateNode( node ),
			};
		}

		if ( isGenericType( node ) )
			return handleGeneric( node, ctx );

		const ref = node.typeName.text;

		// TODO: Handle (reconstruct) generics

		const typeInfo = ctx.typeMap.get( ref );
		if ( typeInfo && !typeInfo.exported )
		{
			if ( ctx.options.nonExported === 'include-if-referenced' )
				ctx.includeExtra.add( ref );
			else if ( ctx.options.nonExported === 'inline' )
			{
				if ( ctx.cyclicState.has( ref ) )
					throw new MalformedTypeError(
						`Cycling type found when trying to inline type ${ref}`,
						{
							blob: node,
							loc: toLocation( node ),
						}
					);
				ctx.cyclicState.add( ref );
				return fromTsTopLevelNode( typeInfo.declaration, ctx );
			}
		}

		return { type: 'ref', ref, ...decorateNode( node ) };
	}

	else if ( ts.isTupleTypeNode( node ) )
		return {
			type: 'tuple',
			...fromTsTuple( node, ctx ),
			...decorateNode( node )
		};

	else if ( ts.isLiteralTypeNode( node ) )
	{
		if ( ts.isNumericLiteral( node.literal ) )
			return {
				type: 'number',
				const: Number( node.literal.text ),
				...decorateNode( node ),
			};

		else if ( ts.isStringLiteral( node.literal ) )
			return {
				type: 'string',
				const: node.literal.text,
				...decorateNode( node ),
			};

		else if ( node.literal.kind === ts.SyntaxKind.TrueKeyword )
			return {
				type: 'boolean',
				const: true,
				...decorateNode( node ),
			};

		else if ( node.literal.kind === ts.SyntaxKind.FalseKeyword )
			return {
				type: 'boolean',
				const: false,
				...decorateNode( node ),
			};

		else if ( node.literal.kind === ts.SyntaxKind.NullKeyword )
			return { type: 'null', ...decorateNode( node ) };

		else if ( node.literal.kind === ts.SyntaxKind.PrefixUnaryExpression )
			return ctx.handleError( ctx.getUnsupportedError(
				"Prefix unary expressions not supported",
				node.literal
			) );

		return ctx.handleError( ctx.getUnsupportedError(
			"Literal type not understood",
			node.literal
		) );
	}

	else if ( ts.isTypeLiteralNode( node ) )
	{
		return {
			type: 'object',
			...fromTsObjectMembers( node, ctx ),
			...decorateNode( node ),
		};
	}

	else
	{
		return ctx.handleError( ctx.getUnsupportedError(
			`Unimplemented type (kind=${node.kind})`,
			node
		) );
	}
}

function fromTsTuple( node: ts.TupleTypeNode, ctx: Context )
: Pick< TupleType, 'elementTypes' | 'additionalItems' | 'minItems' >
{
	if ( node.elements.length === 0 )
		return { elementTypes: [ ], additionalItems: false, minItems: 0 };

	const hasRest =
		ts.isRestTypeNode( node.elements[ node.elements.length - 1 ] );

	const [ elements, rest ] =
		hasRest
		? [
			node.elements.slice( 0, node.elements.length - 1 ),
			node.elements[ node.elements.length - 1 ] as ts.RestTypeNode,
		]
		: [ [ ...node.elements ], undefined ];

	const elementTypes = elements
		.map( node =>
			fromTsTypeNode( tsStripOptionalType( node ), ctx ) ?? anyType
		);
	const additionalItems =
		rest
		? (
			fromTsTypeNode(
				( rest.type as ts.ArrayTypeNode ).elementType,
				ctx
			)
			?? anyType
		)
		: false;
	const firstOptional =
		elements.findIndex( node => ts.isOptionalTypeNode( node ) );
	const minItems = firstOptional === -1 ? elements.length : firstOptional;

	return {
		elementTypes,
		...(
			additionalItems && additionalItems.type === 'any'
			? { additionalItems: true }
			: { additionalItems }
		),
		minItems,
	};
}
