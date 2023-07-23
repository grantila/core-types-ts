import type { WarnFunction } from 'core-types';

export interface ToTsOptions {
	warn?: WarnFunction;

	/**
	 * The name of the file the result will be written to
	 */
	filename?: string;

	/**
	 * The name of the source file used to convert to TypeScript
	 */
	sourceFilename?: string;

	/**
	 * Use `unknown` instead of `any` for any-types.
	 */
	useUnknown?: boolean;

	/**
	 * Write a declaration file, where e.g. "export interface" becomes
	 * "export declare interface".
	 */
	declaration?: boolean;

	/**
	 * The name of the package using this package to perform the conversion
	 */
	userPackage?: string;

	/**
	 * The url to the package using this package
	 */
	userPackageUrl?: string;

	/**
	 * Set to true to prevent writing the "disable linting" comment
	 */
	noDisableLintHeader?: boolean;

	/**
	 * Set to true to not write a top-level descriptive comment about the
	 * auto-generated file
	 */
	noDescriptiveHeader?: boolean;

	/**
	 * Try to reconstruct namespaces:
	 *
	 *  - `ignore`: Don't try to reconstruct namespaces (default)
	 *  - `dot`: Split names by dot (.) as namespaces for top-level types
	 *  - `underscore`: Split names by underscore (_) as namespaces for
	 *    top-level types
	 *  - `all`: Split by dot (.) and/or underscores (_) as namespaces for
	 *    top-level types
	 */
	namespaces?: 'ignore' | 'dot' | 'underscore' | 'all';

	/**
	 * What to do when detecting an unsupported type
	 *
	 *  - `ignore`: Ignore (skip) type
	 *  - `warn`: Ignore type, but warn (default)
	 *  - `error`: Throw an error
	 */
	unsupported?: 'ignore' | 'warn' | 'error';
}

export interface FromTsOptions {
	warn?: WarnFunction;

	/**
	 * How to deal with namespaces:
	 *
	 *  - `ignore`: Ignore namespaces entirely (default)
	 *  - `hoist`: Hoist types inside namespaces to top-level, so that the
	 *    types are included, but without their namespace. This can cause
	 *    conflicts, in which case deeper declarations will be dropped in favor
	 *    of more top-level declarations. Same-level will be exported
	 *    non-deterministically.
	 *  - `join-dot`: Join namespaces and types with a dot (.)
	 *  - `join-underscore`: Join namespaces and types with an underscore (_)
	 */
	namespaces?: 'ignore' | 'hoist' | 'join-dot' | 'join-underscore';

	/**
	 * What to do when detecting a non-exported type:
	 *
	 *  - `fail`: Fail conversion with an Error
	 *  - `ignore`: Don't include non-exported types, but allow references to
	 *    them
	 *  - `include`: Include non-exported types
	 *  - `inline`: Don't include non-exported types, inline them if necessary.
	 *    Will throw an Error if the inlined types have cyclic dependencies.
	 *  - `include-if-referenced`: Include non-exported types only if they are
	 *    referenced from exported types (default)
	 */
	nonExported?:
		| 'fail'
		| 'ignore'
		| 'include'
		| 'inline'
		| 'include-if-referenced';

	/**
	 * What to do when detecting an unsupported type
	 *
	 *  - `ignore`: Ignore (skip) type (default)
	 *  - `warn`: Ignore type, but warn
	 *  - `error`: Throw an error
	 */
	unsupported?: 'ignore' | 'warn' | 'error';
}
