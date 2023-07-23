import ts from "typescript";
import {
  type AnyType,
  type ConversionResult,
  type NamedType,
  type NodeDocument,
  type NodeObjectCoreType,
  type NodeType,
  type TupleType,
  type WarnFunction,
  getPositionOffset,
  isNonNullable,
  locationToLineColumn,
  MalformedTypeError,
  UnsupportedError,
} from "core-types";

import type { FromTsOptions } from "./types.js";
import { isExportedDeclaration, toLocation, tsStripOptionalType } from "./ts-helpers.js";
import { decorateNode } from "./ts-annotations.js";

const anyType: AnyType = { type: "any" };

type TopLevelDeclaration = ts.TypeAliasDeclaration | ts.InterfaceDeclaration;

interface TopLevelEntry {
  declaration: TopLevelDeclaration;
  exported: boolean;
}

interface Context {
  options: Required<FromTsOptions>;
  typeMap: Map<string, TopLevelEntry>;
  includeExtra: Set<string>;
  cyclicState: Set<string>;
  getUnsupportedError(message: string, node: ts.Node): UnsupportedError;
  handleError(err: UnsupportedError): undefined | never;
  ensureNonCyclic(name: string, node: ts.Node): void;
}

const defaultWarn =
  (sourceCode: string): WarnFunction =>
  (msg, meta) => {
    return meta?.loc?.start ? [meta.loc, sourceCode.slice(getPositionOffset(meta.loc?.start), getPositionOffset(meta.loc?.end))] : [];
  };

export function convertTypeScriptToCoreTypes(sourceCode: string, options?: FromTsOptions): ConversionResult<NodeDocument> {
  const { warn = defaultWarn(sourceCode), namespaces = "ignore", nonExported = "include-if-referenced", unsupported = "ignore" } = options ?? {};

  const notConvertedTypes = new Set<string>();

  const sourceFile = ts.createSourceFile("filename.ts", sourceCode, ts.ScriptTarget.Latest, /*setParentNodes */ true);

  const isTopLevelDeclaration = (statement: ts.Statement): statement is TopLevelDeclaration => ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement);

  interface ExportedDeclaration {
    namespaceParents: Array<string>;
    declaration: TopLevelDeclaration;
  }

  const recurseNamespaces = (namespaceParents: Array<string>, statements: ts.NodeArray<ts.Statement>): Array<ExportedDeclaration> => [
    ...statements
      .filter((statement): statement is ts.NamespaceDeclaration => ts.isModuleDeclaration(statement))
      .flatMap((statement) =>
        statement.body.kind !== ts.SyntaxKind.ModuleBlock ? [] : recurseNamespaces([...namespaceParents, statement.name.getText()], statement.body.statements)
      ),
    ...statements
      .filter(isTopLevelDeclaration)
      .map((statement): ExportedDeclaration | undefined => {
        if (namespaceParents.length > 0 && namespaces === "ignore") return undefined;

        return { namespaceParents, declaration: statement };
      })
      .filter((v): v is NonNullable<typeof v> => !!v),
  ];

  const registerDeclarationAsNonExported = (exportedDeclaration: ExportedDeclaration) => {
    const { declaration, namespaceParents } = exportedDeclaration;

    const fullName = [...namespaceParents, declaration.name.getText()].join(".");

    notConvertedTypes.add(fullName);
  };

  const filterConflicts = (declarations: Array<ExportedDeclaration>): Array<ExportedDeclaration> => {
    const byName = new Map<string, ExportedDeclaration>();

    declarations.forEach((exportedDeclaration) => {
      const { declaration, namespaceParents } = exportedDeclaration;

      const name = declaration.name.getText();
      const item = byName.get(name);

      if (!item) {
        byName.set(name, exportedDeclaration);
        return;
      }

      if (item.namespaceParents.length > namespaceParents.length) {
        // Replace with higher-level declaration
        byName.set(name, exportedDeclaration);

        registerDeclarationAsNonExported(item);
      } else {
        registerDeclarationAsNonExported(exportedDeclaration);
      }
    });

    return [...byName.values()];
  };

  // Given the <namespaces> configuration, set an appropriate name for the
  // exported type.
  const renameDeclaration = ({ declaration, namespaceParents }: ExportedDeclaration): TopLevelDeclaration => {
    const name = declaration.name.getText();

    const fullName = namespaces === "hoist" || namespaces === "ignore" ? name : [...namespaceParents, name].join(namespaces === "join-dot" ? "." : "_");

    const identifier = ts.factory.createIdentifier(fullName);
    identifier.getText = (_) => fullName;

    type MutableTopLevelDeclaration = {
      -readonly [K in keyof TopLevelDeclaration]: TopLevelDeclaration[K];
    };

    (declaration as MutableTopLevelDeclaration).name = identifier;

    return declaration;
  };

  const flattenAndFilterConflicts = (declarations: Array<ExportedDeclaration>): Array<TopLevelDeclaration> =>
    (namespaces === "hoist" ? filterConflicts(declarations) : declarations).map(renameDeclaration);

  const declarations = flattenAndFilterConflicts(recurseNamespaces([], sourceFile.statements));

  const ctx: Context = {
    options: {
      warn,
      namespaces,
      nonExported,
      unsupported,
    },
    typeMap: new Map(
      declarations.map((declaration) => [
        declaration.name.getText(),
        {
          declaration,
          exported: isExportedDeclaration(declaration),
        },
      ])
    ),
    includeExtra: new Set(),
    cyclicState: new Set(),
    getUnsupportedError(message, node) {
      const loc = locationToLineColumn(sourceCode, toLocation(node));

      return new UnsupportedError(message, {
        blob: node,
        loc,
        source: sourceCode,
      });
    },
    handleError(err: UnsupportedError) {
      if (ctx.options.unsupported === "warn") ctx.options.warn(err.message, err);
      else if (ctx.options.unsupported === "error") throw err;

      return undefined;
    },
    ensureNonCyclic(name: string, node: ts.Node) {
      if (ctx.cyclicState.has(name))
        throw new MalformedTypeError(`Cyclic type found when trying to inline type ${name}`, {
          blob: node,
          loc: toLocation(node),
        });
      ctx.cyclicState.add(name);
    },
  };

  if (ctx.options.nonExported === "fail")
    declarations
      .filter((declaration) => !isExportedDeclaration(declaration))
      .forEach((declaration) => {
        throw new MalformedTypeError(`Found non-exported type when 'nonExported' is 'fail'`, {
          blob: declaration,
          path: [declaration.name.getText()],
          loc: toLocation(declaration),
        });
      });

  const convertTopLevel = (statement: TopLevelDeclaration) => {
    ctx.cyclicState = new Set();
    const type = fromTsTopLevelNode(statement, ctx);
    if (!type) notConvertedTypes.add(statement.name.getText());
    return type;
  };

  const isReferenced = (types: NamedType[] | NodeType[], name: string) => {
	return types.some((t: NamedType | NodeType): boolean => {
		if(t.type === 'and') {
			return isReferenced(t.and, name);
		}
		if( t.type === 'or') {
			return isReferenced(t.or, name);
		}
		if (t.type === 'array') {
			return isReferenced([t.elementType], name);
		}
		if (t.type === 'object') {
			return isReferenced(Object.values(t.properties).map(v => v.node), name);
		}

      return t.type === "ref" && t.ref === name;
    });
  };

  const types = declarations
    .filter((declaration) => ctx.options.nonExported === "include" || isExportedDeclaration(declaration))
    .map((statement) => convertTopLevel(statement) as NamedType)
    .filter(<T>(v: T): v is NonNullable<T> => !!v);


  types.push(
    ...[...ctx.includeExtra.values()]
      .map((name) => {
        const statement = ctx.typeMap.get(name);
        if (!statement) throw new Error("Internal error on exporting non-exported type");
        if (!(statement.exported || (ctx.options.nonExported === "include-if-referenced" && isReferenced(types, name)))) {
          return null;
        }
        return convertTopLevel(statement.declaration);
      })
      .filter(<T>(v: T): v is NonNullable<T> => !!v)
  );

  return {
    data: { version: 1, types },
    convertedTypes: types.map(({ name }) => name),
    notConvertedTypes: [...notConvertedTypes],
  };
}

function isGenericType(node: ts.Node) {
  return !!((node as ts.NodeWithTypeArguments).typeArguments?.length || (node as ts.TypeAliasDeclaration).typeParameters?.length);
}

function handleGeneric(node: ts.Node, ctx: Context) {
  return ctx.handleError(ctx.getUnsupportedError(`Generic types are not supported`, node));
}

function fromTsTopLevelNode(node: TopLevelDeclaration, ctx: Context): NamedType | undefined {
  if (isGenericType(node)) return handleGeneric(node, ctx);

  if (ts.isTypeAliasDeclaration(node)) {
    return {
      name: node.name.getText(),
      ...decorateNode(node),
      ...(fromTsTypeNode(node.type, ctx) ?? anyType),
    };
  } else if (ts.isInterfaceDeclaration(node)) {
    const heritage = getInterfaceHeritage(node);

    // This is an extended interface, which we turn into an and-type of the
    // object itself and the refs it extends.
    // If no such ref was found, we keep it as an interface.
    const inherited: Array<NodeType> = heritage.map((ref) => getRefType(node, ref, ctx)).filter(isNonNullable);

    if (inherited.length > 0)
      return {
        name: node.name.getText(),
        type: "and",
        and: [
          ...inherited,
          {
            type: "object",
            ...fromTsObjectMembers(node, ctx),
          },
        ],
        ...decorateNode(node),
      };

    return {
      name: node.name.getText(),
      type: "object",
      ...fromTsObjectMembers(node, ctx),
      ...decorateNode(node),
    };
  } else throw new Error("Internal error");
}

function getInterfaceHeritage(node: ts.InterfaceDeclaration): Array<string> {
  const heritage = node.heritageClauses ?? [];
  if (heritage.length === 0) return [];

  return heritage[0].types.map((type) => type.getText());
}

function isOptionalProperty(node: ts.PropertySignature) {
  return node.questionToken?.kind === ts.SyntaxKind.QuestionToken;
}

function fromTsObjectMembers(node: ts.InterfaceDeclaration | ts.TypeLiteralNode, ctx: Context): Pick<NodeObjectCoreType, "properties" | "additionalProperties"> {
  const ret: Pick<NodeObjectCoreType, "properties" | "additionalProperties"> = {
    properties: {},
    additionalProperties: false,
  };

  node.members.forEach((member) => {
    if (ts.isPropertySignature(member) && member.type) {
      const name = member.name.getText();
      ret.properties[name] = {
        required: !isOptionalProperty(member),
        node: {
          ...(fromTsTypeNode(member.type, ctx) ?? anyType),
          ...decorateNode(member),
        },
      };
    } else if (ts.isIndexSignatureDeclaration(member)) {
      const param = member.parameters[0];
      if (param.type?.kind !== ts.SyntaxKind.StringKeyword) {
        ctx.options.warn(`Will not convert non-string index signature`, {
          blob: param,
          loc: toLocation(param),
        });
        return;
      }
      ret.additionalProperties =
        fromTsTypeNode(member.type, ctx) ??
        // If type conversion silently failed, it means *some* kind of
        // additional properties are allowed
        anyType;
    }
  });

  return ret;
}

interface FromTsTypeNodeOptions {
  /** Don't handle extra/inline reference cases, just return the type */
  peekOnly?: boolean;
}

function fromTsTypeNode(node: ts.TypeNode, ctx: Context, options?: FromTsTypeNodeOptions): NodeType | undefined {
  const { peekOnly = false } = options ?? {};

  if (ts.isUnionTypeNode(node))
    return {
      type: "or",
      or: node.types.map((child) => fromTsTypeNode(child, ctx)).filter(isNonNullable),
      ...decorateNode(node),
    };
  else if (ts.isIntersectionTypeNode(node))
    return {
      type: "and",
      and: node.types.map((child) => fromTsTypeNode(child, ctx)).filter(isNonNullable),
      ...decorateNode(node),
    };
  else if (ts.isParenthesizedTypeNode(node)) {
    const children = [...node.getChildren()];
    if (children[0]?.kind === ts.SyntaxKind.OpenParenToken) children.shift();
    if (children[children.length - 1]?.kind === ts.SyntaxKind.CloseParenToken) children.pop();

    if (children.length !== 1 || !ts.isTypeNode(children[0])) return ctx.handleError(ctx.getUnsupportedError(`Parenthesis type not understood`, node));

    return fromTsTypeNode(children[0] as ts.TypeNode, ctx);
  } else if (node.kind === ts.SyntaxKind.AnyKeyword) return { type: "any", ...decorateNode(node) };
  else if (node.kind === ts.SyntaxKind.UnknownKeyword) return { type: "any", ...decorateNode(node) };
  else if (node.kind === ts.SyntaxKind.StringKeyword) return { type: "string", ...decorateNode(node) };
  else if (node.kind === ts.SyntaxKind.NumberKeyword) return { type: "number", ...decorateNode(node) };
  else if (node.kind === ts.SyntaxKind.BooleanKeyword) return { type: "boolean", ...decorateNode(node) };
  else if (node.kind === ts.SyntaxKind.ObjectKeyword)
    return {
      type: "object",
      properties: {},
      additionalProperties: true,
      ...decorateNode(node),
    };
  else if (ts.isArrayTypeNode(node))
    return {
      type: "array",
      elementType: fromTsTypeNode(node.elementType, ctx) ?? anyType,
      ...decorateNode(node),
    };
  else if (ts.isTypeReferenceNode(node)) {
    if (node.typeName.kind === ts.SyntaxKind.QualifiedName)
      // TODO: Add option to allow (not fail) this by renaming
      return ctx.handleError(ctx.getUnsupportedError(`Qualified reference names not supported`, node));

    if (node.typeName.text === "Array") {
      const typeArgs = node.typeArguments as ts.NodeArray<ts.TypeNode>;
      return {
        type: "array",
        elementType: typeArgs ? fromTsTypeNode(typeArgs[0], ctx) ?? anyType : anyType,
        ...decorateNode(node),
      };
    }

    const ref = node.typeName.text;

    const getStringUnion = (su: ts.TypeNode): undefined | string[] => {
      if (ts.isLiteralTypeNode(su) && ts.isStringLiteral(su.literal)) return [su.literal.text];

      if (!ts.isUnionTypeNode(su)) return ctx.handleError(ctx.getUnsupportedError(`Expected string union kind`, su));

      const names = su.types.map((subType) => (ts.isLiteralTypeNode(subType) && ts.isStringLiteral(subType.literal) ? subType.literal.text : (undefined as any as string)));
      if (names.some((name) => typeof name === "undefined")) return ctx.handleError(ctx.getUnsupportedError(`Expected string union kind`, su));

      return names;
    };

    const getReferencedType = () => {
      const typeArguments = node.typeArguments ?? [];
      const refType = typeArguments[0];
      const secondNameTypes = typeArguments[1];
      const secondNames = typeof secondNameTypes === "undefined" ? undefined : getStringUnion(secondNameTypes);
     
      if (typeof refType === "undefined") return ctx.handleError(ctx.getUnsupportedError(`${ref}<> of non-objects are not supported`, node));

      const subType = fromTsTypeNode(refType, ctx, { peekOnly: false });
    

      if (typeof subType === "undefined") return ctx.handleError(ctx.getUnsupportedError(`${ref}<> of non-objects are not supported`, node));

      if (subType.type === "ref") {
        const refName = subType.ref;
        const reference = ctx.typeMap.get(refName);

        if (!reference || (!ts.isTypeLiteralNode(reference.declaration) && !ts.isInterfaceDeclaration(reference.declaration)))
          return ctx.handleError(ctx.getUnsupportedError(`${ref}<> of non-objects are not supported`, node));

        ctx.ensureNonCyclic(refName, node);
        const members = fromTsObjectMembers(reference.declaration, ctx);
        return { members, secondNames };
      } else if (subType.type === "object") {
        return { members: subType, secondNames };
      } else return ctx.handleError(ctx.getUnsupportedError(`${ref}<> of non-objects are not supported`, node));
    };

    if (ref === "Omit") {
      const reference = getReferencedType();
      if (!reference) return undefined;

      const { members, secondNames } = reference;

      if (typeof secondNames === "undefined") return undefined;

      const filteredMembers: typeof members = {
        ...members,
        properties: Object.fromEntries(Object.entries(members.properties).filter(([name]) => !secondNames.includes(name))),
      };

      return {
        type: "object",
        ...filteredMembers,
        ...decorateNode(node, { includeJsDoc: false }),
      };
    } else if (ref === "Pick") {
      const reference = getReferencedType();
      if (!reference) return undefined;

      const { members, secondNames } = reference;

      if (typeof secondNames === "undefined") return undefined;

      const filteredMembers: typeof members = {
        ...members,
        properties: Object.fromEntries(Object.entries(members.properties).filter(([name]) => secondNames.includes(name))),
      };

      return {
        type: "object",
        ...filteredMembers,
        ...decorateNode(node, { includeJsDoc: false }),
      };
    } else if (ref === "Partial") {
      const reference = getReferencedType();

      if (!reference) return undefined;
      const { members } = reference;

      const filteredMembers: typeof members = {
        ...members,
        properties: Object.fromEntries(Object.entries(members.properties).map(([name, value]) => [name, { ...value, required: false }])),
      };

      return {
        type: "object",
        ...filteredMembers,
        ...decorateNode(node, { includeJsDoc: false }),
      };
    }

    if (isGenericType(node)) return handleGeneric(node, ctx);
    // TODO: Handle (reconstruct) generics

    if (peekOnly) return { type: "ref", ref, ...decorateNode(node) };

    const refNode = getRefType(node, ref, ctx);

    return !refNode ? undefined : { ...refNode, ...decorateNode(node) };
  } else if (ts.isTupleTypeNode(node))
    return {
      type: "tuple",
      ...fromTsTuple(node, ctx),
      ...decorateNode(node),
    };
  else if (ts.isLiteralTypeNode(node)) {
    if (ts.isNumericLiteral(node.literal))
      return {
        type: "number",
        const: Number(node.literal.text),
        ...decorateNode(node),
      };
    else if (ts.isStringLiteral(node.literal))
      return {
        type: "string",
        const: node.literal.text,
        ...decorateNode(node),
      };
    else if (node.literal.kind === ts.SyntaxKind.TrueKeyword)
      return {
        type: "boolean",
        const: true,
        ...decorateNode(node),
      };
    else if (node.literal.kind === ts.SyntaxKind.FalseKeyword)
      return {
        type: "boolean",
        const: false,
        ...decorateNode(node),
      };
    else if (node.literal.kind === ts.SyntaxKind.NullKeyword) return { type: "null", ...decorateNode(node) };
    else if (node.literal.kind === ts.SyntaxKind.PrefixUnaryExpression) {
      if ("operand" in node.literal && node.literal.operator === ts.SyntaxKind.MinusToken) {
        return {
          type: "number",
          const: -Number(node.literal.operand.getText()),
          ...decorateNode(node),
        };
      }

      return ctx.handleError(ctx.getUnsupportedError("Prefix unary expressions is only supported for MinusToken", node.literal));
    }

    return ctx.handleError(ctx.getUnsupportedError("Literal type not understood", node.literal));
  } else if (ts.isTypeLiteralNode(node)) {
    return {
      type: "object",
      ...fromTsObjectMembers(node, ctx),
      ...decorateNode(node),
    };
  } else {
    return ctx.handleError(ctx.getUnsupportedError(`Unimplemented type (kind=${node.kind})`, node));
  }
}

function getRefType(node: ts.Node, ref: string, ctx: Context): NodeType | undefined {
  const typeInfo = ctx.typeMap.get(ref);
  if (typeInfo && !typeInfo.exported) {
    if (ctx.options.nonExported === "include-if-referenced") {
      ctx.includeExtra.add(ref);
      return { type: "ref", ref };
    } else if (ctx.options.nonExported === "inline") {
      ctx.ensureNonCyclic(ref, node);
      return fromTsTopLevelNode(typeInfo.declaration, ctx);
    }
  } else if (typeInfo) {
    if (ts.isTypeAliasDeclaration(typeInfo.declaration)) {
      const typed = (typeInfo.declaration.type as any).typeName;
      const f = typed.escapedText;
      return { type: "ref", ref: f };
    }
    return { type: "ref", ref };
  } else return undefined;
}

function fromTsTuple(node: ts.TupleTypeNode, ctx: Context): Pick<TupleType, "elementTypes" | "additionalItems" | "minItems"> {
  if (node.elements.length === 0) return { elementTypes: [], additionalItems: false, minItems: 0 };

  const hasRest = ts.isRestTypeNode(node.elements[node.elements.length - 1]);

  const [elements, rest] = hasRest
    ? [node.elements.slice(0, node.elements.length - 1), node.elements[node.elements.length - 1] as ts.RestTypeNode]
    : [[...node.elements], undefined];

  const elementTypes = elements.map((node) => fromTsTypeNode(tsStripOptionalType(node), ctx) ?? anyType);
  const additionalItems = rest ? fromTsTypeNode((rest.type as ts.ArrayTypeNode).elementType, ctx) ?? anyType : false;
  const firstOptional = elements.findIndex((node) => ts.isOptionalTypeNode(node));
  const minItems = firstOptional === -1 ? elements.length : firstOptional;

  return {
    elementTypes,
    ...(additionalItems && additionalItems.type === "any" ? { additionalItems: true } : { additionalItems }),
    minItems,
  };
}
