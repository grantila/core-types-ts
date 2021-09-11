[![npm version][npm-image]][npm-url]
[![downloads][downloads-image]][npm-url]
[![build status][build-image]][build-url]
[![coverage status][coverage-image]][coverage-url]
[![Language grade: JavaScript][lgtm-image]][lgtm-url]
[![Node.JS version][node-version]][node-url]


# core-types-ts

This package provides conversion functions between [`core-types`][core-types-github-url] and TypeScript.

*You probably don't want to use this package directly, but rather [`typeconv`][typeconv-github-url] which uses this package to convert between TypeScript, JSON Schema and GraphQL.*


## See

Other conversion packages:
 * [`core-types-json-schema`][core-types-json-schema-github-url]
 * [`core-types-graphql`][core-types-graphql-github-url]
 * [`core-types-suretype`][core-types-suretype-github-url] (which is also using this package)


# Contents

 * [Usage](#usage)
   * [core-types to TypeScript](#core-types-to-typescript)
   * [TypeScript to core-types](#typescript-to-core-types)


# Usage

There are two conversion functions, `convertCoreTypesToTypeScript` and `convertTypeScriptToCoreTypes`, both returning a wrapped value, of the type [`ConversionResult`](https://github.com/grantila/core-types#conversion).


## core-types to TypeScript

```ts
import { convertCoreTypesToTypeScript } from 'core-types-ts'

let doc; // This core-types document comes from somewhere

const { data: tsSourceCode } = convertCoreTypesToTypeScript( doc );
```

You can provide options as a second argument fn the type:

```ts
interface ToTsOptions
{
	warn?: WarnFunction;
	filename?: string;
	sourceFilename?: string;
	useUnknown?: boolean;
	declaration?: boolean;
	userPackage?: string;
	userPackageUrl?: string;
	noDisableLintHeader?: boolean;
	noDescriptiveHeader?: boolean;
	unsupported?: 'ignore' | 'warn' | 'error';
}
```

These options are all optional.

 * `warn`: A function callback to be used for warnings, defaults to `console.warn`.
 * `filename` The filename to be written to.<br />This is a hint, no file will be written by the conversion function.
 * `sourceFilename`: The name of the source file from which the core-types comes.
 * `useUnknown`: Use `unknown` rather than `any` for *any*-types.
 * `declaration`: Write a declaration file, where e.g. "export interface" becomes "export declare interface".
 * `userPackage`: The name of the package using this package.
 * `userPackageUrl`: The url to the package using this package.
 * `noDisableLintHeader`: Prevent writing the "disable linting" comment.
 * `noDescriptiveHeader`: Do no write a top-level descriptive comment about the auto-generated file
 * `unsupported`: What to do when detecting an unsupported type
   * `ignore`: Ignore (skip) type
   * `warn`: Ignore type, but warn (default)
   * `error`: Throw an error

The `warn` function is of type `WarnFunction` from [`core-types`][core-types-github-url], meaning it takes a message as string, and an optional second argument of type `CoreTypesErrorMeta`, also from [`core-types`][core-types-github-url].


## TypeScript to core-types

```ts
import { convertTypeScriptToCoreTypes } from 'core-types-ts'

let sourceCode; // This source code comes from somewhere

const { data: doc } = convertTypeScriptToCoreTypes( sourceCode );
```

An optional second argument can be provided on the form

```ts
interface FromTsOptions
{
	warn?: WarnFunction;
	nonExported?: 'fail' | 'ignore' | 'include' | 'inline' | 'include-if-referenced';
	unsupported?: 'ignore' | 'warn' | 'error';
}
```

 * `warn`: The same warn function as in [CoreTypesToGraphqlOptions](#core-types-to-graphql)
 * `nonExported`: How to handle references to non-exported types
   * `fail`: Fail conversion with an Error
   * `ignore`: Don't include non-exported types, but allow references to them
   * `include`: Include non-exported types
   * `inline`: Don't include non-exported types, inline them if necessary.<br/>Will throw an Error if the inlined types have cyclic dependencies.
   * `include-if-referenced`: Include non-exported types only if they are referenced<br/>from exported types (default)
 * `unsupported`: What to do when detecting an unsupported type
   * `ignore`: Ignore (skip) type (default)
   * `warn`: Ignore type, but warn
   * `error`: Throw an error


[npm-image]: https://img.shields.io/npm/v/core-types-ts.svg
[npm-url]: https://npmjs.org/package/core-types-ts
[downloads-image]: https://img.shields.io/npm/dm/core-types-ts.svg
[build-image]: https://img.shields.io/github/workflow/status/grantila/core-types-ts/Master.svg
[build-url]: https://github.com/grantila/core-types-ts/actions?query=workflow%3AMaster
[coverage-image]: https://coveralls.io/repos/github/grantila/core-types-ts/badge.svg?branch=master
[coverage-url]: https://coveralls.io/github/grantila/core-types-ts?branch=master
[lgtm-image]: https://img.shields.io/lgtm/grade/javascript/g/grantila/core-types-ts.svg?logo=lgtm&logoWidth=18
[lgtm-url]: https://lgtm.com/projects/g/grantila/core-types-ts/context:javascript
[node-version]: https://img.shields.io/node/v/core-types-ts
[node-url]: https://nodejs.org/en/

[typeconv-github-url]: https://github.com/grantila/typeconv
[core-types-github-url]: https://github.com/grantila/core-types
[core-types-graphql-github-url]: https://github.com/grantila/core-types-graphql
[core-types-json-schema-github-url]: https://github.com/grantila/core-types-json-schema
[core-types-suretype-github-url]: https://github.com/grantila/core-types-suretype
